import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from './config.service';
import { CreateConnectionDto, UpdateConnectionDto } from './dto/connection.dto';

@Controller('api/connections')
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  listConnections() {
    return this.configService.listConnections();
  }

  @Get(':id')
  getConnection(@Param('id') id: string) {
    return this.configService.getConnection(id);
  }

  @Post()
  createConnection(@Body() dto: CreateConnectionDto) {
    return this.configService.createConnection(dto);
  }

  @Patch(':id')
  updateConnection(@Param('id') id: string, @Body() dto: UpdateConnectionDto) {
    return this.configService.updateConnection(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteConnection(@Param('id') id: string) {
    this.configService.deleteConnection(id);
  }

  @Post(':id/test')
  async testConnection(@Param('id') id: string) {
    return this.configService.testConnection(id);
  }
}
