export interface UserDto {
  email: string;
  username?: string | null;
  role?: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  user?: UserDto | null;
}

export interface ResetRequestResponse {
  success: boolean;
  message: string;
  dev_code?: string | null;
}

export interface DbStatus {
  connected: boolean;
  host: string;
  dbname: string;
  message: string;
}

export interface SafeDbInfo {
  host: string;
  port: number;
  user: string;
  dbname: string;
  ssl_mode: string;
  users_table: string;
  email_column: string;
}

export interface StorageStats {
  total_bytes: number;
  used_bytes: number;
  free_bytes: number;
  percent_used: number;
  total_formatted: string;
  used_formatted: string;
  free_formatted: string;
}

export interface StorageItemDto {
  id: string;
  name: string;
  size_formatted: string;
  size_bytes: number;
  item_type: "folder" | "file";
  folder_id?: number | null;
  modified: string;
  user_email: string;
}

export interface ServerFileDownloadDto {
  id: number;
  name: string;
  mime_type?: string | null;
  size_bytes: number;
  content_base64: string;
}

export interface ServerUserDto {
  id: number;
  email: string;
  username?: string | null;
  role: string;
  created_at: string;
}

export interface DeviceSecurityInfo {
  current_device_name: string;
  current_ip: string;
  is_admin: boolean;
  device_binding_enabled: boolean;
  trusted_device_name?: string | null;
  ip_binding_enabled: boolean;
  trusted_ip?: string | null;
  is_device_allowed: boolean;
  is_ip_allowed: boolean;
  can_admin_manage: boolean;
}

export type ParaFolder = "00_Inbox" | "01_Projects" | "02_Areas" | "03_Resources" | "04_Archive";
export type NoteType = "inbox" | "project" | "area" | "resource" | "archive";
export type NoteStatus = "draft" | "in-progress" | "completed" | "permanent";

export interface NoteSummaryDto {
  id: number;
  title: string;
  folder: ParaFolder;
  note_type: NoteType;
  status: NoteStatus;
  tags: string[];
  links: string[];
  summary?: string | null;
  updated_at: string;
  created_at: string;
}

export interface NoteDetailDto {
  id: number;
  title: string;
  folder: ParaFolder;
  note_type: NoteType;
  status: NoteStatus;
  tags: string[];
  links: string[];
  summary?: string | null;
  content: string;
  file_path?: string | null;
  updated_at: string;
  created_at: string;
}

export interface NoteSaveDto {
  id?: number | null;
  title: string;
  folder: ParaFolder;
  note_type: NoteType;
  status: NoteStatus;
  tags: string[];
  links: string[];
  summary?: string | null;
  content: string;
}

export interface NotesStatsDto {
  total_notes: number;
  inbox_count: number;
  projects_count: number;
  areas_count: number;
  resources_count: number;
  archive_count: number;
  all_tags: string[];
}

