export interface UserDto {
  email: string;
  username?: string | null;
  role?: string;
  avatar?: string | null;
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

export interface UserProfileDto {
  id: number;
  email: string;
  username?: string | null;
  role: string;
  avatar?: string | null;
  bio?: string | null;
  notify_email: boolean;
  notify_sound: boolean;
  notify_security: boolean;
  created_at: string;
}

export interface UserProfileSaveDto {
  username?: string | null;
  avatar?: string | null;
  bio?: string | null;
  notify_email: boolean;
  notify_sound: boolean;
  notify_security: boolean;
}

export interface CinemaPlayback {
  title_id: string;
  title_name: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  season: number;
  episode: number;
  progress_seconds: number;
  duration_seconds: number;
  last_watched: string;
}

export interface CinemaState {
  bookmarks: string[];
  history: CinemaPlayback[];
}

export interface CinemaConfig {
  tmdb_api_key?: string | null;
}

export interface CinemaEpisode {
  id: string;
  number: number;
  title: string;
  thumbnail: string;
  duration_minutes?: number;
  description?: string;
  stream_url?: string;
}

export interface CinemaSeason {
  season_number: number;
  episodes: CinemaEpisode[];
}

export interface CinemaMediaItem {
  id: string;
  tmdb_id?: number;
  media_type?: "movie" | "tv";
  title: string;
  original_title?: string;
  backdrop_url: string;
  poster_url: string;
  release_year: number | string;
  seasons_count?: number;
  duration_minutes?: number;
  genre: string;
  rating: number | string;
  synopsis: string;
  is_original?: boolean;
  seasons: CinemaSeason[];
}


