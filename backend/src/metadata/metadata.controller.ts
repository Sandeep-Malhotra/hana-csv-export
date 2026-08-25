import { Controller, Get, Param, Query, Logger } from '@nestjs/common';
import { MetadataService } from './metadata.service';

@Controller('api/metadata')
export class MetadataController {
  private readonly logger = new Logger(MetadataController.name);

  constructor(private readonly metadataService: MetadataService) {}

  @Get(':connectionId/objects')
  async getObjects(
    @Param('connectionId') connectionId: string,
    @Query('search') search?: string,
  ) {
    this.logger.debug(`GET objects — connectionId=${connectionId} search="${search ?? ''}"`);
    return this.metadataService.getObjects(connectionId, search);
  }
}
