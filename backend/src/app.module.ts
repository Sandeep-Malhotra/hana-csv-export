import { Module } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import { ConfigModule } from './config/config.module';
import { HanaModule } from './hana/hana.module';
import { MetadataModule } from './metadata/metadata.module';
import { ExportModule } from './export/export.module';
import { ProgressModule } from './progress/progress.module';
import { DownloadModule } from './download/download.module';
import { CsnModule } from './csn/csn.module';
import { winstonOptions } from './logger/winston.config';

@Module({
  imports: [
    WinstonModule.forRoot(winstonOptions),
    ConfigModule,
    HanaModule,
    CsnModule,
    MetadataModule,
    ExportModule,
    ProgressModule,
    DownloadModule,
  ],
})
export class AppModule {}
