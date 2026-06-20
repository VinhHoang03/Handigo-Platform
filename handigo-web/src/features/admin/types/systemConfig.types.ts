export type SystemConfigType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON';

export interface SystemConfig {
  id: string;
  key: string;
  value: unknown;
  type: SystemConfigType;
  description: string | null;
  isPublic: boolean;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SystemConfigQuery {
  type?: SystemConfigType | '';
  isPublic?: boolean | '';
  search?: string;
}

export interface SystemConfigPayload {
  key: string;
  value: unknown;
  type: SystemConfigType;
  description?: string | null;
  isPublic: boolean;
}

export type UpdateSystemConfigPayload = Omit<SystemConfigPayload, 'key'>;
