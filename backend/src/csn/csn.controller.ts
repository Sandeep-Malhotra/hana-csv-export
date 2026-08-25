import { Controller, Get, Post, Delete, Body, BadRequestException } from '@nestjs/common';
import { CsnService } from './csn.service';

@Controller('api/csn')
export class CsnController {
  constructor(private readonly csnService: CsnService) {}

  @Get('status')
  getStatus() {
    return this.csnService.getStatus();
  }

  @Post()
  importCsn(@Body() body: { content?: string }) {
    if (!body?.content?.trim()) {
      throw new BadRequestException('content is required');
    }
    return this.csnService.saveAndParse(body.content);
  }

  @Delete()
  clearCsn() {
    this.csnService.clear();
    return { ok: true };
  }
}
