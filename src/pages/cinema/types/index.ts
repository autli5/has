export interface RoomParticipant {
  user_email: string;
  user_name: string;
  is_host: boolean;
  last_seen_epoch: number;
}

export interface WatchRoom {
  room_code: string;
  host_email: string;
  host_name: string;
  media_id: string;
  media_title: string;
  media_type: string;
  poster_path?: string | null;
  season: number;
  episode: number;
  current_time_seconds: number;
  is_playing: boolean;
  updated_by: string;
  updated_at_epoch: number;
  participants: RoomParticipant[];
}

export type BalancerMirror =
  | "vidlink_pro"
  | "kodik_ru"
  | "autoembed"
  | "vidsrc_pm"
  | "multiembed"
  | "vidsrc_to"
  | "alloha_ru"
  | "anilibria"
  | "embess_ru"
  | "smotrim_ru";

export interface RawTmdbItem {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  backdrop_path?: string | null;
  poster_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  overview?: string;
  vote_average?: number;
  vote_count?: number;
  media_type?: "movie" | "tv";
  number_of_seasons?: number;
  genre_ids?: number[];
  status?: string;
}

export interface KodikSearchResult {
  id: string;
  title: string;
  title_orig?: string;
  year?: number;
  kinopoisk_id?: string;
  imdb_id?: string;
  link: string;
  type?: "anime-serial" | "serial" | "film" | "anime";
  translation?: {
    id: number;
    title: string;
  };
}

export interface AllohaSearchResult {
  id: number;
  name: string;
  name_original?: string;
  iframe_url?: string;
  type?: string;
}
