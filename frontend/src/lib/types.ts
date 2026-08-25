export type ObjectType = 'TABLE' | 'VIEW' | 'SYNONYM';

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

export interface CreateConnectionPayload {
  name: string;
  host: string;
  port: number;
  schema: string;
  user: string;
  password: string;
  encrypt: boolean;
  sslValidateCertificate: boolean;
}

export interface UpdateConnectionPayload {
  name?: string;
  host?: string;
  port?: number;
  schema?: string;
  user?: string;
  password?: string;
  encrypt?: boolean;
  sslValidateCertificate?: boolean;
}

export interface DbObject {
  name: string;          // display name (entityName if CSN loaded, otherwise hanaTableName)
  hanaTableName: string; // physical HANA table name
  csvFileName: string;   // output CSV filename
  type: ObjectType;
  rowCount?: number;
  isDraft?: boolean;
}

export interface ExportObjectInput {
  name: string;
  hanaTableName: string;
  csvFileName: string;
  rowCount?: number;
}

export interface CsnStatus {
  loaded: boolean;
  entityCount: number;
}

export type ExportStatus = 'queued' | 'running' | 'done' | 'failed';

export interface ObjectExportState {
  name: string;
  hanaTableName: string;
  csvFileName: string;
  status: ExportStatus;
  rowsWritten: number;
  totalRows?: number;
  error?: string;
  filePath?: string;
}

export interface ExportJob {
  jobId: string;
  connectionId: string;
  connectionName: string;
  objects: ObjectExportState[];
  startedAt: string;
}

export interface ProgressEvent {
  jobId: string;
  objects: ObjectExportState[];
  overallPercent: number;
  done: boolean;
}

export interface TestConnectionResult {
  ok: boolean;
  message: string;
}

// VCAP_SERVICES hana credentials format
export interface VcapHanaCredentials {
  host: string;
  port: number | string;
  schema: string;
  user: string;
  password: string;
  encrypt?: boolean;
  certificate?: string;
}

export interface VcapService {
  credentials: VcapHanaCredentials;
  name?: string;
  label?: string;
  tags?: string[];
}

export interface VcapServices {
  hana?: VcapService[];
  'hana-db'?: VcapService[];
  [key: string]: VcapService[] | undefined;
}

export interface DefaultEnvJson {
  VCAP_SERVICES?: VcapServices;
}
