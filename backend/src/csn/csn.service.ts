import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface CsnEntity {
  entityName: string;
  namespace: string;
  hanaTableName: string;
  isDraft: boolean;
  csvFileName: string;
}

@Injectable()
export class CsnService {
  private readonly logger = new Logger(CsnService.name);
  private readonly filePath: string;
  private entityMap = new Map<string, CsnEntity>();

  constructor() {
    this.filePath = path.join(process.cwd(), '..', '.env', 'csn.json');
    this.tryLoadFromDisk();
  }

  private tryLoadFromDisk(): void {
    if (!fs.existsSync(this.filePath)) return;
    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      this.parseCsn(JSON.parse(raw));
      this.logger.log(`Loaded csn.json — ${this.entityMap.size} table entries`);
    } catch (e: any) {
      this.logger.warn(`Failed to load csn.json: ${e.message}`);
    }
  }

  saveAndParse(content: string): { entityCount: number } {
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new BadRequestException('Invalid JSON — cannot parse csn.json content');
    }
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.filePath, content, 'utf-8');
    this.parseCsn(parsed);
    this.logger.log(`Saved and parsed csn.json — ${this.entityMap.size} table entries`);
    return { entityCount: this.entityMap.size };
  }

  clear(): void {
    this.entityMap.clear();
    if (fs.existsSync(this.filePath)) fs.unlinkSync(this.filePath);
    this.logger.log('Cleared csn.json');
  }

  private parseCsn(csn: any): void {
    this.entityMap.clear();
    const defs: Record<string, any> = csn?.definitions ?? {};
    for (const [fqn, def] of Object.entries(defs)) {
      if (def?.kind !== 'entity') continue;
      if (def['@cds.persistence.skip'] === true) continue;

      const lastDot = fqn.lastIndexOf('.');
      const entityName = lastDot >= 0 ? fqn.slice(lastDot + 1) : fqn;
      const namespace = lastDot >= 0 ? fqn.slice(0, lastDot) : '';
      const baseHanaTable = fqn.replace(/\./g, '_').toUpperCase();
      const isDraftEnabled = def['@fiori.draft.enabled'] === true;
      const csvFileName = `${entityName}.csv`;

      this.entityMap.set(baseHanaTable, {
        entityName, namespace, hanaTableName: baseHanaTable, isDraft: false, csvFileName,
      });
      if (isDraftEnabled) {
        this.entityMap.set(baseHanaTable + '_DRAFTS', {
          entityName, namespace, hanaTableName: baseHanaTable + '_DRAFTS', isDraft: true, csvFileName,
        });
      }
    }
    this.logger.debug(`Parsed ${Object.keys(defs).length} definitions → ${this.entityMap.size} table entries`);
  }

  resolve(hanaTableName: string): CsnEntity | undefined {
    return this.entityMap.get(hanaTableName.toUpperCase());
  }

  getStatus(): { loaded: boolean; entityCount: number } {
    return { loaded: this.entityMap.size > 0, entityCount: this.entityMap.size };
  }
}
