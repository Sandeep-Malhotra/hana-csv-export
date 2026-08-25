import { Module } from '@nestjs/common';
import { CsnService } from './csn.service';
import { CsnController } from './csn.controller';

@Module({
  controllers: [CsnController],
  providers: [CsnService],
  exports: [CsnService],
})
export class CsnModule {}
