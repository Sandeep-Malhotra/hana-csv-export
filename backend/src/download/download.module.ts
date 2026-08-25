import { Module } from '@nestjs/common';
import { DownloadController } from './download.controller';
import { ExportModule } from '../export/export.module';

@Module({
  imports: [ExportModule],
  controllers: [DownloadController],
})
export class DownloadModule {}
