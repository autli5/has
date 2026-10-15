export interface UserDto {
  email: string;
  username?: string | null;
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
  modified: string;
  user_email: string;
}

export interface ServerUserDto {
  id: number;
  email: string;
  username?: string | null;
  role: string;
  created_at: string;
}

