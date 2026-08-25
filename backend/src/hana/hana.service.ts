import { Injectable, Logger } from '@nestjs/common';
import * as hdb from 'hdb';

export interface HanaConnectionConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  encrypt: boolean;
  sslValidateCertificate: boolean;
}

export interface HanaClient {
  connect(options: HanaConnectionConfig, callback: (err: Error | null) => void): void;
  connect(callback: (err: Error | null) => void): void;
  exec(sql: string, callback: (err: Error | null, rows: any[]) => void): void;
  exec(sql: string, params: any[], callback: (err: Error | null, rows: any[]) => void): void;
  prepare(
    sql: string,
    callback: (err: Error | null, statement: HanaStatement) => void,
  ): void;
  disconnect(): void;
}

export interface HanaStatement {
  exec(params: any[], callback: (err: Error | null, rows: any[]) => void): void;
  execute(
    params: any[],
    callback: (err: Error | null, resultSet: HanaResultSet) => void,
  ): void;
  drop(callback?: (err: Error | null) => void): void;
}

export interface HanaResultSet {
  next(callback: (err: Error | null, hasNext: boolean) => void): void;
  getValues(): any[];
  getColumnInfo(): Array<{ columnName: string; typeName: string }>;
  close(callback?: (err: Error | null) => void): void;
}

@Injectable()
export class HanaService {
  private readonly logger = new Logger(HanaService.name);

  /** Creates a new hdb client. Caller must connect and disconnect. */
  createConnection(config: HanaConnectionConfig): HanaClient {
    return hdb.createClient({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      encrypt: config.encrypt,
      sslValidateCertificate: config.sslValidateCertificate,
    }) as HanaClient;
  }

  /** Opens a connection and returns it. Caller must call disconnect() when done. */
  async connect(config: HanaConnectionConfig): Promise<HanaClient> {
    const start = Date.now();
    const client = this.createConnection(config);

    await new Promise<void>((resolve, reject) => {
      // hdb connect() accepts (options?, callback) — re-passing config is safe
      client.connect(config, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    this.logger.debug(`Connected to ${config.host}:${config.port} (${Date.now() - start}ms)`);
    return client;
  }

  /**
   * Run a query and return all rows as plain objects.
   *
   * hdb's client.exec(sql, params, cb) treats the params array as batch rows
   * (designed for INSERT batching), so passing [schemaName] leaves the ?
   * placeholder unbound.  For parameterised SELECTs the correct hdb pattern
   * is prepare() → stmt.exec(params, cb), which binds values individually.
   */
  async query(client: HanaClient, sql: string, params: any[] = []): Promise<any[]> {
    const start = Date.now();
    const preview = sql.replace(/\s+/g, ' ').trim().slice(0, 80);

    if (params.length === 0) {
      // No parameters — plain exec is fine
      return new Promise<any[]>((resolve, reject) => {
        client.exec(sql, (err, rows) => {
          if (err) {
            this.logger.error(`Query failed (${Date.now() - start}ms): ${preview} — ${err.message}`);
            reject(err);
          } else {
            this.logger.debug(`Query OK — ${rows.length} rows (${Date.now() - start}ms): ${preview}`);
            resolve(rows);
          }
        });
      });
    }

    // Parameterised query — use prepare + stmt.exec so each ? is bound correctly
    return new Promise<any[]>((resolve, reject) => {
      client.prepare(sql, (prepErr, stmt) => {
        if (prepErr) {
          this.logger.error(`Prepare failed: ${preview} — ${prepErr.message}`);
          return reject(prepErr);
        }

        stmt.exec(params, (execErr, rows) => {
          if (execErr) {
            this.logger.error(`Exec failed (${Date.now() - start}ms): ${preview} — ${execErr.message}`);
            reject(execErr);
          } else {
            this.logger.debug(`Query OK — ${rows.length} rows (${Date.now() - start}ms): ${preview}`);
            resolve(rows);
          }
        });
      });
    });
  }
}
