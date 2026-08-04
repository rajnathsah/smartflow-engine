export type AuthType = 'bearer' | 'apikey' | 'none';
export type DbDialect = 'postgresql' | 'mysql' | 'redshift' | 'snowflake' | 'bigquery';
export type PipelineStatus = 'active' | 'syncing' | 'idle' | 'failed';
export type FieldDataType = 'string' | 'integer' | 'boolean' | 'timestamp' | 'float' | 'json';
export type FieldTransformation = 'none' | 'uppercase' | 'lowercase' | 'trim' | 'cast';

export interface PipelineHeader {
  key: string;
  value: string;
}

export interface FieldMapping {
  source_field: string;
  target_field: string;
  data_type: FieldDataType;
  transformation: FieldTransformation;
}

export interface SchemaMappingConfig {
  mappings: FieldMapping[];
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
  schemaMapping: SchemaMappingConfig | null;
  
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
  error?: string;
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
