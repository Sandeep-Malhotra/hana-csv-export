import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { IsNumber, Min, Max } from 'class-validator';
import { ExportService, getMaxConcurrent, setMaxConcurrent } from './export.service';
import { StartExportDto } from './dto/start-export.dto';

class UpdateSettingsDto {
  @IsNumber()
  @Min(1)
  @Max(20)
  maxConcurrent: number;
}

@Controller('api/export')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Post()
  async startExport(@Body() dto: StartExportDto) {
    const jobId = await this.exportService.startExport(
      dto.connectionId,
      dto.objects,
    );
    return { jobId };
  }

  @Get('jobs')
  getJobs() {
    return this.exportService.getJobs();
  }

  @Get('jobs/:jobId')
  getJob(@Param('jobId') jobId: string) {
    const job = this.exportService.getJob(jobId);
    if (!job) {
      return { error: 'Job not found' };
    }
    return job;
  }

  @Get('settings')
  getSettings() {
    return { maxConcurrent: getMaxConcurrent() };
  }

  @Post('settings')
  updateSettings(@Body() dto: UpdateSettingsDto) {
    setMaxConcurrent(dto.maxConcurrent);
    return { maxConcurrent: getMaxConcurrent() };
  }
}
