import { Module } from '@nestjs/common';
import { MetadataService } from './metadata.service';
import { MetadataController } from './metadata.controller';
import { HanaModule } from '../hana/hana.module';
import { ConfigModule } from '../config/config.module';
import { CsnModule } from '../csn/csn.module';

@Module({
  imports: [HanaModule, ConfigModule, CsnModule],
  controllers: [MetadataController],
  providers: [MetadataService],
})
export class MetadataModule {}
