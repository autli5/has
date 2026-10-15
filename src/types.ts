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

export interface RepositoryDto {
  id: number;
  name: string;
  description?: string | null;
  is_private: boolean;
  owner_email: string;
  owner_username: string;
  default_branch: string;
  clone_url_ssh: string;
  clone_url_alt: string;
  created_at: string;
  updated_at: string;
  size_formatted: string;
  branches_count: number;
  commits_count: number;
  last_commit_msg?: string | null;
  last_commit_date?: string | null;
}

export interface GitTreeItemDto {
  name: string;
  path: string;
  item_type: "blob" | "tree";
  mode: string;
  size_formatted?: string | null;
  last_commit_msg?: string | null;
  last_commit_date?: string | null;
}

export interface GitCommitDto {
  hash: string;
  short_hash: string;
  author_name: string;
  author_email: string;
  date: string;
  message: string;
}

export interface GitFileContentDto {
  name: string;
  path: string;
  size_bytes: number;
  size_formatted: string;
  content: string;
  is_binary: boolean;
}
