export type ObjectType = 'TABLE' | 'VIEW' | 'SYNONYM';

export interface DbObject {
  name: string;           // display name: entityName if CSN loaded, otherwise hanaTableName
  hanaTableName: string;  // physical HANA table name used in SQL
  csvFileName: string;    // output CSV filename (e.g. DemandPPRLineItem.csv)
  type: ObjectType;
  rowCount?: number;
  isDraft?: boolean;
}

export type ExportStatus = 'queued' | 'running' | 'done' | 'failed';

export interface ObjectExportState {
  name: string;           // display name
  hanaTableName: string;  // physical HANA table for SQL
  csvFileName: string;    // output filename
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
