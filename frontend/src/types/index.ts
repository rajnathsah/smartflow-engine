export type AuthType = 'bearer' | 'apikey' | 'none';
export type DbDialect = 'postgresql' | 'mysql';
export type PipelineStatus = 'active' | 'syncing' | 'idle' | 'failed';

export interface PipelineHeader {
  key: string;
  value: string;
}

export interface SchemaMappingEntry {
  source_key: string;
  target_key: string;
  column_type?: string;
}

export interface Source {
  id: string;
  name: string;
  sourceUrl: string;
  sourceAuthType: AuthType;
  sourceToken?: string;
  sourceHeaders: PipelineHeader[];
}

export interface Destination {
  id: string;
  name: string;
  targetDbDialect: DbDialect;
  targetDbHost: string;
  targetDbPort: number;
  targetDbName: string;
  targetDbUser: string;
  targetDbPassword?: string;
  enableSshBastion: boolean;
}

export interface Pipeline {
  id: string;
  name: string;
  sourceId: string;
  destinationId: string;
  schedule: string;
  
  sourceUrl: string;
  sourceAuthType: AuthType;
  sourceToken?: string;
  sourceHeaders: PipelineHeader[];
  schemaMapping: SchemaMappingEntry[];
  
  targetDbDialect: DbDialect;
  targetDbHost: string;
  targetDbPort: number;
  targetDbName: string;
  targetDbUser: string;
  targetDbPassword?: string;
  enableSshBastion: boolean;
  
  status: PipelineStatus;
  lastSync: string | null;
  recordsSynced: number;
  taskId?: string;
}

export interface EngineMetrics {
  activePipelinesCount: number;
  totalPipelinesCount: number;
  totalRowsSynced: number;
  avgLatencyMs: number;
}

export interface ActivityLog {
  id: string;
  time: string;
  event: string;
  status: 'success' | 'failed' | 'info';
  detail: string;
}
