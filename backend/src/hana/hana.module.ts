import { Module } from '@nestjs/common';
import { HanaService } from './hana.service';

@Module({
  providers: [HanaService],
  exports: [HanaService],
})
export class HanaModule {}
