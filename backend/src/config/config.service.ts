import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { HanaService } from '../hana/hana.service';
import { CreateConnectionDto, UpdateConnectionDto } from './dto/connection.dto';

export interface Connection {
  id: string;
  name: string;
  host: string;
  port: number;
  schema: string;
  user: string;
  password: string;
  encrypt: boolean;
  sslValidateCertificate: boolean;
  createdAt: string;
}

interface ConnectionsFile {
  connections: Connection[];
}

@Injectable()
export class ConfigService {
  private readonly logger = new Logger(ConfigService.name);
  private readonly filePath: string;

  constructor(private readonly hanaService: HanaService) {
    // Resolve .env/connections.json relative to project root (one level above backend/)
    this.filePath = path.join(process.cwd(), '..', '.env', 'connections.json');
    this.ensureFile();
    this.logger.log(`Connections file: ${this.filePath}`);
  }

  private ensureFile(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(
        this.filePath,
        JSON.stringify({ connections: [] }, null, 2),
        'utf-8',
      );
      this.logger.log('Created new connections file');
    }
  }

  private readFile(): ConnectionsFile {
    const raw = fs.readFileSync(this.filePath, 'utf-8');
    return JSON.parse(raw) as ConnectionsFile;
  }

  private writeFile(data: ConnectionsFile): void {
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  listConnections(): Connection[] {
    const conns = this.readFile().connections;
    this.logger.debug(`Listed ${conns.length} connection(s)`);
    return conns;
  }

  getConnection(id: string): Connection {
    const conn = this.readFile().connections.find((c) => c.id === id);
    if (!conn) {
      this.logger.warn(`Connection not found: ${id}`);
      throw new NotFoundException(`Connection ${id} not found`);
    }
    return conn;
  }

  createConnection(dto: CreateConnectionDto): Connection {
    const data = this.readFile();
    const newConn: Connection = {
      id: uuidv4(),
      name: dto.name,
      host: dto.host,
      port: dto.port ?? 443,
      schema: dto.schema,
      user: dto.user,
      password: dto.password,
      encrypt: dto.encrypt ?? true,
      sslValidateCertificate: dto.sslValidateCertificate ?? false,
      createdAt: new Date().toISOString(),
    };
    data.connections.push(newConn);
    this.writeFile(data);
    this.logger.log(`Created connection "${newConn.name}" (${newConn.id}) → ${newConn.host}:${newConn.port}`);
    return newConn;
  }

  updateConnection(id: string, dto: UpdateConnectionDto): Connection {
    const data = this.readFile();
    const idx = data.connections.findIndex((c) => c.id === id);
    if (idx === -1) {
      this.logger.warn(`Update failed — connection not found: ${id}`);
      throw new NotFoundException(`Connection ${id} not found`);
    }
    data.connections[idx] = { ...data.connections[idx], ...dto };
    this.writeFile(data);
    this.logger.log(`Updated connection "${data.connections[idx].name}" (${id})`);
    return data.connections[idx];
  }

  deleteConnection(id: string): void {
    const data = this.readFile();
    const idx = data.connections.findIndex((c) => c.id === id);
    if (idx === -1) {
      this.logger.warn(`Delete failed — connection not found: ${id}`);
      throw new NotFoundException(`Connection ${id} not found`);
    }
    const name = data.connections[idx].name;
    data.connections.splice(idx, 1);
    this.writeFile(data);
    this.logger.log(`Deleted connection "${name}" (${id})`);
  }

  async testConnection(id: string): Promise<{ ok: boolean; message: string }> {
    const config = this.getConnection(id);
    this.logger.log(`Testing connection "${config.name}" → ${config.host}:${config.port}`);
    const start = Date.now();
    const conn = this.hanaService.createConnection(config);

    try {
      await new Promise<void>((resolve, reject) => {
        conn.connect(config, (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });

      await new Promise<void>((resolve, reject) => {
        conn.exec('SELECT 1 FROM DUMMY', (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });

      const elapsed = Date.now() - start;
      this.logger.log(`Connection test OK for "${config.name}" (${elapsed}ms)`);
      return { ok: true, message: `Connection successful (${elapsed}ms)` };
    } catch (e: any) {
      const elapsed = Date.now() - start;
      this.logger.warn(`Connection test FAILED for "${config.name}" (${elapsed}ms): ${e.message}`);
      return { ok: false, message: e.message || 'Connection failed' };
    } finally {
      try {
        conn.disconnect();
      } catch (_) {
        // ignore
      }
    }
  }
}
