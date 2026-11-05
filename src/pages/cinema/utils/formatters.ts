import type { CinemaMediaItem, CinemaSeason } from "../../../types";

export const buildAnimeSeasons = (
  seasonConfigs: { season_number: number; count: number }[],
  thumb: string
): CinemaSeason[] => {
  return seasonConfigs.map((cfg) => ({
    season_number: cfg.season_number,
    episodes: Array.from({ length: cfg.count }, (_, i) => ({
      id: `demonic-s${cfg.season_number}-e${i + 1}`,
      number: i + 1,
      title: `Серия ${i + 1}`,
      thumbnail: thumb,
      duration_minutes: 24,
    })),
  }));
};

export const formatCurrency = (amount?: number): string | null => {
  if (!amount || amount <= 0) return null;
  if (amount >= 1_000_000_000) {
    return `$${(amount / 1_000_000_000).toFixed(2)} млрд ($${amount.toLocaleString("ru-RU")})`;
  }
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1)} млн ($${amount.toLocaleString("ru-RU")})`;
  }
  return `$${amount.toLocaleString("ru-RU")}`;
};

export const formatRuntime = (minutes?: number): string | null => {
  if (!minutes || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) return `${hours} ч ${mins} мин`;
  if (hours > 0) return `${hours} ч`;
  return `${mins} мин`;
};

export const getMediaCategoryLabel = (media: CinemaMediaItem | null | undefined): string => {
  if (!media) return "Сериал";
  const g = (media.genre || "").toLowerCase();
  const isAnime = g.includes("аниме") || g.includes("anime");
  const isCartoon = g.includes("мультфильм") || g.includes("анимация") || g.includes("animation");

  if (media.media_type === "movie") {
    if (isAnime) return "Аниме-фильм";
    if (isCartoon) return "Мультфильм";
    return "Фильм";
  }

  if (isAnime) return "Аниме-сериал";
  if (isCartoon) return "Мультсериал";
  return "Сериал";
};

export const getMediaBadgeLabel = (media: CinemaMediaItem | null | undefined): string => {
  return getMediaCategoryLabel(media).toUpperCase();
};

export const formatMediaImg = (path: string | null | undefined, size: "w500" | "original" = "w500"): string => {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `https://wsrv.nl/?url=https://image.tmdb.org/t/p/${size}${path}`;
};

export const detectTvEnvironment = (): boolean => {
  if (typeof window === "undefined") return false;
  const ua = (navigator.userAgent || "").toLowerCase();
  const isTvUa =
    ua.includes("android tv") ||
    ua.includes("smarttv") ||
    ua.includes("googletv") ||
    ua.includes("tizen") ||
    ua.includes("webos") ||
    ua.includes("appletv") ||
    ua.includes("crkey") ||
    ua.includes("bravia") ||
    ua.includes("aftt") ||
    ua.includes("aftm") ||
    ua.includes("mibox") ||
    ua.includes("mi box") ||
    ua.includes("shield") ||
    ua.includes("dtv") ||
    ua.includes("smart-tv") ||
    ua.includes("hbbtv") ||
    ua.includes("netcast") ||
    ua.includes("viera") ||
    ua.includes("roku") ||
    ua.includes("firetv");
  if (isTvUa) return true;
  const isAndroid = ua.includes("android");
  const noTouch = !("ontouchstart" in window) && navigator.maxTouchPoints === 0;
  if (isAndroid && noTouch) return true;

  const isDesktop =
    (ua.includes("windows nt") || ua.includes("macintosh") || (ua.includes("linux") && !ua.includes("android"))) &&
    !isTvUa;
  if (isDesktop) {
    return localStorage.getItem("has_tv_mode_manual") === "true";
  }

  const saved = localStorage.getItem("has_tv_mode");
  if (saved !== null) return saved === "true";
  return false;
};
