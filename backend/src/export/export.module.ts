import { Module } from '@nestjs/common';
import { ExportService } from './export.service';
import { ExportController } from './export.controller';
import { HanaModule } from '../hana/hana.module';
import { ConfigModule } from '../config/config.module';
import { ProgressModule } from '../progress/progress.module';

@Module({
  imports: [HanaModule, ConfigModule, ProgressModule],
  providers: [ExportService],
  controllers: [ExportController],
  exports: [ExportService],
})
export class ExportModule {}
