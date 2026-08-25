import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { HanaService } from '../hana/hana.service';
import { ConfigService } from '../config/config.service';
import { ProgressService } from '../progress/progress.service';
import {
  ExportJob,
  ObjectExportState,
  ExportStatus,
  ProgressEvent,
} from './export.types';
import { ExportObjectDto } from './dto/start-export.dto';

let MAX_CONCURRENT = 5;

export function setMaxConcurrent(n: number): void {
  MAX_CONCURRENT = Math.max(1, Math.min(20, n));
}

export function getMaxConcurrent(): number {
  return MAX_CONCURRENT;
}

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);
  private readonly jobs = new Map<string, ExportJob>();
  private readonly csvBaseDir: string;

  constructor(
    private readonly hanaService: HanaService,
    private readonly configService: ConfigService,
    private readonly progressService: ProgressService,
  ) {
    this.csvBaseDir = path.join(process.cwd(), '..', 'csv');
    if (!fs.existsSync(this.csvBaseDir)) {
      fs.mkdirSync(this.csvBaseDir, { recursive: true });
      this.logger.log(`Created CSV output directory: ${this.csvBaseDir}`);
    } else {
      this.logger.log(`CSV output directory: ${this.csvBaseDir}`);
    }
  }

  getJobs(): ExportJob[] {
    return Array.from(this.jobs.values());
  }

  getJob(jobId: string): ExportJob | undefined {
    return this.jobs.get(jobId);
  }

  async startExport(connectionId: string, exportObjects: ExportObjectDto[]): Promise<string> {
    const config = this.configService.getConnection(connectionId);
    const jobId = uuidv4();

    const objects: ObjectExportState[] = exportObjects.map((obj) => ({
      name: obj.name,
      hanaTableName: obj.hanaTableName,
      csvFileName: obj.csvFileName,
      status: 'queued' as ExportStatus,
      rowsWritten: 0,
      totalRows: obj.rowCount !== undefined ? obj.rowCount : undefined,
    }));

    const job: ExportJob = {
      jobId,
      connectionId,
      connectionName: config.name,
      objects,
      startedAt: new Date().toISOString(),
    };

    this.jobs.set(jobId, job);

    this.logger.log(
      `Export job ${jobId} started — ${objects.length} object(s) from "${config.name}" (schema: ${config.schema}), workers: ${MAX_CONCURRENT}`,
    );

    this.processJob(job, config.schema).catch((err) => {
      this.logger.error(`Job ${jobId} processing error: ${err.message}`, err.stack);
    });

    return jobId;
  }

  private async processJob(job: ExportJob, schema: string): Promise<void> {
    const config = this.configService.getConnection(job.connectionId);

    let active = 0;
    let idx = 0;

    const emitProgress = () => {
      const done = job.objects.every(
        (o) => o.status === 'done' || o.status === 'failed',
      );
      const doneCount = job.objects.filter((o) => o.status === 'done').length;
      const overallPercent = Math.floor((doneCount / job.objects.length) * 100);

      const event: ProgressEvent = {
        jobId: job.jobId,
        objects: job.objects.map((o) => ({ ...o })),
        overallPercent,
        done,
      };

      this.progressService.emit(job.jobId, event);

      if (done) {
        const failed = job.objects.filter((o) => o.status === 'failed').length;
        this.logger.log(`Job ${job.jobId} complete — ${doneCount} done, ${failed} failed`);
        this.progressService.complete(job.jobId);
      }
    };

    await new Promise<void>((resolveAll) => {
      const tryNext = () => {
        if (idx >= job.objects.length && active === 0) {
          resolveAll();
          return;
        }

        while (active < MAX_CONCURRENT && idx < job.objects.length) {
          const obj = job.objects[idx];
          idx++;
          active++;

          this.exportObject(obj, config, schema, emitProgress)
            .finally(() => {
              active--;
              tryNext();
            });
        }
      };

      tryNext();
    });
  }

  private async exportObject(
    obj: ObjectExportState,
    config: any,
    schema: string,
    emitProgress: () => void,
  ): Promise<void> {
    obj.status = 'running';
    emitProgress();

    const filePath = path.join(this.csvBaseDir, obj.csvFileName);
    obj.filePath = filePath;

    const start = Date.now();
    const client = await this.hanaService.connect(config);

    try {
      // Step 1: get total row count if not already known
      if (obj.totalRows === undefined) {
        try {
          const countRows = await this.hanaService.query(
            client,
            `SELECT COUNT(*) AS "cnt" FROM "${schema}"."${obj.hanaTableName}"`,
          );
          const cnt = Number(countRows[0]?.cnt ?? countRows[0]?.CNT ?? 0);
          if (cnt >= 0) {
            obj.totalRows = cnt;
            this.logger.debug(`COUNT(*) for "${obj.name}": ${cnt.toLocaleString()} rows`);
          }
        } catch (countErr: any) {
          this.logger.debug(`Could not COUNT(*) "${obj.name}": ${countErr.message}`);
        }
      }

      this.logger.log(`Exporting "${obj.name}" → ${obj.csvFileName} (totalRows: ${obj.totalRows?.toLocaleString() ?? 'unknown'})`);
      emitProgress();

      // Step 2: stream SELECT * via createArrayStream()
      // createArrayStream emits BATCHES of up to 256 rows per data event.
      // Each item in the batch is an array of column values.
      await new Promise<void>((resolve, reject) => {
        const sql = `SELECT * FROM "${schema}"."${obj.hanaTableName}"`;
        let rowsWritten = 0;
        let settled = false;

        const done = (err?: Error) => {
          if (settled) return;
          settled = true;
          if (err) reject(err); else resolve();
        };

        const writeStream = fs.createWriteStream(filePath, { encoding: 'utf-8' });
        writeStream.on('error', done);

        client.prepare(sql, (prepErr, stmt) => {
          if (prepErr) { writeStream.destroy(); return done(prepErr); }

          stmt.execute([], (execErr, resultSet) => {
            if (execErr) { writeStream.destroy(); return done(execErr); }

            const columns: string[] = ((resultSet as any).metadata ?? [])
              .map((c: any) => c.columnDisplayName ?? c.columnName ?? c.COLUMN_NAME ?? c.name ?? '');
            writeStream.write(columns.map((c) => this.escapeCsvField(c)).join(',') + '\n');

            const rowStream = (resultSet as any).createArrayStream() as NodeJS.ReadableStream;

            rowStream.on('data', (batch: any) => {
              const rows: any[] = Array.isArray(batch) ? batch : [batch];
              let chunk = '';
              for (const row of rows) {
                rowsWritten++;
                obj.rowsWritten = rowsWritten;
                const values = Array.isArray(row) ? row : Object.values(row as object);
                chunk += values.map((v: any) => this.escapeCsvField(v)).join(',') + '\n';
                if (rowsWritten === 1 || rowsWritten % 50 === 0) emitProgress();
              }
              if (!writeStream.write(chunk)) {
                (rowStream as any).pause();
                writeStream.once('drain', () => (rowStream as any).resume());
              }
            });

            rowStream.on('end', () => {
              writeStream.end(() => {
                const elapsed = Date.now() - start;
                obj.rowsWritten = rowsWritten;
                obj.status = 'done';
                this.logger.log(
                  `Exported "${obj.name}" → ${obj.csvFileName} — ${rowsWritten.toLocaleString()} rows (${elapsed}ms)`,
                );
                emitProgress();
                done();
              });
            });

            rowStream.on('error', (err: Error) => {
              this.logger.error(`Stream error for "${obj.name}": ${err.message}`);
              writeStream.destroy();
              done(err);
            });
          });
        });
      });
    } catch (err: any) {
      obj.status = 'failed';
      obj.error = err.message || 'Unknown error';
      this.logger.error(`Export FAILED for "${obj.name}": ${err.message}`, err.stack);
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (_) {}
      emitProgress();
    } finally {
      try { client.disconnect(); } catch (_) {}
    }
  }

  private escapeCsvField(value: any): string {
    if (value === null || value === undefined) return '';
    let str: string;
    if (value instanceof Date) {
      str = value.toISOString();
    } else if (typeof value === 'object') {
      str = typeof value.toJSON === 'function'
        ? value.toJSON()
        : (value.toString !== Object.prototype.toString ? value.toString() : JSON.stringify(value));
    } else {
      str = String(value);
    }
    if (str.includes(',') || str.includes('\n') || str.includes('\r') || str.includes('"')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  getJobOutputDir(_jobId: string): string {
    return this.csvBaseDir;
  }
}
