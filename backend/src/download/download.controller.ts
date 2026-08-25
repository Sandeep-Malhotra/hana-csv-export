import {
  Controller,
  Get,
  Param,
  Res,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const archiver = require('archiver') as typeof import('archiver');
import { ExportService } from '../export/export.service';

@Controller('api/download')
export class DownloadController {
  constructor(private readonly exportService: ExportService) {}

  @Get(':jobId/zip')
  async downloadZip(
    @Param('jobId') jobId: string,
    @Res() res: Response,
  ): Promise<void> {
    const job = this.exportService.getJob(jobId);
    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    // Collect all completed CSV files
    const completedFiles = job.objects
      .filter((o) => o.status === 'done' && o.filePath)
      .map((o) => o.filePath!);

    if (completedFiles.length === 0) {
      throw new HttpException(
        'No completed files to zip',
        HttpStatus.BAD_REQUEST,
      );
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="export-${jobId}.zip"`,
    );

    const archive = archiver('zip', { zlib: { level: 6 } });

    archive.on('error', (err: Error) => {
      res.status(500).end(`Archive error: ${err.message}`);
    });

    archive.pipe(res);

    for (const filePath of completedFiles) {
      if (fs.existsSync(filePath)) {
        const fileName = path.basename(filePath);
        archive.file(filePath, { name: fileName });
      }
    }

    await archive.finalize();
  }

  @Get(':jobId/:filename')
  async downloadFile(
    @Param('jobId') jobId: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ): Promise<void> {
    const safeFilename = path.basename(filename);
    if (!safeFilename.endsWith('.csv')) {
      throw new HttpException('Invalid file type', HttpStatus.BAD_REQUEST);
    }

    const job = this.exportService.getJob(jobId);
    if (!job) throw new NotFoundException(`Job ${jobId} not found`);

    const obj = job.objects.find(
      (o) => o.filePath && path.basename(o.filePath) === safeFilename && o.status === 'done',
    );
    if (!obj?.filePath || !fs.existsSync(obj.filePath)) {
      throw new NotFoundException(`File ${safeFilename} not found for job ${jobId}`);
    }

    const stat = fs.statSync(obj.filePath);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    fs.createReadStream(obj.filePath).pipe(res);
  }
}
