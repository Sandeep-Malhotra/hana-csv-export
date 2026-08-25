import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { HanaService } from '../hana/hana.service';
import { ConfigService } from '../config/config.service';
import { CsnService } from '../csn/csn.service';
import { DbObject } from '../export/export.types';

@Injectable()
export class MetadataService {
  private readonly logger = new Logger(MetadataService.name);

  constructor(
    private readonly hanaService: HanaService,
    private readonly configService: ConfigService,
    private readonly csnService: CsnService,
  ) {}

  async getObjects(connectionId: string, search?: string): Promise<DbObject[]> {
    const config = this.configService.getConnection(connectionId);
    this.logger.log(`Fetching objects for schema "${config.schema}" on ${config.host}`);

    const client = await this.hanaService.connect(config);

    try {
      const schema = config.schema;
      const enrich = (rawName: string, type: DbObject['type'], rowCount?: number): DbObject => {
        const csn = this.csnService.resolve(rawName);
        return {
          name: csn?.entityName ?? rawName,
          hanaTableName: rawName,
          csvFileName: csn?.csvFileName ?? `${rawName}.csv`,
          type,
          rowCount,
          isDraft: csn?.isDraft,
        };
      };

      // ── Tables ──────────────────────────────────────────────────────────────
      let tableObjects: DbObject[] = [];
      try {
        const mRows = await this.hanaService.query(
          client,
          `SELECT TABLE_NAME AS "name", CAST(RECORD_COUNT AS BIGINT) AS "rowCount" FROM M_TABLES WHERE SCHEMA_NAME = ?`,
          [schema],
        );
        tableObjects = mRows.map((r: any) =>
          enrich(r.name ?? r.NAME, 'TABLE', r.rowCount !== null && r.rowCount !== undefined ? Number(r.rowCount ?? r.ROWCOUNT) : undefined)
        );
        this.logger.debug(`M_TABLES: ${tableObjects.length} table(s) with row counts`);
      } catch (mErr: any) {
        this.logger.warn(`M_TABLES unavailable (${mErr.message}), falling back to SYS.TABLES`);
        const sysRows = await this.hanaService.query(
          client,
          `SELECT TABLE_NAME AS "name" FROM SYS.TABLES WHERE SCHEMA_NAME = ?`,
          [schema],
        );
        tableObjects = sysRows.map((r: any) => enrich(r.name ?? r.NAME, 'TABLE'));
        this.logger.debug(`SYS.TABLES fallback: ${tableObjects.length} table(s)`);
      }

      // ── Views ────────────────────────────────────────────────────────────────
      const viewRows = await this.hanaService.query(
        client,
        `SELECT VIEW_NAME AS "name" FROM SYS.VIEWS WHERE SCHEMA_NAME = ?`,
        [schema],
      );
      const viewObjects: DbObject[] = viewRows.map((r: any) => enrich(r.name ?? r.NAME, 'VIEW'));

      // ── Synonyms ─────────────────────────────────────────────────────────────
      const synRows = await this.hanaService.query(
        client,
        `SELECT SYNONYM_NAME AS "name" FROM SYS.SYNONYMS WHERE SCHEMA_NAME = ? AND IS_VALID = 'TRUE'`,
        [schema],
      );
      const synonymObjects: DbObject[] = synRows.map((r: any) => enrich(r.name ?? r.NAME, 'SYNONYM'));

      // ── Merge + sort ─────────────────────────────────────────────────────────
      let objects: DbObject[] = [...tableObjects, ...viewObjects, ...synonymObjects];

      // When CSN is loaded, only show objects that have a mapping — skip raw HANA-only tables
      const csnLoaded = this.csnService.getStatus().loaded;
      if (csnLoaded) {
        const before = objects.length;
        objects = objects.filter((o) => this.csnService.resolve(o.hanaTableName) !== undefined);
        this.logger.log(`CSN filter: ${before} → ${objects.length} objects (${before - objects.length} skipped — no CSN mapping)`);
      }

      objects.sort((a, b) => {
        if (a.type !== b.type) return a.type.localeCompare(b.type);
        return a.name.localeCompare(b.name);
      });

      this.logger.log(`Schema "${schema}": ${tableObjects.length} tables, ${viewObjects.length} views, ${synonymObjects.length} synonyms`);

      if (search?.trim()) {
        const lower = search.toLowerCase();
        objects = objects.filter((o) =>
          o.name.toLowerCase().includes(lower) ||
          o.hanaTableName.toLowerCase().includes(lower)
        );
        this.logger.debug(`Search "${search}" → ${objects.length} match(es)`);
      }

      return objects;
    } catch (err: any) {
      this.logger.error(`getObjects failed for connection ${connectionId}: ${err.message}`, err.stack);
      throw new InternalServerErrorException(err.message ?? 'Failed to fetch database objects');
    } finally {
      try { client.disconnect(); } catch (_) {}
    }
  }
}
