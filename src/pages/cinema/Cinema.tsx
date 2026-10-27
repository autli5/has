import { useState, useEffect, useRef, useCallback } from "react";
import Hls from "hls.js";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  playTvBeep as playTvBeepAudio,
  playTvNavBeep,
  playTvSelectBeep,
  playTvBackBeep,
} from "../../utils/tvAudio";
import type {
  CinemaState,
  CinemaConfig,
  CinemaMediaItem,
  CinemaSeason,
  CinemaEpisode,
  CinemaPlayback,
  UserDto,
} from "../../types";
import "./Cinema.css";

interface CinemaProps {
  currentUser: UserDto;
  onNavigateTab?: (tab: string) => void;
  onLogout?: () => void;
  isTvEnvironment?: boolean;
}

const buildAnimeSeasons = (seasonConfigs: { season_number: number; count: number }[], thumb: string): CinemaSeason[] => {
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

const formatCurrency = (amount?: number): string | null => {
  if (!amount || amount <= 0) return null;
  if (amount >= 1_000_000_000) {
    return `$${(amount / 1_000_000_000).toFixed(2)} млрд ($${amount.toLocaleString("ru-RU")})`;
  }
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1)} млн ($${amount.toLocaleString("ru-RU")})`;
  }
  return `$${amount.toLocaleString("ru-RU")}`;
};

const formatRuntime = (minutes?: number): string | null => {
  if (!minutes || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) return `${hours} ч ${mins} мин`;
  if (hours > 0) return `${hours} ч`;
  return `${mins} мин`;
};

// Accurate media category label (never confuses live-action series with anime)
const getMediaCategoryLabel = (media: CinemaMediaItem | null | undefined): string => {
  if (!media) return "Сериал";
  const g = (media.genre || "").toLowerCase();
  const isAnime = g.includes("аниме") || g.includes("anime");
  const isCartoon = g.includes("мультфильм") || g.includes("анимация") || g.includes("animation");

  if (media.media_type === "movie") {
    if (isAnime) return "Аниме-фильм";
    if (isCartoon) return "Мультфильм";
    return "Фильм";
  }

  // TV / Series
  if (isAnime) return "Аниме-сериал";
  if (isCartoon) return "Мультсериал";
  return "Сериал";
};

const getMediaBadgeLabel = (media: CinemaMediaItem | null | undefined): string => {
  return getMediaCategoryLabel(media).toUpperCase();
};

// Initial Curated Fallback Library
const INITIAL_LIBRARY: CinemaMediaItem[] = [
  {
    id: "demonic-slash",
    tmdb_id: 85937,
    media_type: "tv",
    title: "Клинок, рассекающий демонов",
    original_title: "Kimetsu no Yaiba",
    backdrop_url: "https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=1600&auto=format&fit=crop",
    poster_url: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?q=80&w=600&auto=format&fit=crop",
    release_year: 2024,
    seasons_count: 4,
    genre: "Аниме / Сёнэн",
    rating: 4.9,
    tagline: "Разруби свою судьбу клинком",
    countries: "Япония",
    director: "Харуо Сотодзаки",
    cast: [
      { id: 21, name: "Нацуки Ханаэ", character: "Танджиро Камадо" },
      { id: 22, name: "Акари Кито", character: "Незуко Камадо" },
      { id: 23, name: "Хиро Симоно", character: "Зеницу Агацума" },
      { id: 24, name: "Ёсицугу Мацуока", character: "Иноске Хашибира" },
    ],
    synopsis:
      "Танджиро Камадо становится истребителем демонов, чтобы спасти свою сестру Незуко, превращенную в демона, и отомстить за гибель своей семьи.",
    is_original: true,
    seasons: buildAnimeSeasons(
      [
        { season_number: 1, count: 26 },
        { season_number: 2, count: 11 },
        { season_number: 3, count: 11 },
        { season_number: 4, count: 8 },
      ],
      "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?q=80&w=600&auto=format&fit=crop"
    ),
  },
  {
    id: "dune-part-two",
    tmdb_id: 693134,
    media_type: "movie",
    title: "Дюна: Часть вторая",
    original_title: "Dune: Part Two",
    backdrop_url: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=1600&auto=format&fit=crop",
    poster_url: "https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=600&auto=format&fit=crop",
    release_year: 2024,
    duration_minutes: 166,
    genre: "Фантастика / Приключения",
    rating: 4.9,
    tagline: "Да пребудет с вами сила пустыни",
    budget: 190000000,
    revenue: 711844358,
    countries: "США, Канада",
    director: "Дени Вильнёв",
    cast: [
      { id: 1, name: "Тимоти Шаламе", character: "Пол Атрейдес" },
      { id: 2, name: "Зендея", character: "Чани" },
      { id: 3, name: "Ребекка Фергюсон", character: "Леди Джессика" },
      { id: 4, name: "Хавьер Бардем", character: "Стилгар" },
      { id: 5, name: "Остин Батлер", character: "Фейд-Раута" },
      { id: 6, name: "Флоренс Пью", character: "Принцесса Ирулан" },
    ],
    synopsis:
      "Герцог Пол Атрейдес объединяется с фременами, чтобы отомстить заговорщикам, уничтожившим его семью. Эпическое продолжение борьбы за Арракис.",
    is_original: false,
    seasons: [],
  },
  {
    id: "interstellar",
    tmdb_id: 157336,
    media_type: "movie",
    title: "Интерстеллар",
    original_title: "Interstellar",
    backdrop_url: "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?q=80&w=1600&auto=format&fit=crop",
    poster_url: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=600&auto=format&fit=crop",
    release_year: 2014,
    duration_minutes: 169,
    genre: "Фантастика / Драма",
    rating: 4.9,
    tagline: "Следующий шаг человечества станет величайшим",
    budget: 165000000,
    revenue: 701729206,
    countries: "США, Великобритания",
    director: "Кристофер Нолан",
    cast: [
      { id: 11, name: "Мэттью Макконахи", character: "Купер" },
      { id: 12, name: "Энн Хэтэуэй", character: "Бренд" },
      { id: 13, name: "Джессика Честейн", character: "Мёрф" },
      { id: 14, name: "Майкл Кейн", character: "Профессор Бренд" },
      { id: 15, name: "Мэтт Дэймон", character: "Манн" },
    ],
    synopsis:
      "Когда засуха приводит человечество к глобальному продовольственному кризису, группа ученых отправляется сквозь червоточину в поисках нового дома для людей.",
    is_original: false,
    seasons: [],
  },
  {
    id: "arcane",
    tmdb_id: 94605,
    media_type: "tv",
    title: "Аркейн",
    original_title: "Arcane: League of Legends",
    backdrop_url: "https://images.unsplash.com/photo-1563089145-599997674d42?q=80&w=1600&auto=format&fit=crop",
    poster_url: "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?q=80&w=600&auto=format&fit=crop",
    release_year: 2024,
    seasons_count: 2,
    genre: "Анимация / Экшен",
    rating: 4.9,
    tagline: "Каждая легенда с чего-то начинается",
    countries: "США, Франция",
    director: "Паскаль Шаррю, Арно Делорд",
    cast: [
      { id: 31, name: "Хейли Стайнфелд", character: "Вай" },
      { id: 32, name: "Элла Пернелл", character: "Джинкс" },
      { id: 33, name: "Кэти Льюнг", character: "Кейтлин" },
    ],
    synopsis:
      "История двух сестер, Джинкс и Вай, оказавшихся по разные стороны баррикад в войне между технологическим Пилтовером и преступным Зауном.",
    is_original: false,
    seasons: [
      {
        season_number: 1,
        episodes: Array.from({ length: 9 }, (_, i) => ({
          id: `arcane-1-${i + 1}`,
          number: i + 1,
          title: `Серия ${i + 1}`,
          thumbnail: "https://images.unsplash.com/photo-1563089145-599997674d42?q=80&w=600&auto=format&fit=crop",
          duration_minutes: 41,
        })),
      },
      {
        season_number: 2,
        episodes: Array.from({ length: 9 }, (_, i) => ({
          id: `arcane-2-${i + 1}`,
          number: i + 1,
          title: `Серия ${i + 1}`,
          thumbnail: "https://images.unsplash.com/photo-1563089145-599997674d42?q=80&w=600&auto=format&fit=crop",
          duration_minutes: 42,
        })),
      },
    ],
  },
  {
    id: "breaking-bad",
    tmdb_id: 1396,
    media_type: "tv",
    title: "Во все тяжкие",
    original_title: "Breaking Bad",
    backdrop_url: "https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=1600&auto=format&fit=crop",
    poster_url: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=600&auto=format&fit=crop",
    release_year: 2013,
    seasons_count: 5,
    genre: "Криминал / Драма",
    rating: 5.0,
    synopsis:
      "Школьный учитель химии Уолтер Уайт узнает о смертельном диагнозе и вместе с бывшим учеником начинает варить метамфетамин, чтобы обеспечить семью.",
    is_original: false,
    seasons: [
      {
        season_number: 1,
        episodes: Array.from({ length: 7 }, (_, i) => ({
          id: `bb-1-${i + 1}`,
          number: i + 1,
          title: `Серия ${i + 1}`,
          thumbnail: "https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=600&auto=format&fit=crop",
          duration_minutes: 48,
        })),
      },
      {
        season_number: 2,
        episodes: Array.from({ length: 13 }, (_, i) => ({
          id: `bb-2-${i + 1}`,
          number: i + 1,
          title: `Серия ${i + 1}`,
          thumbnail: "https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=600&auto=format&fit=crop",
          duration_minutes: 47,
        })),
      },
      {
        season_number: 3,
        episodes: Array.from({ length: 13 }, (_, i) => ({
          id: `bb-3-${i + 1}`,
          number: i + 1,
          title: `Серия ${i + 1}`,
          thumbnail: "https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=600&auto=format&fit=crop",
          duration_minutes: 47,
        })),
      },
      {
        season_number: 4,
        episodes: Array.from({ length: 13 }, (_, i) => ({
          id: `bb-4-${i + 1}`,
          number: i + 1,
          title: `Серия ${i + 1}`,
          thumbnail: "https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=600&auto=format&fit=crop",
          duration_minutes: 47,
        })),
      },
      {
        season_number: 5,
        episodes: Array.from({ length: 16 }, (_, i) => ({
          id: `bb-5-${i + 1}`,
          number: i + 1,
          title: `Серия ${i + 1}`,
          thumbnail: "https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=600&auto=format&fit=crop",
          duration_minutes: 47,
        })),
      },
    ],
  },
  {
    id: "oppenheimer",
    tmdb_id: 872585,
    media_type: "movie",
    title: "Оппенгеймер",
    original_title: "Oppenheimer",
    backdrop_url: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=1600&auto=format&fit=crop",
    poster_url: "https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=600&auto=format&fit=crop",
    release_year: 2023,
    duration_minutes: 180,
    genre: "Драма / История",
    rating: 4.9,
    synopsis: "История американского физика-теоретика Роберта Оппенгеймера, руководителя Манхэттенского проекта во время Второй мировой войны.",
    is_original: false,
    seasons: [],
  },
  {
    id: "jujutsu-kaisen",
    tmdb_id: 95479,
    media_type: "tv",
    title: "Магическая битва",
    original_title: "Jujutsu Kaisen",
    backdrop_url: "https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=1600&auto=format&fit=crop",
    poster_url: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?q=80&w=600&auto=format&fit=crop",
    release_year: 2020,
    seasons_count: 2,
    genre: "Аниме / Экшен",
    rating: 4.9,
    synopsis: "Юдзи Итадори проглатывает палец могущественного демона Рёмэна Сукуны и вступает в Токийский магический колледж.",
    is_original: true,
    seasons: buildAnimeSeasons(
      [
        { season_number: 1, count: 24 },
        { season_number: 2, count: 23 },
      ],
      "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?q=80&w=600&auto=format&fit=crop"
    ),
  },
];

interface RawTmdbItem {
  id: number;
  title?: string;
  name?: string;
  original_name?: string;
  original_title?: string;
  media_type?: string;
  poster_path?: string;
  backdrop_path?: string;
  overview?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  vote_count?: number;
  genre_ids?: number[];
  number_of_seasons?: number;
  status?: string;
}

// Filter out titles that have not yet been released or are unstreamable announcements
const isMediaReleased = (item: RawTmdbItem): boolean => {
  const today = new Date().toISOString().slice(0, 10);
  const dateStr = item.release_date || item.first_air_date;

  // 1. If release date is in the future, it is not yet released
  if (dateStr && dateStr > today) {
    return false;
  }

  // 2. If it has no release date at all or invalid year
  if (!dateStr || dateStr.trim().length < 4) {
    return false;
  }

  // 3. Status checks: upcoming or unproduced titles
  if (
    item.status &&
    (item.status === "Planned" ||
      item.status === "In Production" ||
      item.status === "Post Production" ||
      item.status === "Rumored")
  ) {
    return false;
  }

  // 4. Low-vote / announcement filter: titles with < 20 votes on TMDB
  // are almost exclusively unreleased festival announcements or dead unstreamable metadata
  if (item.vote_count !== undefined && item.vote_count < 20) {
    return false;
  }

  // 5. Very low rating with low votes filter
  if (item.vote_average !== undefined && item.vote_average < 3.5 && (item.vote_count || 0) < 50) {
    return false;
  }

  return true;
};

interface KodikItem {
  id: string;
  title: string;
  title_orig?: string;
  link: string;
  translation: {
    id: number;
    title: string;
    type: string;
  };
}

// Known Kinopoisk IDs for top popular titles (instant 0ms resolution for Russian dubbing)
const KNOWN_KP_MAP: Record<number, number> = {
  157336: 258687, // Интерстеллар
  693134: 4465403, // Дюна: Часть вторая
  438631: 409424, // Дюна
  94605: 1318855, // Аркейн
  1396: 404900, // Во все тяжкие
  85937: 1112136, // Клинок, рассекающий демонов
  872585: 4664634, // Оппенгеймер
  155: 111543, // Тёмный рыцарь
  27205: 447301, // Начало
  550: 361, // Бойцовский клуб
  680: 342, // Криминальное чтиво
  1399: 464963, // Игра престолов
  60625: 685246, // Рик и Морти
  1429: 749374, // Атака титанов
  95479: 1227958, // Магическая битва
  106379: 1399708, // Фоллаут
  76479: 949804, // Пацаны
  100088: 1354148, // Одни из нас
  66732: 915196, // Очень странные дела
  119051: 1373510, // Уэнсдей
  87108: 1227803, // Чернобыль
  126308: 1219417, // Сёгун
  93405: 1309570, // Игра в кальмара
  299534: 843650, // Мстители: Финал
  299536: 843649, // Мстители: Война бесконечности
  24428: 263531, // Мстители
  634649: 1309599, // Человек-паук: Нет пути домой
  19995: 251733, // Аватар
  76600: 505898, // Аватар: Путь воды
  597: 2213, // Титаник
  120: 328, // Властелин колец: Братство Кольца
  121: 312, // Властелин колец: Две крепости
  122: 3498, // Властелин колец: Возвращение Короля
  671: 689, // Гарри Поттер и философский камень
  672: 688, // Гарри Поттер и Тайная комната
  673: 324, // Гарри Поттер и узник Азкабана
  674: 8408, // Гарри Поттер и Кубок огня
  675: 48356, // Гарри Поттер и Орден Феникса
  767: 86621, // Гарри Поттер и Принц-полукровка
  12444: 276762, // Гарри Поттер и Дары Смерти: Часть 1
  12445: 407636, // Гарри Поттер и Дары Смерти: Часть 2
  389: 349, // 12 разгневанных мужчин
  278: 326, // Побег из Шоушенка
  238: 325, // Крёстный отец
  424: 329, // Список Шиндлера
  13: 448, // Форрест Гамп
  129: 370, // Унесённые призраками
  496243: 1043758, // Паразиты
  493529: 1009436, // Джон Уик 3
  603692: 1267348, // Джон Уик 4
  245891: 762738, // Джон Уик
  324552: 885658, // Джон Уик 2
  533535: 1318973, // Дэдпул и Росомаха
  293660: 462360, // Дэдпул
  383498: 977288, // Дэдпул 2
};

interface RussianMediaInfo {
  kp_id?: number | null;
  imdb_id?: string | null;
  iframe_url?: string | null;
  russian_title?: string | null;
}

type BalancerMirror =
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



// Reliable image URL helper with proxy caching (bypasses Russian ISP / Cloudflare blocks on image.tmdb.org)
const formatMediaImg = (path: string | undefined, size: "w500" | "original" = "w500"): string => {
  if (!path) return size === "original" ? INITIAL_LIBRARY[0].backdrop_url : INITIAL_LIBRARY[0].poster_url;
  if (path.startsWith("http")) return path;
  return `https://wsrv.nl/?url=https://image.tmdb.org/t/p/${size}${path}`;
};

// Detect Android TV / Smart TV user agent or previous user preference
const detectTvEnvironment = (): boolean => {
  if (typeof window === "undefined") return false;
  const saved = localStorage.getItem("has_tv_mode");
  if (saved !== null) return saved === "true";
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
  return false;
};

export default function Cinema({
  currentUser,
  onNavigateTab,
  onLogout,
  isTvEnvironment = false,
}: CinemaProps) {
  const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

  // Android TV / Remote Control (10-Foot UI) State
  const [isTvMode, setIsTvMode] = useState<boolean>(() => {
    return isTvEnvironment || detectTvEnvironment();
  });
  const [isTvNavOpen, setIsTvNavOpen] = useState(false);
  const lastFocusedCardRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isTvEnvironment && !isTvMode) {
      setIsTvMode(true);
    }
  }, [isTvEnvironment, isTvMode]);
  const [tvToast, setTvToast] = useState<{ text: string; icon?: string } | null>(null);
  const tvToastTimerRef = useRef<any>(null);

  const showTvToast = useCallback((text: string, icon = "📺", duration = 2000) => {
    if (tvToastTimerRef.current) clearTimeout(tvToastTimerRef.current);
    setTvToast({ text, icon });
    tvToastTimerRef.current = setTimeout(() => {
      setTvToast(null);
    }, duration);
  }, []);

  const playTvBeep = useCallback((freq = 580, duration = 0.035) => {
    playTvBeepAudio(freq, duration);
  }, []);

  const toggleTvMode = useCallback(() => {
    setIsTvMode((prev) => {
      const next = !prev;
      localStorage.setItem("has_tv_mode", String(next));
      showTvToast(next ? "ТВ-Режим включен (10-Foot UI)" : "ПК-Режим включен", "📺", 2500);
      playTvBeep(next ? 750 : 400, 0.05);
      return next;
    });
  }, [showTvToast, playTvBeep]);

  // Local Cinema State (Bookmarks & Progress saved on user's machine)
  const [cinemaState, setCinemaState] = useState<CinemaState>({
    bookmarks: [],
    history: [],
  });
  const [, setConfig] = useState<CinemaConfig>({ tmdb_api_key: null });

  // Navigation Filter
  const [activeTab, setActiveTab] = useState<"home" | "movies" | "series" | "anime" | "bookmarks" | "search">("home");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CinemaMediaItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Active Selected Hero Item
  const [selectedMedia, setSelectedMedia] = useState<CinemaMediaItem>(INITIAL_LIBRARY[0]);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);

  // Dynamic Content Collections from TMDB
  const [trendingAll, setTrendingAll] = useState<CinemaMediaItem[]>([]);
  const [popularMovies, setPopularMovies] = useState<CinemaMediaItem[]>([]);
  const [popularSeries, setPopularSeries] = useState<CinemaMediaItem[]>([]);
  const [popularAnime, setPopularAnime] = useState<CinemaMediaItem[]>([]);

  // Video Player Modal State
  const [playingMedia, setPlayingMedia] = useState<CinemaMediaItem | null>(null);
  const [playingEpisode, setPlayingEpisode] = useState<CinemaEpisode | null>(null);
  const [playingSeasonNumber, setPlayingSeasonNumber] = useState<number>(1);
  const playerMode: "balancer" | "direct" = "balancer";
  const [selectedMirror, setSelectedMirror] = useState<BalancerMirror>("vidlink_pro");
  const [currentKpId, setCurrentKpId] = useState<number | null>(null);
  const [currentImdbId, setCurrentImdbId] = useState<string | null>(null);
  const [currentAllohaUrl, setCurrentAllohaUrl] = useState<string | null>(null);
  const [isAdBlockEnabled, setIsAdBlockEnabled] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [kodikResults, setKodikResults] = useState<KodikItem[]>([]);
  const [selectedKodikLink, setSelectedKodikLink] = useState<string | null>(null);
  const [isSearchingKodik, setIsSearchingKodik] = useState(false);
  const [russianDubNotice, setRussianDubNotice] = useState<string | null>(null);
  const [anilibriaStreamUrl, setAnilibriaStreamUrl] = useState<string | null>(null);
  const [isLoadingAniLibria, setIsLoadingAniLibria] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const topRef = useRef<HTMLDivElement | null>(null);
  const hlsInstanceRef = useRef<Hls | null>(null);
  const aniLibriaReleasesCache = useRef<Map<number, any>>(new Map());

  // Automatic Mirror Watchdog & Failover System (zero dropped playback)
  const triedMirrorsRef = useRef<Set<BalancerMirror>>(new Set());
  const mirrorWatchdogTimerRef = useRef<any>(null);
  const [isMirrorConnecting, setIsMirrorConnecting] = useState<boolean>(false);
  const [allMirrorsFailed, setAllMirrorsFailed] = useState<boolean>(false);
  const currentPlaybackRef = useRef<{ currentTime: number; duration: number }>({ currentTime: 0, duration: 0 });

  // Detailed Movie / Series Information Modal State
  const [detailsMedia, setDetailsMedia] = useState<CinemaMediaItem | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [showTrailerModal, setShowTrailerModal] = useState(false);

  // Simplified Video Player HUD & Controls State
  const [isHudVisible, setIsHudVisible] = useState(true);
  const [showPlayerSettings, setShowPlayerSettings] = useState(false);
  const [showPlayerEpisodes, setShowPlayerEpisodes] = useState(false);
  const hudTimeoutRef = useRef<any>(null);

  const resetHudTimer = useCallback(() => {
    setIsHudVisible(true);
    if (hudTimeoutRef.current) {
      clearTimeout(hudTimeoutRef.current);
    }
    hudTimeoutRef.current = setTimeout(() => {
      setShowPlayerSettings((settingsOpen) => {
        setShowPlayerEpisodes((episodesOpen) => {
          if (!settingsOpen && !episodesOpen) {
            setIsHudVisible(false);
          }
          return episodesOpen;
        });
        return settingsOpen;
      });
    }, 3500);
  }, []);

  // Universal helper to convert a TMDB item into CinemaMediaItem
  const mapTmdbItem = (item: RawTmdbItem, forcedType?: "movie" | "tv"): CinemaMediaItem => {
    let isTv = false;
    if (forcedType) {
      isTv = forcedType === "tv";
    } else if (item.media_type) {
      isTv = item.media_type === "tv";
    } else {
      isTv = !item.title && (!!item.name || !!item.first_air_date);
    }

    const title = item.title || item.name || item.original_title || item.original_name || "Без названия";
    const backdrop = formatMediaImg(item.backdrop_path || item.poster_path, "original");
    const poster = formatMediaImg(item.poster_path || item.backdrop_path, "w500");
    const year = (item.release_date || item.first_air_date || "").slice(0, 4) || "2024";

    if (!isTv) {
      return {
        id: `tmdb-movie-${item.id}`,
        tmdb_id: item.id,
        media_type: "movie",
        title,
        original_title: item.original_name || item.original_title,
        backdrop_url: backdrop,
        poster_url: poster,
        release_year: year,
        seasons_count: undefined,
        duration_minutes: 120,
        genre: "Фильм",
        rating: item.vote_average ? Math.round(item.vote_average * 10) / 10 : 8.0,
        vote_count: item.vote_count,
        synopsis: item.overview?.trim() || "Описание фильма из международной базы TMDB.",
        is_original: false,
        seasons: [],
      };
    }

    const initialSeasonsCount = item.number_of_seasons && item.number_of_seasons > 0 ? item.number_of_seasons : 1;
    const seasonsList: CinemaSeason[] = [];
    for (let s = 1; s <= initialSeasonsCount; s++) {
      seasonsList.push({
        season_number: s,
        episodes: [
          {
            id: `tmdb-${item.id}-s${s}-e1`,
            number: 1,
            title: "Серия 1",
            thumbnail: poster,
            duration_minutes: 45,
          },
        ],
      });
    }

    return {
      id: `tmdb-tv-${item.id}`,
      tmdb_id: item.id,
      media_type: "tv",
      title,
      original_title: item.original_name || item.original_title,
      backdrop_url: backdrop,
      poster_url: poster,
      release_year: year,
      seasons_count: initialSeasonsCount,
      duration_minutes: undefined,
      genre: "Сериал",
      rating: item.vote_average ? Math.round(item.vote_average * 10) / 10 : 8.0,
      vote_count: item.vote_count,
      synopsis: item.overview?.trim() || "Описание сериала из международной базы TMDB.",
      is_original: false,
      seasons: seasonsList,
    };
  };

  // Safe TMDB query via Rust backend (bypasses RU 403 blocks and CORS)
  const queryTmdb = useCallback(async (endpoint: string): Promise<any> => {
    if (!isTauri) return null;
    try {
      return await invoke<any>("tmdb_query", { endpoint });
    } catch (err) {
      console.warn(`Error querying TMDB endpoint ${endpoint}:`, err);
      return null;
    }
  }, [isTauri]);

  // Verifies that titles returned from TMDB actually have active players/streams on CDN balancers
  const verifyPlayableBatch = useCallback(
    async (items: CinemaMediaItem[]): Promise<CinemaMediaItem[]> => {
      if (!isTauri || items.length === 0) return items;
      try {
        const checkPayload = items.map((i) => ({
          tmdb_id: i.tmdb_id || 0,
          title: i.title,
          original_title: i.original_title,
          media_type: i.media_type || "movie",
          vote_count: i.vote_count,
          release_year: i.release_year ? String(i.release_year) : undefined,
        }));
        const verifiedIds = await invoke<number[]>("filter_playable_media", { items: checkPayload });
        const verifiedSet = new Set(verifiedIds);
        return items.filter(
          (i) => i.tmdb_id && (verifiedSet.has(i.tmdb_id) || (KNOWN_KP_MAP as any)[i.tmdb_id])
        );
      } catch (err) {
        console.warn("Error verifying playable media:", err);
        return items;
      }
    },
    [isTauri]
  );

  // Load complete rich details (budget, revenue, director, cast, trailer, etc.)
  const fetchMediaDetails = useCallback(async (item: CinemaMediaItem) => {
    if (!item.tmdb_id) return;
    try {
      const isTv = item.media_type === "tv";
      const endpoint = isTv
        ? `/tv/${item.tmdb_id}?language=ru-RU&append_to_response=credits,videos`
        : `/movie/${item.tmdb_id}?language=ru-RU&append_to_response=credits,videos`;

      const data = await queryTmdb(endpoint);
      if (data) {
        const cast = (data.credits?.cast || []).slice(0, 16).map((c: any) => ({
          id: c.id,
          name: c.name || c.original_name,
          original_name: c.original_name,
          character: c.character,
          profile_path: c.profile_path ? formatMediaImg(c.profile_path, "w500") : null,
        }));

        const director = isTv
          ? (data.created_by && data.created_by.length > 0
              ? data.created_by.map((c: any) => c.name).join(", ")
              : data.credits?.crew?.find((c: any) => c.job === "Director" || c.job === "Executive Producer")?.name)
          : data.credits?.crew?.find((c: any) => c.job === "Director")?.name;

        const countries = (data.production_countries || []).map((c: any) => c.name).join(", ");
        const genres = (data.genres || []).map((g: any) => g.name).join(", ");
        const runtime = data.runtime || (data.episode_run_time && data.episode_run_time[0]) || item.duration_minutes;

        const videos = data.videos?.results || [];
        const trailer =
          videos.find((v: any) => v.site === "YouTube" && v.type === "Trailer" && (v.iso_639_1 === "ru" || (v.name || "").toLowerCase().includes("рус"))) ||
          videos.find((v: any) => v.site === "YouTube" && v.type === "Trailer") ||
          videos.find((v: any) => v.site === "YouTube");

        let realSeasons: CinemaSeason[] = [];
        let realSeasonsCount: number | undefined = undefined;

        if (isTv) {
          if (Array.isArray(data.seasons) && data.seasons.length > 0) {
            const regularSeasons = data.seasons.filter((s: any) => s.season_number > 0);
            const validSeasons = regularSeasons.length > 0 ? regularSeasons : data.seasons;
            realSeasonsCount = data.number_of_seasons || validSeasons.length;

            realSeasons = validSeasons.map((s: any) => {
              const epCount = s.episode_count && s.episode_count > 0 ? s.episode_count : 1;
              const seasonThumb = s.poster_path ? formatMediaImg(s.poster_path, "w500") : item.poster_url;
              return {
                season_number: s.season_number,
                episodes: Array.from({ length: epCount }, (_, idx) => ({
                  id: `tmdb-${item.tmdb_id}-s${s.season_number}-e${idx + 1}`,
                  number: idx + 1,
                  title: `Серия ${idx + 1}`,
                  thumbnail: seasonThumb,
                  duration_minutes: (data.episode_run_time && data.episode_run_time[0]) || 45,
                })),
              };
            });
          } else {
            realSeasonsCount = data.number_of_seasons || 1;
            realSeasons = [
              {
                season_number: 1,
                episodes: [
                  {
                    id: `tmdb-${item.tmdb_id}-s1-e1`,
                    number: 1,
                    title: "Серия 1",
                    thumbnail: item.poster_url,
                    duration_minutes: 45,
                  },
                ],
              },
            ];
          }
        }

        const today = new Date().toISOString().slice(0, 10);
        const releaseDate = data.release_date || data.first_air_date;
        const isFuture = releaseDate && releaseDate > today;
        const isUnreleasedStatus = data.status === "Planned" || data.status === "In Production" || data.status === "Post Production";
        const isUnreleased = !!(isFuture || isUnreleasedStatus);

        const updateItem = (prev: CinemaMediaItem): CinemaMediaItem => ({
          ...prev,
          tagline: data.tagline || prev.tagline,
          budget: data.budget && data.budget > 0 ? data.budget : prev.budget,
          revenue: data.revenue && data.revenue > 0 ? data.revenue : prev.revenue,
          duration_minutes: runtime || prev.duration_minutes,
          countries: countries || prev.countries,
          genre: genres || prev.genre,
          director: director || prev.director,
          cast: cast.length > 0 ? cast : prev.cast,
          trailer_youtube_key: trailer?.key || prev.trailer_youtube_key,
          synopsis: data.overview?.trim() || prev.synopsis,
          rating: data.vote_average ? Math.round(data.vote_average * 10) / 10 : prev.rating,
          seasons: isTv ? realSeasons : [],
          seasons_count: isTv ? realSeasonsCount : undefined,
          is_unreleased: isUnreleased,
          release_date_full: releaseDate || prev.release_date_full,
        });

        setDetailsMedia((prev) => (prev && prev.id === item.id ? updateItem(prev) : prev));
        setSelectedMedia((prev) => (prev && prev.id === item.id ? updateItem(prev) : prev));

        if (isTv) {
          loadTvSeasonsDetails(item.tmdb_id, 1);
        }
      }

      // Also query Russian media info for Kinopoisk ID / rating
      if (isTauri && item.tmdb_id) {
        invoke<RussianMediaInfo>("get_russian_media_info", {
          tmdbId: item.tmdb_id,
          isTv: item.media_type === "tv",
          title: item.title || item.original_title,
        }).then((info) => {
          if (info?.kp_id) {
            setDetailsMedia((prev) => (prev && prev.id === item.id ? { ...prev, kinopoisk_rating: info.kp_id ? "КП" : undefined } : prev));
            setSelectedMedia((prev) => (prev && prev.id === item.id ? { ...prev, kinopoisk_rating: info.kp_id ? "КП" : undefined } : prev));
          }
        }).catch(() => {});
      }
    } catch (e) {
      console.warn("Could not load full media details:", e);
    } finally {
      setIsLoadingDetails(false);
    }
  }, [queryTmdb, isTauri]);

  // Load All Catalogs (Released Movies, Series, Anime, Trending) on Mount
  const loadFullCatalog = useCallback(async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);

      // 1. Trending All (Top 40 - page 1 & 2, filtered by released status & active streams)
      const [tData1, tData2] = await Promise.all([
        queryTmdb("/trending/all/week?language=ru-RU&page=1"),
        queryTmdb("/trending/all/week?language=ru-RU&page=2"),
      ]);
      const allTrendingRaw = [...(tData1?.results || []), ...(tData2?.results || [])];
      if (allTrendingRaw.length > 0) {
        const mapped = allTrendingRaw
          .filter((i: RawTmdbItem) => (i.title || i.name) && isMediaReleased(i) && (i.vote_count || 0) >= 30)
          .map((i: RawTmdbItem) => mapTmdbItem(i));
        const verified = await verifyPlayableBatch(mapped);
        setTrendingAll(verified);
        if (verified.length > 0) {
          setSelectedMedia(verified[0]);
        }
      }

      // 2. Popular Released Movies (only those with digital/physical distribution and vote_count >= 100)
      const [mData1, mData2] = await Promise.all([
        queryTmdb(`/discover/movie?language=ru-RU&sort_by=popularity.desc&primary_release_date.lte=${today}&vote_count.gte=100&with_release_type=4|5|6&page=1`),
        queryTmdb(`/discover/movie?language=ru-RU&sort_by=popularity.desc&primary_release_date.lte=${today}&vote_count.gte=100&with_release_type=4|5|6&page=2`),
      ]);
      const allMoviesRaw = [...(mData1?.results || []), ...(mData2?.results || [])];
      if (allMoviesRaw.length > 0) {
        const mapped = allMoviesRaw
          .filter((i: RawTmdbItem) => (i.title || i.name) && isMediaReleased(i))
          .map((i: RawTmdbItem) => mapTmdbItem(i, "movie"));
        const verified = await verifyPlayableBatch(mapped);
        setPopularMovies(verified);
      }

      // 3. Popular Released TV Shows (first_air_date <= today and vote_count >= 50)
      const [tvData1, tvData2] = await Promise.all([
        queryTmdb(`/discover/tv?language=ru-RU&sort_by=popularity.desc&first_air_date.lte=${today}&vote_count.gte=50&page=1`),
        queryTmdb(`/discover/tv?language=ru-RU&sort_by=popularity.desc&first_air_date.lte=${today}&vote_count.gte=50&page=2`),
      ]);
      const allTvRaw = [...(tvData1?.results || []), ...(tvData2?.results || [])];
      if (allTvRaw.length > 0) {
        const mapped = allTvRaw
          .filter((i: RawTmdbItem) => (i.title || i.name) && isMediaReleased(i))
          .map((i: RawTmdbItem) => mapTmdbItem(i, "tv"));
        const verified = await verifyPlayableBatch(mapped);
        setPopularSeries(verified);
      }

      // 4. Genuine Anime (Japanese Animation, vote_count >= 30)
      const [aData1, aData2] = await Promise.all([
        queryTmdb(`/discover/tv?with_genres=16&with_original_language=ja&sort_by=popularity.desc&first_air_date.lte=${today}&vote_count.gte=30&language=ru-RU&page=1`),
        queryTmdb(`/discover/tv?with_genres=16&with_original_language=ja&sort_by=popularity.desc&first_air_date.lte=${today}&vote_count.gte=30&language=ru-RU&page=2`),
      ]);
      const allAnimeRaw = [...(aData1?.results || []), ...(aData2?.results || [])];
      if (allAnimeRaw.length > 0) {
        const mapped = allAnimeRaw
          .filter((i: RawTmdbItem) => (i.title || i.name) && isMediaReleased(i))
          .map((i: RawTmdbItem) => mapTmdbItem(i, "tv"));
        const verified = await verifyPlayableBatch(mapped);
        setPopularAnime(verified);
      }
    } catch (err) {
      console.warn("Failed to load catalog from TMDB:", err);
    }
  }, [queryTmdb, verifyPlayableBatch]);

  // Load config, state, and full catalog on mount
  useEffect(() => {
    if (!isTauri) return;

    invoke<CinemaConfig>("get_cinema_config")
      .then((cfg) => {
        setConfig(cfg);
        loadFullCatalog();
      })
      .catch((err) => console.warn("Failed to get cinema config:", err));

    invoke<CinemaState>("get_cinema_state", { userEmail: currentUser?.email })
      .then((state) => {
        if (state) setCinemaState(state);
      })
      .catch((err) => console.warn("Failed to get local cinema state:", err));
  }, [isTauri, loadFullCatalog, currentUser?.email]);

  // Search TMDB live across all movies, series, and anime (only released and verified playable titles)
  const executeSearch = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const data = await queryTmdb(
          `/search/multi?query=${encodeURIComponent(query)}&language=ru-RU&page=1`
        );
        let rawResults = (data?.results || []).filter(
          (r: RawTmdbItem) => (r.media_type === "movie" || r.media_type === "tv") && (r.title || r.name) && isMediaReleased(r)
        );

        if (rawResults.length === 0) {
          // Fallback search with en-US query if Russian gave 0 results
          const dataEn = await queryTmdb(
            `/search/multi?query=${encodeURIComponent(query)}&language=en-US&page=1`
          );
          if (dataEn?.results) {
            rawResults = dataEn.results.filter(
              (r: RawTmdbItem) => (r.media_type === "movie" || r.media_type === "tv") && (r.title || r.name) && isMediaReleased(r)
            );
          }
        }

        if (rawResults.length > 0) {
          const mapped = rawResults
            .sort((a: any, b: any) => (b.vote_count || b.popularity || 0) - (a.vote_count || a.popularity || 0))
            .map((r: RawTmdbItem) => mapTmdbItem(r));
          const verified = await verifyPlayableBatch(mapped);
          setSearchResults(verified);
        } else {
          setSearchResults([]);
        }
      } catch (err) {
        console.warn("Search error:", err);
      } finally {
        setIsSearching(false);
      }
    },
    [queryTmdb, verifyPlayableBatch]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        executeSearch(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, executeSearch]);

  // When a TV series is selected, load its real seasons and episodes from TMDB
  const loadTvSeasonsDetails = async (tmdbId: number, seasonNumber: number) => {
    try {
      const data = await queryTmdb(`/tv/${tmdbId}/season/${seasonNumber}?language=ru-RU`);
      if (data?.episodes && data.episodes.length > 0) {
        const loadedEpisodes: CinemaEpisode[] = data.episodes.map((ep: any) => ({
          id: `tmdb-${tmdbId}-s${seasonNumber}-e${ep.episode_number}`,
          number: ep.episode_number,
          title: ep.name ? `${ep.name}` : `Серия ${ep.episode_number}`,
          thumbnail: ep.still_path
            ? formatMediaImg(ep.still_path, "w500")
            : selectedMedia.poster_url,
          duration_minutes: ep.runtime || 45,
          description: ep.overview || undefined,
        }));

        const applyEpisodes = (prev: CinemaMediaItem): CinemaMediaItem => {
          if (prev.tmdb_id !== tmdbId) return prev;
          const seasonExists = prev.seasons.some((s) => s.season_number === seasonNumber);
          const nextSeasons = seasonExists
            ? prev.seasons.map((s) => (s.season_number === seasonNumber ? { ...s, episodes: loadedEpisodes } : s))
            : [...prev.seasons, { season_number: seasonNumber, episodes: loadedEpisodes }];
          return {
            ...prev,
            seasons: nextSeasons,
          };
        };

        setSelectedMedia((prev) => applyEpisodes(prev));
        setDetailsMedia((prev) => (prev ? applyEpisodes(prev) : prev));
        setPlayingMedia((prev) => (prev ? applyEpisodes(prev) : prev));
      }
    } catch (err) {
      console.warn("Failed to load season details:", err);
    }
  };


  const isBookmarked = cinemaState.bookmarks.includes(selectedMedia.id);

  // Toggle Bookmark (Saved locally on user's computer and synced to PostgreSQL)
  const handleToggleBookmark = async () => {
    if (isTauri) {
      try {
        const nextState = await invoke<CinemaState>("toggle_cinema_bookmark", {
          titleId: selectedMedia.id,
          userEmail: currentUser?.email,
        });
        setCinemaState(nextState);
      } catch (err) {
        console.error("Error toggling bookmark:", err);
      }
    } else {
      setCinemaState((prev) => ({
        ...prev,
        bookmarks: prev.bookmarks.includes(selectedMedia.id)
          ? prev.bookmarks.filter((id) => id !== selectedMedia.id)
          : [...prev.bookmarks, selectedMedia.id],
      }));
    }
  };

  // Get progress for a specific episode
  const getEpisodeProgress = (seasonNum: number, episodeNum: number): number => {
    const found = cinemaState.history.find(
      (h) => h.title_id === selectedMedia.id && h.season === seasonNum && h.episode === episodeNum
    );
    if (!found || found.duration_seconds <= 0) return 0;
    return Math.min(100, Math.round((found.progress_seconds / found.duration_seconds) * 100));
  };

  const DEMON_SLAYER_SEASON_RELEASES: Record<number, number> = {
    1: 8325, // Season 1 (2019, 26 eps)
    2: 9093, // Season 2 (Entertainment District, 11 eps)
    3: 9406, // Season 3 (Swordsmith Village, 11 eps)
    4: 9660, // Season 4 (Hashira Training, 8 eps)
    5: 10144, // Season 5 (Infinity Castle, 2025)
  };


  // Fetch AniLibria direct Full HD HLS stream (.m3u8) without regional blocks
  const fetchAniLibriaEpisodeStream = useCallback(
    async (media: CinemaMediaItem, seasonNum: number, episodeNum: number): Promise<string | null> => {
      setIsLoadingAniLibria(true);
      try {
        let releaseId: number | null = null;
        const tLower = media.title.toLowerCase();
        const origLower = (media.original_title || "").toLowerCase();

        if (tLower.includes("клинок") || origLower.includes("kimetsu")) {
          releaseId = DEMON_SLAYER_SEASON_RELEASES[seasonNum] || 8325;
        } else {
          // Search AniLibria by title
          const q = encodeURIComponent(media.title);
          const searchRes = await fetch(`https://anilibria.top/api/v1/app/search/releases?query=${q}`);
          if (searchRes.ok) {
            const searchData = await searchRes.json();
            if (Array.isArray(searchData) && searchData.length > 0) {
              releaseId = searchData[0].id;
            }
          }
          if (!releaseId && media.original_title) {
            const qOrig = encodeURIComponent(media.original_title);
            const searchRes2 = await fetch(`https://anilibria.top/api/v1/app/search/releases?query=${qOrig}`);
            if (searchRes2.ok) {
              const searchData2 = await searchRes2.json();
              if (Array.isArray(searchData2) && searchData2.length > 0) {
                releaseId = searchData2[0].id;
              }
            }
          }
        }

        if (!releaseId) {
          return null;
        }

        // Cache release details
        let relData = aniLibriaReleasesCache.current.get(releaseId);
        if (!relData) {
          const relRes = await fetch(`https://anilibria.top/api/v1/anime/releases/${releaseId}`);
          if (relRes.ok) {
            relData = await relRes.json();
            aniLibriaReleasesCache.current.set(releaseId, relData);
          }
        }

        if (relData?.episodes && relData.episodes.length > 0) {
          const targetEp =
            relData.episodes.find((e: any) => e.ordinal === episodeNum) ||
            relData.episodes[episodeNum - 1] ||
            relData.episodes[0];
          return targetEp.hls_1080 || targetEp.hls_720 || targetEp.hls_480 || null;
        }
        return null;
      } catch (err) {
        console.warn("AniLibria fetch error:", err);
        return null;
      } finally {
        setIsLoadingAniLibria(false);
      }
    },
    []
  );

  // Initialize HLS.js on the video element for native in-app streaming
  useEffect(() => {
    if (selectedMirror !== "anilibria" || !anilibriaStreamUrl || !videoRef.current) {
      if (hlsInstanceRef.current) {
        hlsInstanceRef.current.destroy();
        hlsInstanceRef.current = null;
      }
      return;
    }

    const video = videoRef.current;
    if (Hls.isSupported()) {
      if (hlsInstanceRef.current) {
        hlsInstanceRef.current.destroy();
      }
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 60,
      });
      hlsInstanceRef.current = hls;
      hls.loadSource(anilibriaStreamUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          console.warn("HLS fatal error, falling back to VidSrc Pro:", data);
          hls.destroy();
          hlsInstanceRef.current = null;
          setAnilibriaStreamUrl(null);
          setSelectedMirror("vidsrc_to");
          setRussianDubNotice("⚠️ Поток AniLibria временно недоступен. Переключено на проверенный Full HD плеер VidSrc Pro.");
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = anilibriaStreamUrl;
      video.play().catch(() => {});
      video.onerror = () => {
        setAnilibriaStreamUrl(null);
        setSelectedMirror("vidsrc_to");
        setRussianDubNotice("⚠️ Ошибка воспроизведения AniLibria. Переключено на VidSrc Pro.");
      };
    }

    return () => {
      if (hlsInstanceRef.current) {
        hlsInstanceRef.current.destroy();
        hlsInstanceRef.current = null;
      }
    };
  }, [selectedMirror, anilibriaStreamUrl]);

  // List of all available mirrors sorted with preferred options first
  const getAvailableMirrorsList = useCallback((): BalancerMirror[] => {
    const activeMedia = playingMedia || selectedMedia;
    const isAnime =
      activeMedia?.genre?.toLowerCase().includes("аниме") ||
      activeMedia?.genre?.toLowerCase().includes("anime") ||
      activeMedia?.title?.toLowerCase().includes("клинок") ||
      (activeMedia?.original_title || "").toLowerCase().includes("kimetsu");

    const mirrors: BalancerMirror[] = [];
    if (isAnime && anilibriaStreamUrl) mirrors.push("anilibria");
    if (currentAllohaUrl) mirrors.push("alloha_ru");
    if (kodikResults.length > 0 || isAnime) mirrors.push("kodik_ru");
    mirrors.push("vidlink_pro");
    if (!mirrors.includes("alloha_ru")) mirrors.push("alloha_ru");
    if (!mirrors.includes("kodik_ru")) mirrors.push("kodik_ru");
    mirrors.push("autoembed");
    mirrors.push("vidsrc_pm");
    mirrors.push("multiembed");
    mirrors.push("vidsrc_to");

    return Array.from(new Set(mirrors));
  }, [playingMedia, selectedMedia, anilibriaStreamUrl, currentAllohaUrl, kodikResults]);

  // Automatic Failover Watchdog: seamlessly switches to the next mirror if a server stalls or throws error
  const handleAutoSwitchNextMirror = useCallback((reason: string) => {
    if (mirrorWatchdogTimerRef.current) {
      clearTimeout(mirrorWatchdogTimerRef.current);
      mirrorWatchdogTimerRef.current = null;
    }

    const available = getAvailableMirrorsList();
    triedMirrorsRef.current.add(selectedMirror);

    const nextUntried = available.find((m) => !triedMirrorsRef.current.has(m));

    if (nextUntried) {
      console.log(`[Cinema Failover] ${reason}. Auto-switching to:`, nextUntried);
      setSelectedMirror(nextUntried);
      setIsMirrorConnecting(true);
      setAllMirrorsFailed(false);

      const labels: Record<BalancerMirror, string> = {
        vidlink_pro: "Сервер 1: VidLink Pro (1080p)",
        kodik_ru: "Сервер 2: Kodik (Студии озвучки)",
        autoembed: "Сервер 3: AutoEmbed",
        vidsrc_pm: "Сервер 4: VidSrc Pro",
        multiembed: "Сервер 5: MultiStream VIP",
        vidsrc_to: "Сервер 6: VidSrc To",
        alloha_ru: "Сервер 7: Alloha",
        anilibria: "Сервер 8: AniLibria HLS",
        embess_ru: "Embess",
        smotrim_ru: "Smotrim",
      };

      showTvToast(`Автопереключение: ${labels[nextUntried] || nextUntried}`, "🔄", 2500);

      mirrorWatchdogTimerRef.current = setTimeout(() => {
        handleAutoSwitchNextMirror("Сервер не ответил за 8 секунд");
      }, 8000);
    } else {
      setIsMirrorConnecting(false);
      setAllMirrorsFailed(true);
      showTvToast("Все серверы временно недоступны. Нажмите «Попробовать снова».", "⚠️", 3500);
    }
  }, [selectedMirror, getAvailableMirrorsList, showTvToast]);

  const handleIframeLoaded = useCallback(() => {
    if (mirrorWatchdogTimerRef.current) {
      clearTimeout(mirrorWatchdogTimerRef.current);
      mirrorWatchdogTimerRef.current = null;
    }
    setIsMirrorConnecting(false);
  }, []);

  // Start playback for a media item (movie or specific series episode)
  const startPlayback = (media: CinemaMediaItem, seasonNum: number = 1, episode?: CinemaEpisode) => {
    setSelectedMedia(media);
    setPlayingMedia(media);
    setPlayingSeasonNumber(seasonNum);
    setRussianDubNotice(null);
    setAnilibriaStreamUrl(null);
    setIsHudVisible(true);
    setShowPlayerSettings(false);
    setShowPlayerEpisodes(false);
    resetHudTimer();

    const ep =
      episode ||
      media.seasons.find((s) => s.season_number === seasonNum)?.episodes[0] ||
      media.seasons[0]?.episodes[0] || {
        id: `play-${media.id}-s${seasonNum}`,
        number: 1,
        title: media.media_type === "movie" ? "Полный фильм" : "Серия 1",
        thumbnail: media.poster_url,
        duration_minutes: media.duration_minutes || (media.media_type === "movie" ? 120 : 45),
      };
    setPlayingEpisode(ep);

    // Track playback starting point from synchronized history
    const existingProg = cinemaState.history.find(
      (h) => h.title_id === media.id && h.season === seasonNum && h.episode === ep.number
    );
    if (existingProg && existingProg.progress_seconds > 0) {
      currentPlaybackRef.current = {
        currentTime: existingProg.progress_seconds,
        duration: existingProg.duration_seconds || (ep.duration_minutes ? ep.duration_minutes * 60 : 7200),
      };
    } else {
      currentPlaybackRef.current = {
        currentTime: 0,
        duration: ep.duration_minutes ? ep.duration_minutes * 60 : (media.duration_minutes ? media.duration_minutes * 60 : 7200),
      };
    }

    const isAnime =
      media.genre?.toLowerCase().includes("аниме") ||
      media.genre?.toLowerCase().includes("cartoon") ||
      media.title.toLowerCase().includes("клинок") ||
      (media.original_title || "").toLowerCase().includes("kimetsu");

    // Instantly check known Kinopoisk ID for zero-latency Russian dubbing
    const knownKp = media.tmdb_id ? KNOWN_KP_MAP[media.tmdb_id] : null;
    if (knownKp) {
      setCurrentKpId(knownKp);
    } else {
      setCurrentKpId(null);
    }
    setCurrentImdbId(null);
    setCurrentAllohaUrl(null);

    // Reset mirror tracking and watchdog for fresh playback session
    triedMirrorsRef.current.clear();
    setAllMirrorsFailed(false);
    setIsMirrorConnecting(true);

    if (mirrorWatchdogTimerRef.current) {
      clearTimeout(mirrorWatchdogTimerRef.current);
    }
    mirrorWatchdogTimerRef.current = setTimeout(() => {
      handleAutoSwitchNextMirror("Сервер не ответил за 8 секунд (автопереключение)");
    }, 8000);

    // Default to verified reliable high-speed 1080p stream:
    if (isAnime) {
      if (anilibriaStreamUrl) {
        setSelectedMirror("anilibria");
      } else if (kodikResults.length > 0) {
        setSelectedMirror("kodik_ru");
      } else {
        setSelectedMirror("vidlink_pro");
      }
      showTvToast("🌸 Сервер: Kodik (Аниме / Озвучка)", "🎙️", 1800);
    } else {
      // Default to VidLink Pro (ultra reliable, resolves all TMDB movies/series in 1080p)
      setSelectedMirror("vidlink_pro");
      showTvToast("⚡ Запущен Сервер 1 (Full HD 1080p)", "🎬", 1800);
    }

    // Resolve Kinopoisk ID & Russian media data asynchronously via Rust backend or web fetch
    if (isTauri && media.tmdb_id) {
      invoke<RussianMediaInfo>("get_russian_media_info", {
        tmdbId: media.tmdb_id,
        isTv: media.media_type === "tv",
        title: media.title || media.original_title,
      })
        .then((info) => {
          if (info) {
            if (info.kp_id) setCurrentKpId(Number(info.kp_id));
            if (info.imdb_id) setCurrentImdbId(info.imdb_id);
            if (info.iframe_url) {
              setCurrentAllohaUrl(info.iframe_url);
              if (!isAnime) {
                setSelectedMirror("alloha_ru");
              }
            }
            if (!isAnime) {
              setRussianDubNotice(
                `🇷🇺 Русская озвучка подключена: «${info.russian_title || media.title}» воспроизводится с полным русским дубляжем.`
              );
            }
          }
        })
        .catch(() => {});
    } else if (media.tmdb_id) {
      fetch(`https://api.apbugall.org/?token=45e20a5f584becf7a64dffb7174ddf&tmdb=${media.tmdb_id}`)
        .then((r) => r.json())
        .then((data) => {
          if (data?.data) {
            const d = Array.isArray(data.data) ? data.data[0] : data.data;
            if (d?.id_kp) setCurrentKpId(Number(d.id_kp));
            if (d?.id_imdb) setCurrentImdbId(d.id_imdb);
            if (d?.iframe) {
              setCurrentAllohaUrl(d.iframe);
              if (!isAnime) {
                setSelectedMirror("alloha_ru");
              }
            }
          }
        })
        .catch(() => {});
    }

    // Search Kodik in background for anime or studio translations
    searchKodikDubbings(media.original_title || media.title, isAnime);
  };

  // Card Click Action: Opens rich media details modal (DOES NOT start player immediately)
  const handleMediaCardClick = (item: CinemaMediaItem) => {
    lastFocusedCardRef.current = document.activeElement as HTMLElement | null;
    setSelectedMedia(item);
    setDetailsMedia(item);
    setSelectedSeason(1);
    setIsLoadingDetails(true);
    fetchMediaDetails(item);
    if (item.media_type === "tv" && item.tmdb_id) {
      loadTvSeasonsDetails(item.tmdb_id, 1);
    }
    playTvBeep(520, 0.035);
  };

  const focusFirstContentCard = useCallback(() => {
    setTimeout(() => {
      const target =
        document.querySelector<HTMLElement>(".has-cinema-btn-play") ||
        document.querySelector<HTMLElement>(".has-cinema-media-card") ||
        document.querySelector<HTMLElement>(".has-cinema-grid-card");
      if (target) {
        target.focus();
        target.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
        playTvBeep(640, 0.03);
      }
    }, 50);
  }, [playTvBeep]);

  // Play button from Details Modal
  const handlePlayFromDetails = (seasonNum: number = 1, episode?: CinemaEpisode) => {
    if (!detailsMedia) return;
    const media = detailsMedia;
    startPlayback(media, seasonNum, episode);
  };

  // Toggle bookmark directly from details modal
  const handleToggleBookmarkDetails = async () => {
    if (!detailsMedia) return;
    const mediaId = detailsMedia.id;
    if (isTauri) {
      try {
        const nextState = await invoke<CinemaState>("toggle_cinema_bookmark", {
          titleId: mediaId,
          userEmail: currentUser?.email,
        });
        setCinemaState(nextState);
      } catch (err) {
        console.error("Error toggling bookmark:", err);
      }
    } else {
      setCinemaState((prev) => ({
        ...prev,
        bookmarks: prev.bookmarks.includes(mediaId)
          ? prev.bookmarks.filter((id) => id !== mediaId)
          : [...prev.bookmarks, mediaId],
      }));
    }
    playTvBeep(560, 0.03);
  };

  // Auto-focus the Play button when Details modal opens (for Android TV Remote D-Pad)
  useEffect(() => {
    if (detailsMedia && !playingEpisode) {
      const timer = setTimeout(() => {
        const playBtn = document.querySelector<HTMLElement>(".has-cinema-details-btn-play");
        if (playBtn) {
          playBtn.focus();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [detailsMedia, playingEpisode]);

  // Play a specific episode
  const handlePlayEpisode = (seasonNum: number, episode: CinemaEpisode) => {
    startPlayback(selectedMedia, seasonNum, episode);
  };

  // Play button on Hero Banner
  const handleHeroPlay = () => {
    if (selectedMedia.is_unreleased) {
      showTvToast("Фильм ещё не вышел в цифровой прокат", "⏳", 3000);
      return;
    }
    if (selectedMedia.media_type === "movie") {
      startPlayback(selectedMedia, 1);
      return;
    }
    const lastHistory = cinemaState.history.find((h) => h.title_id === selectedMedia.id);
    if (lastHistory) {
      const seasonObj = selectedMedia.seasons.find((s) => s.season_number === lastHistory.season);
      const epObj = seasonObj?.episodes.find((e) => e.number === lastHistory.episode);
      if (epObj) {
        startPlayback(selectedMedia, lastHistory.season, epObj);
        return;
      }
    }
    const s1 = selectedMedia.seasons[0];
    if (s1 && s1.episodes.length > 0) {
      startPlayback(selectedMedia, 1, s1.episodes[0]);
    } else {
      startPlayback(selectedMedia, 1);
    }
  };

  // Next / Previous episode navigation right inside the player
  const handleNextEpisode = () => {
    if (!playingEpisode) return;
    const currentMedia = playingMedia || selectedMedia;
    const currentSeason =
      currentMedia.seasons.find((s) => s.season_number === playingSeasonNumber) || currentMedia.seasons[0];
    const nextEp = currentSeason.episodes.find((e) => e.number === playingEpisode.number + 1);
    if (nextEp) {
      startPlayback(currentMedia, playingSeasonNumber, nextEp);
    }
  };

  const handlePrevEpisode = () => {
    if (!playingEpisode || playingEpisode.number <= 1) return;
    const currentMedia = playingMedia || selectedMedia;
    const currentSeason =
      currentMedia.seasons.find((s) => s.season_number === playingSeasonNumber) || currentMedia.seasons[0];
    const prevEp = currentSeason.episodes.find((e) => e.number === playingEpisode.number - 1);
    if (prevEp) {
      startPlayback(currentMedia, playingSeasonNumber, prevEp);
    }
  };

  // Quick 1-click multi-source switcher with automatic fallback
  const handleCycleMirror = () => {
    if (mirrorWatchdogTimerRef.current) {
      clearTimeout(mirrorWatchdogTimerRef.current);
      mirrorWatchdogTimerRef.current = null;
    }

    const mirrors = getAvailableMirrorsList();
    const currentIndex = mirrors.indexOf(selectedMirror);
    const nextIndex = (currentIndex + 1) % mirrors.length;
    const nextMirror = mirrors[nextIndex];
    setSelectedMirror(nextMirror);
    setAllMirrorsFailed(false);
    setIsMirrorConnecting(true);
    triedMirrorsRef.current.add(nextMirror);

    const labels: Record<BalancerMirror, string> = {
      vidlink_pro: "Сервер 1: VidLink Pro (1080p)",
      kodik_ru: "Сервер 2: Kodik (Студии дубляжа)",
      autoembed: "Сервер 3: AutoEmbed",
      vidsrc_pm: "Сервер 4: VidSrc Pro",
      multiembed: "Сервер 5: MultiStream VIP",
      vidsrc_to: "Сервер 6: VidSrc To",
      alloha_ru: "Сервер 7: Alloha",
      anilibria: "Сервер 8: AniLibria HLS",
      embess_ru: "Embess",
      smotrim_ru: "Smotrim",
    };
    showTvToast(`Переключено на: ${labels[nextMirror] || nextMirror}`, "🔄", 2200);
    resetHudTimer();

    mirrorWatchdogTimerRef.current = setTimeout(() => {
      handleAutoSwitchNextMirror("Сервер не ответил за 8 секунд");
    }, 8000);
  };

  // Save playback progress on time update
  const handleVideoTimeUpdate = () => {
    if (!videoRef.current || !playingEpisode) return;
    const currentTime = videoRef.current.currentTime;
    const duration = videoRef.current.duration;
    const activeMedia = playingMedia || selectedMedia;
    currentPlaybackRef.current = { currentTime, duration };

    if (duration > 0 && isTauri) {
      const payload: CinemaPlayback = {
        title_id: activeMedia.id,
        title_name: activeMedia.title,
        poster_path: activeMedia.poster_url,
        backdrop_path: activeMedia.backdrop_url,
        season: playingSeasonNumber,
        episode: playingEpisode.number,
        progress_seconds: Math.round(currentTime),
        duration_seconds: Math.round(duration),
        last_watched: new Date().toISOString(),
      };

      if (Math.floor(currentTime) % 5 === 0) {
        invoke<CinemaState>("update_cinema_progress", { item: payload, userEmail: currentUser?.email })
          .then((st) => setCinemaState(st))
          .catch(() => {});
      }
    }
  };

  // Close player and save exact position
  const handleClosePlayer = useCallback(() => {
    const activeMedia = playingMedia || selectedMedia;
    if (mirrorWatchdogTimerRef.current) {
      clearTimeout(mirrorWatchdogTimerRef.current);
      mirrorWatchdogTimerRef.current = null;
    }
    setIsMirrorConnecting(false);
    triedMirrorsRef.current.clear();

    try {
      if (isTauri && isFullscreen) {
        try {
          getCurrentWindow().setFullscreen(false).catch(() => {});
        } catch {}
        setIsFullscreen(false);
      }
    } catch {}

    if (playingEpisode && isTauri && activeMedia) {
      try {
        let currentTime = currentPlaybackRef.current.currentTime;
        let duration = currentPlaybackRef.current.duration;
        if (videoRef.current && videoRef.current.duration > 0) {
          currentTime = videoRef.current.currentTime;
          duration = videoRef.current.duration;
        }
        if (duration <= 0) {
          duration = (playingEpisode.duration_minutes || activeMedia.duration_minutes || (activeMedia.media_type === "movie" ? 120 : 45)) * 60;
        }

        if (currentTime > 5) {
          const payload: CinemaPlayback = {
            title_id: activeMedia.id,
            title_name: activeMedia.title,
            poster_path: activeMedia.poster_url,
            backdrop_path: activeMedia.backdrop_url,
            season: playingSeasonNumber,
            episode: playingEpisode.number,
            progress_seconds: Math.round(currentTime),
            duration_seconds: Math.round(duration),
            last_watched: new Date().toISOString(),
          };
          invoke<CinemaState>("update_cinema_progress", { item: payload, userEmail: currentUser?.email })
            .then((st) => setCinemaState(st))
            .catch(() => {});
        }
      } catch {}
    }
    if (hlsInstanceRef.current) {
      try {
        hlsInstanceRef.current.destroy();
      } catch {}
      hlsInstanceRef.current = null;
    }
    if (hudTimeoutRef.current) {
      clearTimeout(hudTimeoutRef.current);
    }
    setIsHudVisible(true);
    setShowPlayerSettings(false);
    setShowPlayerEpisodes(false);

    // Return user back cleanly
    setDetailsMedia(null);
    if (activeMedia) {
      setSelectedMedia(activeMedia);
    }

    setPlayingEpisode(null);
    setPlayingMedia(null);
    setCurrentKpId(null);
    setCurrentImdbId(null);
    setCurrentAllohaUrl(null);
    setKodikResults([]);
    setSelectedKodikLink(null);
    setRussianDubNotice(null);
    setAnilibriaStreamUrl(null);
  }, [isTauri, isFullscreen, playingEpisode, playingMedia, selectedMedia, playingSeasonNumber, currentUser?.email]);

  // Synchronize playback progress across devices even for embedded players (iframes)
  useEffect(() => {
    if (!playingEpisode) return;

    const interval = setInterval(() => {
      const activeMedia = playingMedia || selectedMedia;
      if (!activeMedia) return;

      if (videoRef.current && videoRef.current.duration > 0) {
        currentPlaybackRef.current.currentTime = videoRef.current.currentTime;
        currentPlaybackRef.current.duration = videoRef.current.duration;
      } else if (playerMode === "balancer" && !allMirrorsFailed) {
        currentPlaybackRef.current.currentTime += 5;
      }

      const cur = currentPlaybackRef.current.currentTime;
      const dur = currentPlaybackRef.current.duration || 7200;

      if (cur >= 5 && isTauri) {
        const payload: CinemaPlayback = {
          title_id: activeMedia.id,
          title_name: activeMedia.title,
          poster_path: activeMedia.poster_url,
          backdrop_path: activeMedia.backdrop_url,
          season: playingSeasonNumber,
          episode: playingEpisode.number,
          progress_seconds: Math.round(cur),
          duration_seconds: Math.round(dur),
          last_watched: new Date().toISOString(),
        };

        invoke<CinemaState>("update_cinema_progress", {
          item: payload,
          userEmail: currentUser?.email,
        })
          .then((st) => setCinemaState(st))
          .catch(() => {});
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [playingEpisode, playerMode, allMirrorsFailed, playingMedia, selectedMedia, playingSeasonNumber, isTauri, currentUser?.email]);

  // Listen to postMessage from embedded players (VidLink, Kodik, Alloha)
  useEffect(() => {
    const handleWindowMessage = (e: MessageEvent) => {
      try {
        let data = e.data;
        if (typeof data === "string" && (data.startsWith("{") || data.startsWith("["))) {
          try {
            data = JSON.parse(data);
          } catch {}
        }
        if (!data || typeof data !== "object") return;

        // VidLink postMessage
        if (data.type === "MEDIA_DATA" && data.data) {
          if (typeof data.data.currentTime === "number" && data.data.currentTime > 0) {
            currentPlaybackRef.current.currentTime = data.data.currentTime;
          }
          if (typeof data.data.duration === "number" && data.data.duration > 0) {
            currentPlaybackRef.current.duration = data.data.duration;
          }
          handleIframeLoaded();
        }

        // Kodik postMessage
        if (data.key === "kodik_player_time_update" && data.value) {
          if (typeof data.value.time === "number" && data.value.time > 0) {
            currentPlaybackRef.current.currentTime = data.value.time;
          }
          if (typeof data.value.duration === "number" && data.value.duration > 0) {
            currentPlaybackRef.current.duration = data.value.duration;
          }
          handleIframeLoaded();
        }

        // Generic timeupdate
        if ((data.event === "timeUpdate" || data.type === "timeupdate") && typeof data.time === "number") {
          currentPlaybackRef.current.currentTime = data.time;
          if (typeof data.duration === "number") {
            currentPlaybackRef.current.duration = data.duration;
          }
          handleIframeLoaded();
        }
      } catch {}
    };

    window.addEventListener("message", handleWindowMessage);
    return () => window.removeEventListener("message", handleWindowMessage);
  }, [handleIframeLoaded]);

  // D-Pad Spatial Navigation & TV Remote Key Handler
  const handleRemoteKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Auto-activate TV mode immediately on ANY remote control button press
      const isRemoteKey =
        [19, 20, 21, 22, 23, 4, 82, 85, 179].includes(e.keyCode) ||
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key);
      if (isRemoteKey && !isTvMode) {
        setIsTvMode(true);
        localStorage.setItem("has_tv_mode", "true");
      }

      const isInput =
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement;

      // Android TV / Remote key mappings
      const isBack =
        e.key === "Escape" ||
        e.key === "GoBack" ||
        e.key === "BrowserBack" ||
        e.keyCode === 4 ||
        e.keyCode === 27;
      const isOk =
        e.key === "Enter" ||
        e.key === "Select" ||
        e.key === "Accept" ||
        e.keyCode === 13 ||
        e.keyCode === 23 ||
        e.keyCode === 66;
      const isPlayPause =
        e.key === "MediaPlayPause" || e.keyCode === 85 || e.keyCode === 179;
      const isFastForward = e.key === "MediaFastForward" || e.keyCode === 90;
      const isRewind = e.key === "MediaRewind" || e.keyCode === 89;

      // Remote Menu key (Android TV remote Menu button / ContextMenu)
      if (e.key === "Menu" || e.keyCode === 82 || e.key === "ContextMenu") {
        e.preventDefault();
        setIsTvNavOpen((prev) => {
          const next = !prev;
          if (next) {
            setTimeout(() => {
              const navBtn =
                document.querySelector<HTMLElement>(".has-cinema-tv-nav-item.active") ||
                document.querySelector<HTMLElement>(".has-cinema-tv-nav-item");
              if (navBtn) {
                navBtn.focus();
                playTvNavBeep();
              }
            }, 30);
          }
          return next;
        });
        return;
      }

      // F10 key toggles TV mode fallback
      if (e.key === "F10") {
        e.preventDefault();
        toggleTvMode();
        return;
      }

      // 1. In-player remote control
      if (playingEpisode !== null) {
        resetHudTimer();

        if (isBack) {
          e.preventDefault();
          if (showPlayerSettings) {
            setShowPlayerSettings(false);
            return;
          }
          if (showPlayerEpisodes) {
            setShowPlayerEpisodes(false);
            return;
          }
          handleClosePlayer();
          showTvToast("Плеер закрыт", "✕", 1500);
          playTvBackBeep();
          return;
        }

        // Pressing ArrowUp / Menu / Info on TV remote reveals HUD and focuses "← Назад" button
        if (
          e.key === "ArrowUp" ||
          e.keyCode === 19 ||
          e.keyCode === 38 ||
          e.key === "Info"
        ) {
          e.preventDefault();
          setIsHudVisible(true);
          resetHudTimer();
          setTimeout(() => {
            const backBtn = document.querySelector<HTMLElement>(".has-cinema-player-btn-back");
            if (backBtn) {
              backBtn.focus();
              playTvNavBeep();
            }
          }, 40);
          return;
        }

        // Pressing ArrowDown on TV remote reveals HUD and focuses server mirror pills / episodes
        if (
          e.key === "ArrowDown" ||
          e.keyCode === 20 ||
          e.keyCode === 40
        ) {
          const isAtBottom = document.activeElement?.closest(".has-cinema-player-server-pill, .has-cinema-player-hud-btn");
          if (!isAtBottom || !isHudVisible) {
            e.preventDefault();
            setIsHudVisible(true);
            resetHudTimer();
            setTimeout(() => {
              const serverPill =
                document.querySelector<HTMLElement>(".has-cinema-player-server-pill.active") ||
                document.querySelector<HTMLElement>(".has-cinema-player-server-pill") ||
                document.querySelector<HTMLElement>(".has-cinema-player-hud-btn");
              if (serverPill) {
                serverPill.focus();
                playTvNavBeep();
              }
            }, 40);
            return;
          }
        }

        // Pressing OK / Enter / Center button in player
        if (isOk) {
          const active = document.activeElement as HTMLElement | null;
          const isButtonFocused =
            active &&
            (active.tagName === "BUTTON" ||
              active.getAttribute("role") === "button" ||
              active.hasAttribute("data-tv-focusable"));

          if (!isHudVisible) {
            e.preventDefault();
            setIsHudVisible(true);
            resetHudTimer();
            if (videoRef.current) {
              if (videoRef.current.paused) {
                videoRef.current.play().catch(() => {});
                showTvToast("Воспроизведение", "▶", 1200);
              } else {
                videoRef.current.pause();
                showTvToast("Пауза", "⏸", 1200);
              }
              playTvSelectBeep();
            }
            return;
          }

          if (isButtonFocused && active) {
            // Let the button click handler do its work, give audio feedback
            playTvSelectBeep();
            active.click();
            e.preventDefault();
            return;
          }

          if (videoRef.current) {
            e.preventDefault();
            if (videoRef.current.paused) {
              videoRef.current.play().catch(() => {});
              showTvToast("Воспроизведение", "▶", 1200);
            } else {
              videoRef.current.pause();
              showTvToast("Пауза", "⏸", 1200);
            }
            playTvSelectBeep();
            return;
          }
        }

        if (isPlayPause || (e.code === "Space" && !isInput)) {
          e.preventDefault();
          if (videoRef.current) {
            if (videoRef.current.paused) {
              videoRef.current.play().catch(() => {});
              showTvToast("Воспроизведение", "▶", 1200);
            } else {
              videoRef.current.pause();
              showTvToast("Пауза", "⏸", 1200);
            }
            playTvSelectBeep();
          }
          return;
        }

        if (
          isFastForward ||
          (e.key === "ArrowRight" &&
            !isInput &&
            !document.activeElement?.closest(".has-cinema-player-modal .has-cinema-player-hud-btn, .has-cinema-player-server-pill"))
        ) {
          if (videoRef.current) {
            e.preventDefault();
            videoRef.current.currentTime = Math.min(
              videoRef.current.duration || 999999,
              videoRef.current.currentTime + 10
            );
            showTvToast("+10 сек", "⏩", 1000);
            playTvNavBeep();
            return;
          }
        }

        if (
          isRewind ||
          (e.key === "ArrowLeft" &&
            !isInput &&
            !document.activeElement?.closest(".has-cinema-player-modal .has-cinema-player-hud-btn, .has-cinema-player-server-pill"))
        ) {
          if (videoRef.current) {
            e.preventDefault();
            videoRef.current.currentTime = Math.max(
              0,
              videoRef.current.currentTime - 10
            );
            showTvToast("-10 сек", "⏪", 1000);
            playTvNavBeep();
            return;
          }
        }
      }

      // 2. OK / Select Button outside player (Immediate activation of focused card/button/tab/chip)
      if (isOk && !isInput) {
        const active = document.activeElement as HTMLElement | null;
        if (active && active !== document.body) {
          if (
            active.matches(
              'button, a, [data-tv-focusable="true"], .has-cinema-nav-item, .has-cinema-tv-nav-item, .has-cinema-btn-play, .has-cinema-btn-bookmark, .has-cinema-media-card, .has-cinema-grid-card, .has-cinema-episode-card, .has-cinema-drawer-option-btn, .has-cinema-drawer-chip, .has-cinema-drawer-ep-btn, .has-cinema-season-tab, .has-cinema-details-btn-play, .has-cinema-details-close-btn, .has-cinema-details-btn-bookmark, .has-cinema-details-btn-trailer, .has-cinema-actor-card, .has-cinema-btn-info-wide'
            )
          ) {
            e.preventDefault();
            playTvSelectBeep();
            active.click();
            return;
          }
        }
      }

      // 2. Global Back button outside player
      if (isBack) {
        if (isTvNavOpen) {
          e.preventDefault();
          setIsTvNavOpen(false);
          setTimeout(() => {
            if (lastFocusedCardRef.current && document.contains(lastFocusedCardRef.current)) {
              lastFocusedCardRef.current.focus();
              lastFocusedCardRef.current.scrollIntoView({
                behavior: "smooth",
                block: "center",
                inline: "center",
              });
              playTvBeep(640, 0.03);
            } else {
              focusFirstContentCard();
            }
          }, 40);
          return;
        }
        if (showTrailerModal) {
          e.preventDefault();
          setShowTrailerModal(false);
          showTvToast("Трейлер закрыт", "✕", 1000);
          playTvBeep(450, 0.04);
          return;
        }
        if (detailsMedia) {
          e.preventDefault();
          setDetailsMedia(null);
          showTvToast("Возврат к списку", "↩", 1000);
          playTvBeep(450, 0.04);
          setTimeout(() => {
            if (lastFocusedCardRef.current && document.contains(lastFocusedCardRef.current)) {
              lastFocusedCardRef.current.focus();
              lastFocusedCardRef.current.scrollIntoView({
                behavior: "smooth",
                block: "center",
                inline: "center",
              });
            }
          }, 40);
          return;
        }
        if (searchQuery.trim().length > 0) {
          e.preventDefault();
          setSearchQuery("");
          showTvToast("Поиск очищен", "🔍", 1200);
          playTvBeep(450, 0.04);
          focusFirstContentCard();
          return;
        }
        if (activeTab !== "home") {
          e.preventDefault();
          setActiveTab("home");
          showTvToast("Каталог", "🏠", 1200);
          playTvBeep(450, 0.04);
          focusFirstContentCard();
          return;
        }
        // At home root on TV, Back button summons the navigation drawer
        if (isTvMode && !isTvNavOpen) {
          e.preventDefault();
          lastFocusedCardRef.current = document.activeElement as HTMLElement | null;
          setIsTvNavOpen(true);
          setTimeout(() => {
            const targetNav =
              document.querySelector<HTMLElement>(".has-cinema-tv-nav-item.active") ||
              document.querySelector<HTMLElement>(".has-cinema-tv-nav-item");
            if (targetNav) {
              targetNav.focus();
              playTvBeep(640, 0.03);
            }
          }, 40);
          return;
        }
      }

      // 3. D-Pad Directional Arrows Navigation
      const isArrow =
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key) ||
        [19, 20, 21, 22, 37, 38, 39, 40].includes(e.keyCode);

      if (isArrow) {
        if (isInput && e.key !== "ArrowDown") {
          return; // Let user type and navigate within text input
        }

        let direction: "up" | "down" | "left" | "right" = "down";
        if (e.key === "ArrowUp" || e.keyCode === 19 || e.keyCode === 38)
          direction = "up";
        else if (
          e.key === "ArrowDown" ||
          e.keyCode === 20 ||
          e.keyCode === 40
        )
          direction = "down";
        else if (
          e.key === "ArrowLeft" ||
          e.keyCode === 21 ||
          e.keyCode === 37
        )
          direction = "left";
        else if (
          e.key === "ArrowRight" ||
          e.keyCode === 22 ||
          e.keyCode === 39
        )
          direction = "right";

        const detailsEl = document.querySelector<HTMLElement>(".has-cinema-details-modal");
        const playerEl = document.querySelector<HTMLElement>(".has-cinema-player-modal");
        const trailerEl = document.querySelector<HTMLElement>(".has-cinema-trailer-modal");
        const settingsSheet = document.querySelector<HTMLElement>(".has-cinema-player-settings-sheet");
        const episodesSheet = document.querySelector<HTMLElement>(".has-cinema-player-episodes-sheet");

        // If focus is currently inside the TV Navigation drawer
        const currentActive = document.activeElement as HTMLElement | null;
        if (currentActive && currentActive.closest(".has-cinema-tv-nav-drawer")) {
          if (direction === "right") {
            e.preventDefault();
            setIsTvNavOpen(false);
            setTimeout(() => {
              if (lastFocusedCardRef.current && document.contains(lastFocusedCardRef.current)) {
                lastFocusedCardRef.current.focus();
                lastFocusedCardRef.current.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                  inline: "center",
                });
                playTvBeep(640, 0.03);
              } else {
                focusFirstContentCard();
              }
            }, 40);
            return;
          }
        }

        let focusables = Array.from(
          document.querySelectorAll<HTMLElement>(
            '[data-tv-focusable="true"], .has-cinema-nav-item, .has-cinema-tv-nav-item, .has-cinema-btn-play, .has-cinema-btn-bookmark, .has-cinema-media-card, .has-cinema-grid-card, .has-cinema-episode-card, .has-cinema-player-hud-btn, .has-cinema-player-btn-back, .has-cinema-drawer-option-btn, .has-cinema-drawer-chip, .has-cinema-drawer-ep-btn, .has-cinema-drawer-close-btn, .has-cinema-drawer-btn-primary, .has-cinema-drawer-btn-secondary, .has-cinema-player-pill-nav, .has-cinema-season-tab, .has-cinema-details-btn-play, .has-cinema-details-close-btn, .has-cinema-details-btn-bookmark, .has-cinema-details-btn-trailer, .has-cinema-actor-card, .has-cinema-btn-info-wide'
          )
        ).filter((el) => {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return false;
          const style = window.getComputedStyle(el);
          return (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            style.opacity !== "0"
          );
        });

        // TV navigation drawer focus isolation
        if (isTvNavOpen) {
          const drawerEl = document.querySelector<HTMLElement>(".has-cinema-tv-nav-drawer");
          if (drawerEl) {
            focusables = focusables.filter((el) => drawerEl.contains(el));
          }
        } else {
          // When drawer is closed, NEVER include drawer items in focusable pool
          focusables = focusables.filter((el) => !el.closest(".has-cinema-tv-nav-drawer"));
        }

        // In TV mode, top header is hidden, so never include header elements
        if (isTvMode) {
          focusables = focusables.filter((el) => !el.closest(".has-cinema-header"));
        }

        // Trap focus inside modal or drawer if open
        if (settingsSheet) {
          focusables = focusables.filter((el) => settingsSheet.contains(el));
        } else if (episodesSheet) {
          focusables = focusables.filter((el) => episodesSheet.contains(el));
        } else if (trailerEl) {
          focusables = focusables.filter((el) => trailerEl.contains(el));
        } else if (playerEl) {
          focusables = focusables.filter((el) => playerEl.contains(el));
        } else if (detailsEl) {
          focusables = focusables.filter((el) => detailsEl.contains(el));
        }

        if (focusables.length === 0) return;

        const current = document.activeElement as HTMLElement | null;
        if (!current || !focusables.includes(current)) {
          const initial =
            focusables.find((el) => el.classList.contains("has-cinema-btn-play")) ||
            focusables.find((el) => el.classList.contains("has-cinema-nav-item")) ||
            focusables[0];
          if (initial) {
            e.preventDefault();
            initial.focus();
            initial.scrollIntoView({
              behavior: "smooth",
              block: "center",
              inline: "center",
            });
            playTvBeep(580, 0.03);
          }
          return;
        }

        const curRect = current.getBoundingClientRect();
        const curCx = curRect.left + curRect.width / 2;
        const curCy = curRect.top + curRect.height / 2;

        let bestEl: HTMLElement | null = null;
        let minScore = Infinity;

        for (const candidate of focusables) {
          if (candidate === current) continue;
          const cRect = candidate.getBoundingClientRect();
          const cCx = cRect.left + cRect.width / 2;
          const cCy = cRect.top + cRect.height / 2;

          const dx = cCx - curCx;
          const dy = cCy - curCy;

          if (direction === "up" && dy >= -8) continue;
          if (direction === "down" && dy <= 8) continue;
          if (direction === "left" && dx >= -8) continue;
          if (direction === "right" && dx <= 8) continue;

          let score = Infinity;
          if (direction === "up" || direction === "down") {
            score = Math.abs(dy) + Math.abs(dx) * 1.7;
          } else {
            score = Math.abs(dx) + Math.abs(dy) * 2.4;
          }

          if (score < minScore) {
            minScore = score;
            bestEl = candidate;
          }
        }

        if (bestEl) {
          e.preventDefault();
          bestEl.focus();
          bestEl.scrollIntoView({
            behavior: "smooth",
            block: "center",
            inline: "center",
          });
          playTvBeep(640, 0.025);
        } else {
          // If no element found in this direction outside modals:
          // When moving LEFT from the leftmost card, summon the TV Navigation Drawer!
          if (!detailsEl && !playerEl && !trailerEl && !settingsSheet && !episodesSheet) {
            if (direction === "left") {
              e.preventDefault();
              lastFocusedCardRef.current = current;
              setIsTvNavOpen(true);
              setTimeout(() => {
                const targetNav =
                  document.querySelector<HTMLElement>(".has-cinema-tv-nav-item.active") ||
                  document.querySelector<HTMLElement>(".has-cinema-tv-nav-item");
                if (targetNav) {
                  targetNav.focus();
                  playTvBeep(640, 0.03);
                }
              }, 40);
            }
          }
        }
      }
    },
    [
      isTvMode,
      isTvNavOpen,
      playingEpisode,
      detailsMedia,
      showTrailerModal,
      showPlayerSettings,
      showPlayerEpisodes,
      searchQuery,
      activeTab,
      handleClosePlayer,
      showTvToast,
      playTvBeep,
      toggleTvMode,
      resetHudTimer,
      focusFirstContentCard,
    ]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleRemoteKeyDown);
    return () => {
      window.removeEventListener("keydown", handleRemoteKeyDown);
    };
  }, [handleRemoteKeyDown]);

  // Handle Android TV hardware back & browser popstate to guarantee return to movie details card
  useEffect(() => {
    if (playingEpisode !== null) {
      window.history.pushState({ cinemaPlayer: true }, "");

      const handlePopState = (e: PopStateEvent) => {
        e.preventDefault();
        if (showPlayerSettings) {
          setShowPlayerSettings(false);
          window.history.pushState({ cinemaPlayer: true }, "");
          return;
        }
        if (showPlayerEpisodes) {
          setShowPlayerEpisodes(false);
          window.history.pushState({ cinemaPlayer: true }, "");
          return;
        }
        handleClosePlayer();
      };

      window.addEventListener("popstate", handlePopState);
      return () => {
        window.removeEventListener("popstate", handlePopState);
      };
    }
  }, [playingEpisode, showPlayerSettings, showPlayerEpisodes, handleClosePlayer]);

  // Handle Android TV hardware back & browser popstate for details modal
  useEffect(() => {
    if (detailsMedia !== null && playingEpisode === null) {
      window.history.pushState({ cinemaDetails: true }, "");

      const handlePopState = (e: PopStateEvent) => {
        e.preventDefault();
        if (showTrailerModal) {
          setShowTrailerModal(false);
          window.history.pushState({ cinemaDetails: true }, "");
          return;
        }
        setDetailsMedia(null);
      };

      window.addEventListener("popstate", handlePopState);
      return () => {
        window.removeEventListener("popstate", handlePopState);
      };
    }
  }, [detailsMedia, playingEpisode, showTrailerModal]);

  // Toggle Desktop Fullscreen mode
  const handleToggleFullscreen = async () => {
    if (isTauri) {
      try {
        const win = getCurrentWindow();
        const current = await win.isFullscreen();
        await win.setFullscreen(!current);
        setIsFullscreen(!current);
      } catch {
        setIsFullscreen((prev) => !prev);
      }
    } else {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
        setIsFullscreen(true);
      } else {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  // Switch mirror manually
  const handleSelectMirror = async (mirrorId: BalancerMirror) => {
    if (mirrorWatchdogTimerRef.current) {
      clearTimeout(mirrorWatchdogTimerRef.current);
      mirrorWatchdogTimerRef.current = null;
    }
    setSelectedMirror(mirrorId);
    setAllMirrorsFailed(false);
    setIsMirrorConnecting(true);
    triedMirrorsRef.current.add(mirrorId);

    // Watchdog for manually chosen mirror (8 seconds)
    mirrorWatchdogTimerRef.current = setTimeout(() => {
      handleAutoSwitchNextMirror("Сервер не ответил за 8 секунд");
    }, 8000);

    if (mirrorId === "anilibria") {
      const activeMedia = playingMedia || selectedMedia;
      const epNum = playingEpisode?.number || 1;
      const stream = await fetchAniLibriaEpisodeStream(activeMedia, playingSeasonNumber, epNum);
      if (stream) {
        setAnilibriaStreamUrl(stream);
        setRussianDubNotice("🌸 Подключен поток AniLibria Full HD (Studio Band).");
        if (mirrorWatchdogTimerRef.current) {
          clearTimeout(mirrorWatchdogTimerRef.current);
          mirrorWatchdogTimerRef.current = null;
        }
        setIsMirrorConnecting(false);
      }
    } else {
      setAnilibriaStreamUrl(null);
    }
  };

  // Title matching helper to eliminate unrelated fuzzy search results
  const isMatchingTitle = (target: string, candidate: string): boolean => {
    if (!target || !candidate) return false;
    const cleanTarget = target.toLowerCase().replace(/[^a-zа-я0-9\s]/gi, " ").trim();
    const cleanCandidate = candidate.toLowerCase().replace(/[^a-zа-я0-9\s]/gi, " ").trim();
    if (cleanTarget === cleanCandidate) return true;
    const targetWords = cleanTarget.split(/\s+/).filter((w) => w.length > 2);
    if (targetWords.length === 0) return false;
    const minWordsToCheck = Math.min(2, targetWords.length);
    return targetWords.slice(0, minWordsToCheck).every((w) => cleanCandidate.includes(w));
  };

  // Search Kodik API for Russian studio voiceovers (LostFilm, HDRezka, Studio Band, AniLibria, AniDUB, Дубляж)
  const searchKodikDubbings = async (title: string, autoSwitch: boolean = false) => {
    setIsSearchingKodik(true);
    setRussianDubNotice(null);
    const activeMedia = playingMedia || selectedMedia;
    const targetTitle = activeMedia.title;
    const targetOrig = activeMedia.original_title || title;

    try {
      let rawResults: KodikItem[] = [];

      // 1. Try search by original title first
      if (targetOrig) {
        const q = encodeURIComponent(targetOrig);
        const res = await fetch(`https://kodik-api.com/search?token=41dd95f84c21719b09d6c71182237a25&title=${q}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.results)) {
            rawResults = data.results;
          }
        }
      }

      // 2. Try search by Russian title if needed
      if (rawResults.length === 0 && targetTitle) {
        const qRu = encodeURIComponent(targetTitle);
        const resRu = await fetch(`https://kodik-api.com/search?token=41dd95f84c21719b09d6c71182237a25&title=${qRu}`);
        if (resRu.ok) {
          const dataRu = await resRu.json();
          if (Array.isArray(dataRu.results)) {
            rawResults = dataRu.results;
          }
        }
      }

      // 3. Strict filtering: ONLY include results that actually match this title!
      const matchingResults = rawResults.filter((r) => {
        const matchRu = isMatchingTitle(targetTitle, r.title);
        const matchOrig = isMatchingTitle(targetOrig, r.title_orig || r.title);
        return matchRu || matchOrig;
      });

      // 4. Deduplicate by translation studio name
      const uniqueStudios = new Map<string, KodikItem>();
      for (const item of matchingResults) {
        const studioName = item.translation?.title?.trim() || "Озвучка";
        if (!uniqueStudios.has(studioName)) {
          uniqueStudios.set(studioName, item);
        }
      }
      const finalDubbings = Array.from(uniqueStudios.values());

      if (finalDubbings.length > 0) {
        setKodikResults(finalDubbings);
        setSelectedKodikLink(finalDubbings[0].link);
        if (autoSwitch) {
          setSelectedMirror("kodik_ru");
          setRussianDubNotice(`🇷🇺 Найдено ${finalDubbings.length} студий русской озвучки для «${targetTitle}».`);
        }
      } else {
        setKodikResults([]);
        setSelectedKodikLink(null);
        if (autoSwitch) {
          setSelectedMirror("vidlink_pro");
          setRussianDubNotice("🇷🇺 Для данного фильма русская аудиодорожка встроена в плеер VidLink Pro (нажмите на шестеренку ⚙️ или значок аудио в правом нижнем углу плеера).");
        }
      }
    } catch {
      setKodikResults([]);
      setSelectedKodikLink(null);
      if (autoSwitch) {
        setSelectedMirror("vidlink_pro");
        setRussianDubNotice("🌍 Переключено на основной плеер VidLink Pro.");
      }
    } finally {
      setIsSearchingKodik(false);
    }
  };



  const currentSeasonData: CinemaSeason =
    selectedMedia.seasons.find((s) => s.season_number === selectedSeason) || selectedMedia.seasons[0];

  // Balancer embed URL with multiple verified mirror selection
  const getBalancerEmbedUrl = (): string => {
    const media = playingMedia || selectedMedia;
    const tmdb = media.tmdb_id;
    const isTv = media.media_type === "tv";
    const epNum = playingEpisode?.number || 1;
    const sNum = playingSeasonNumber || 1;
    const kpId = currentKpId || (tmdb ? KNOWN_KP_MAP[tmdb] : null);
    const imdbId = currentImdbId;

    switch (selectedMirror) {
      case "vidlink_pro":
        return isTv
          ? `https://vidlink.pro/tv/${tmdb || 693134}/${sNum}/${epNum}?primaryColor=6366f1`
          : `https://vidlink.pro/movie/${tmdb || 693134}?primaryColor=6366f1`;

      case "kodik_ru":
        if (selectedKodikLink) {
          return selectedKodikLink.startsWith("//") ? `https:${selectedKodikLink}` : selectedKodikLink;
        }
        if (kodikResults.length > 0 && kodikResults[0]?.link) {
          const l = kodikResults[0].link;
          return l.startsWith("//") ? `https:${l}` : l;
        }
        return isTv
          ? `https://vidlink.pro/tv/${tmdb || 693134}/${sNum}/${epNum}?primaryColor=6366f1`
          : `https://vidlink.pro/movie/${tmdb || 693134}?primaryColor=6366f1`;

      case "autoembed":
        return isTv
          ? `https://player.autoembed.co/embed/tv/${tmdb || 693134}/${sNum}/${epNum}`
          : `https://player.autoembed.co/embed/movie/${tmdb || 693134}`;

      case "vidsrc_pm":
        return isTv
          ? `https://vidsrc.pm/embed/tv/${tmdb || 693134}/${sNum}/${epNum}`
          : `https://vidsrc.pm/embed/movie/${tmdb || 693134}`;

      case "multiembed":
        return isTv
          ? `https://multiembed.mov/?video_id=${tmdb || 693134}&tmdb=1&s=${sNum}&e=${epNum}`
          : `https://multiembed.mov/?video_id=${tmdb || 693134}&tmdb=1`;

      case "vidsrc_to":
        return isTv
          ? `https://vidsrc.to/embed/tv/${tmdb || 693134}/${sNum}/${epNum}`
          : `https://vidsrc.to/embed/movie/${tmdb || 693134}`;

      case "alloha_ru":
        if (currentAllohaUrl) {
          return currentAllohaUrl.startsWith("//") ? `https:${currentAllohaUrl}` : currentAllohaUrl;
        }
        if (kpId) {
          return `https://theatre.stravers.live/?kp=${kpId}`;
        }
        if (imdbId) {
          return `https://theatre.stravers.live/?imdb=${imdbId}`;
        }
        return isTv
          ? `https://vidlink.pro/tv/${tmdb || 693134}/${sNum}/${epNum}?primaryColor=6366f1`
          : `https://vidlink.pro/movie/${tmdb || 693134}?primaryColor=6366f1`;

      default:
        return isTv
          ? `https://vidlink.pro/tv/${tmdb || 693134}/${sNum}/${epNum}?primaryColor=6366f1`
          : `https://vidlink.pro/movie/${tmdb || 693134}?primaryColor=6366f1`;
    }
  };

  const balancerEmbedUrl = getBalancerEmbedUrl();

  // Combine live TMDB catalog with initial fallbacks
  const allMoviesList = popularMovies.length > 0 ? popularMovies : INITIAL_LIBRARY.filter((i) => i.media_type === "movie");
  const allSeriesList = popularSeries.length > 0 ? popularSeries : INITIAL_LIBRARY.filter((i) => i.media_type === "tv");
  const allAnimeList = popularAnime.length > 0 ? popularAnime : INITIAL_LIBRARY.filter((i) => i.genre.includes("Аниме") || i.genre.includes("Cartoon"));
  const allTrending = trendingAll.length > 0 ? trendingAll : INITIAL_LIBRARY;

  const bookmarkedItems = [
    ...trendingAll,
    ...popularMovies,
    ...popularSeries,
    ...popularAnime,
    ...INITIAL_LIBRARY,
  ].filter((item, index, self) => cinemaState.bookmarks.includes(item.id) && self.findIndex((s) => s.id === item.id) === index);

  return (
    <div className={`has-cinema-container ${isTvMode ? "has-tv-mode" : ""}`} ref={topRef}>
      {/* Semi-transparent Backdrop for TV Navigation Drawer */}
      {isTvMode && isTvNavOpen && (
        <div
          className="has-cinema-tv-nav-backdrop"
          onClick={() => setIsTvNavOpen(false)}
        />
      )}

      {/* ========================================================
          ANDROID TV LEANBACK NAVIGATION DRAWER (Zona TV Experience)
          (Summoned only by moving Left from the leftmost card)
          ======================================================== */}
      {isTvMode && (
        <aside
          className={`has-cinema-tv-nav-drawer ${isTvNavOpen ? "open" : ""}`}
          aria-label="Навигация для ТВ"
        >
          <div className="has-cinema-tv-nav-header">
            <div className="has-cinema-tv-nav-logo">
              <span className="has-cinema-tv-nav-logo-badge">HAS</span>
              <span className="has-cinema-tv-nav-logo-text">Кинотеатр</span>
            </div>
          </div>

          <div className="has-cinema-tv-nav-list">
            <button
              type="button"
              className={`has-cinema-tv-nav-item ${activeTab === "search" || searchQuery ? "active" : ""}`}
              onClick={() => {
                setActiveTab("search");
                setIsTvNavOpen(false);
                setTimeout(() => {
                  const s = document.querySelector<HTMLInputElement>(".has-cinema-tv-search-input-field") || document.querySelector<HTMLInputElement>(".has-cinema-search-input");
                  if (s) s.focus();
                }, 60);
              }}
              data-tv-focusable="true"
              title="Поиск"
            >
              <span className="has-cinema-tv-nav-icon">🔍</span>
              <span className="has-cinema-tv-nav-label">Поиск</span>
            </button>

            <button
              type="button"
              className={`has-cinema-tv-nav-item ${activeTab === "home" && !searchQuery ? "active" : ""}`}
              onClick={() => {
                setActiveTab("home");
                setSearchQuery("");
                setIsTvNavOpen(false);
                setTimeout(() => focusFirstContentCard(), 60);
              }}
              data-tv-focusable="true"
              title="Каталог"
            >
              <span className="has-cinema-tv-nav-icon">🏠</span>
              <span className="has-cinema-tv-nav-label">Каталог</span>
            </button>

            <button
              type="button"
              className={`has-cinema-tv-nav-item ${activeTab === "movies" && !searchQuery ? "active" : ""}`}
              onClick={() => {
                setActiveTab("movies");
                setSearchQuery("");
                setIsTvNavOpen(false);
                setTimeout(() => focusFirstContentCard(), 60);
              }}
              data-tv-focusable="true"
              title="Фильмы"
            >
              <span className="has-cinema-tv-nav-icon">🎬</span>
              <span className="has-cinema-tv-nav-label">Фильмы</span>
            </button>

            <button
              type="button"
              className={`has-cinema-tv-nav-item ${activeTab === "series" && !searchQuery ? "active" : ""}`}
              onClick={() => {
                setActiveTab("series");
                setSearchQuery("");
                setIsTvNavOpen(false);
                setTimeout(() => focusFirstContentCard(), 60);
              }}
              data-tv-focusable="true"
              title="Сериалы"
            >
              <span className="has-cinema-tv-nav-icon">📺</span>
              <span className="has-cinema-tv-nav-label">Сериалы</span>
            </button>

            <button
              type="button"
              className={`has-cinema-tv-nav-item ${activeTab === "anime" && !searchQuery ? "active" : ""}`}
              onClick={() => {
                setActiveTab("anime");
                setSearchQuery("");
                setIsTvNavOpen(false);
                setTimeout(() => focusFirstContentCard(), 60);
              }}
              data-tv-focusable="true"
              title="Аниме"
            >
              <span className="has-cinema-tv-nav-icon">🌸</span>
              <span className="has-cinema-tv-nav-label">Аниме</span>
            </button>

            <button
              type="button"
              className={`has-cinema-tv-nav-item ${activeTab === "bookmarks" && !searchQuery ? "active" : ""}`}
              onClick={() => {
                setActiveTab("bookmarks");
                setSearchQuery("");
                setIsTvNavOpen(false);
                setTimeout(() => focusFirstContentCard(), 60);
              }}
              data-tv-focusable="true"
              title="Мой список"
            >
              <span className="has-cinema-tv-nav-icon">⭐</span>
              <span className="has-cinema-tv-nav-label">
                Мой список {cinemaState.bookmarks.length > 0 && `(${cinemaState.bookmarks.length})`}
              </span>
            </button>

            {onNavigateTab && (
              <button
                type="button"
                className="has-cinema-tv-nav-item"
                onClick={() => {
                  setIsTvNavOpen(false);
                  onNavigateTab("home");
                }}
                data-tv-focusable="true"
                title="Панель сервера"
              >
                <span className="has-cinema-tv-nav-icon">🖥️</span>
                <span className="has-cinema-tv-nav-label">Панель сервера</span>
              </button>
            )}

            {onLogout && (
              <button
                type="button"
                className="has-cinema-tv-nav-item logout"
                onClick={() => {
                  setIsTvNavOpen(false);
                  onLogout();
                }}
                data-tv-focusable="true"
                title="Выйти"
              >
                <span className="has-cinema-tv-nav-icon">🚪</span>
                <span className="has-cinema-tv-nav-label">Выйти</span>
              </button>
            )}
          </div>

          <div className="has-cinema-tv-nav-footer">
            <span>▶ Вправо или Назад — закрыть меню</span>
          </div>
        </aside>
      )}

      {/* ========================================================
          1. TOP NAVIGATION BAR (For Desktop / Mobile only; hidden in TV Mode)
          ======================================================== */}
      <header className="has-cinema-header">
        <nav className="has-cinema-nav-links">
          <button
            type="button"
            className={`has-cinema-nav-item ${activeTab === "home" && !searchQuery ? "active" : ""}`}
            onClick={() => {
              setActiveTab("home");
              setSearchQuery("");
            }}
            data-tv-focusable="true"
          >
            Каталог
          </button>
          <button
            type="button"
            className={`has-cinema-nav-item ${activeTab === "movies" && !searchQuery ? "active" : ""}`}
            onClick={() => {
              setActiveTab("movies");
              setSearchQuery("");
            }}
            data-tv-focusable="true"
          >
            Фильмы
          </button>
          <button
            type="button"
            className={`has-cinema-nav-item ${activeTab === "series" && !searchQuery ? "active" : ""}`}
            onClick={() => {
              setActiveTab("series");
              setSearchQuery("");
            }}
            data-tv-focusable="true"
          >
            Сериалы
          </button>
          <button
            type="button"
            className={`has-cinema-nav-item ${activeTab === "anime" && !searchQuery ? "active" : ""}`}
            onClick={() => {
              setActiveTab("anime");
              setSearchQuery("");
            }}
            data-tv-focusable="true"
          >
            Аниме
          </button>
          <button
            type="button"
            className={`has-cinema-nav-item ${activeTab === "bookmarks" && !searchQuery ? "active" : ""}`}
            onClick={() => {
              setActiveTab("bookmarks");
              setSearchQuery("");
            }}
            data-tv-focusable="true"
          >
            Мой список {cinemaState.bookmarks.length > 0 && `(${cinemaState.bookmarks.length})`}
          </button>
        </nav>

        <div className="has-cinema-header-right">

          {/* Universal Search Box */}
          <div className="has-cinema-search-wrapper">
            <div className="has-cinema-search-box">
              <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="11" cy="11" r="8" strokeWidth={2} />
                <line x1="21" y1="21" x2="16.65" y2="16.65" strokeWidth={2} strokeLinecap="round" />
              </svg>
              <input
                type="text"
                placeholder="Поиск любых фильмов и сериалов..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="has-cinema-search-input"
                data-tv-focusable="true"
              />
              {isSearching && <span className="has-cinema-search-spinner" />}
              {searchQuery && (
                <button
                  type="button"
                  className="has-cinema-search-clear-btn"
                  onClick={() => setSearchQuery("")}
                  data-tv-focusable="true"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* User profile avatar */}
          <div className="has-cinema-user-avatar" title={currentUser.email}>
            {currentUser.avatar ? (
              <img src={currentUser.avatar} alt="User" className="has-cinema-user-avatar-img" />
            ) : (
              <span className="has-cinema-user-avatar-text">
                {(currentUser.username || currentUser.email || "U").slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* ========================================================
          TV SEARCH VIEW (When activeTab === "search" in TV Mode)
          ======================================================== */}
      {isTvMode && activeTab === "search" && (
        <section className="has-cinema-tv-search-page">
          <div className="has-cinema-tv-search-box-wrap">
            <span className="has-cinema-tv-search-lens">🔍</span>
            <input
              type="text"
              className="has-cinema-tv-search-input-field"
              placeholder="Введите название фильма, сериала или аниме..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-tv-focusable="true"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                className="has-cinema-tv-search-clear-btn"
                onClick={() => setSearchQuery("")}
                data-tv-focusable="true"
                title="Очистить"
              >
                ✕
              </button>
            )}
          </div>
          {searchQuery.trim().length === 0 && (
            <div className="has-cinema-tv-search-hint">
              <span>💡 Введите название с клавиатуры или пульта. Нажмите Влево с края для вызова меню.</span>
            </div>
          )}
        </section>
      )}

      {/* ========================================================
          SEARCH RESULTS FULL GRID VIEW (When Searching)
          ======================================================== */}
      {searchQuery.trim().length >= 2 ? (
        <section className="has-cinema-search-page-section">
          <div className="has-cinema-search-header-row">
            <h1 className="has-cinema-search-page-title">
              Результаты поиска по запросу «{searchQuery}»
            </h1>
            <span className="has-cinema-search-count-badge">
              Найдено: {searchResults.length}
            </span>
          </div>

          {searchResults.length === 0 ? (
            <div className="has-cinema-empty-bookmarks">
              <span>{isSearching ? "Поиск в международной базе фильмов..." : "Ничего не найдено по данному запросу."}</span>
              <span className="has-cinema-empty-sub">
                Попробуйте ввести оригинальное название на английском или уточнить запрос.
              </span>
            </div>
          ) : (
            <div className="has-cinema-grid-cards">
              {searchResults.map((item) => (
                <div
                  key={item.id}
                  className="has-cinema-grid-card"
                  onClick={() => handleMediaCardClick(item)}
                  data-tv-focusable="true"
                  tabIndex={0}
                  role="button"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " " || e.keyCode === 23 || e.keyCode === 66) {
                      e.preventDefault();
                      handleMediaCardClick(item);
                    }
                  }}
                >
                  <div className="has-cinema-media-thumb-box">
                    <img src={item.poster_url} alt={item.title} className="has-cinema-media-thumb" loading="lazy" />
                    <div className="has-cinema-media-badge-rating">★ {item.rating}</div>
                    <div className="has-cinema-media-play-overlay">
                      <div className="has-cinema-media-play-circle">▶</div>
                    </div>
                  </div>
                  <div className="has-cinema-media-meta">
                    <span className="has-cinema-media-title">{item.title}</span>
                    <span className="has-cinema-media-sub">
                      {item.release_year} • {getMediaCategoryLabel(item)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        <>
          {/* ========================================================
              2. HERO FEATURED BANNER
              ======================================================== */}
          <section className="has-cinema-hero">
            <div className="has-cinema-hero-bg-wrapper">
              <img
                src={selectedMedia.backdrop_url}
                alt={selectedMedia.title}
                className="has-cinema-hero-bg-img"
              />
              <div className="has-cinema-hero-gradient-overlay" />
              <div className="has-cinema-hero-bottom-fade" />
            </div>

            <div className="has-cinema-hero-content">
              {/* Badge */}
              <div className="has-cinema-category-pill">
                {getMediaCategoryLabel(selectedMedia)}
              </div>

              {/* Title */}
              <h1 className="has-cinema-hero-title">{selectedMedia.title}</h1>

              {/* Metadata Row */}
              <div className="has-cinema-meta-row">
                <span className="has-cinema-meta-year">{selectedMedia.release_year}</span>
                {selectedMedia.media_type !== "movie" && selectedMedia.seasons_count && (
                  <span className="has-cinema-meta-seasons">
                    {selectedMedia.seasons_count}{" "}
                    {selectedMedia.seasons_count === 1
                      ? "сезон"
                      : selectedMedia.seasons_count < 5
                      ? "сезона"
                      : "сезонов"}
                  </span>
                )}
                {selectedMedia.duration_minutes && (
                  <span className="has-cinema-meta-duration">{selectedMedia.duration_minutes} мин</span>
                )}
                <span className="has-cinema-meta-genre-pill">{selectedMedia.genre}</span>
                <div className="has-cinema-meta-stars">
                  <span className="has-cinema-stars-gold">★★★★★</span>
                  <span className="has-cinema-rating-num">{selectedMedia.rating}</span>
                </div>
              </div>

              {/* Synopsis */}
              <p className="has-cinema-hero-synopsis">{selectedMedia.synopsis}</p>

              {/* Action Buttons: Play + Bookmark + Info */}
              <div className="has-cinema-hero-actions">
                <button
                  type="button"
                  className="has-cinema-btn-play"
                  onClick={handleHeroPlay}
                  data-tv-focusable="true"
                >
                  <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  <span>
                    {selectedMedia.media_type === "movie" ? "Смотреть фильм" : "Смотреть S1 E1"}
                  </span>
                </button>

                <button
                  type="button"
                  className={`has-cinema-btn-circle ${isBookmarked ? "bookmarked" : ""}`}
                  onClick={handleToggleBookmark}
                  title={isBookmarked ? "Удалить из списка" : "Добавить в список"}
                  data-tv-focusable="true"
                >
                  {isBookmarked ? "✓" : "+"}
                </button>

                <button
                  type="button"
                  className="has-cinema-btn-info-wide"
                  onClick={() => handleMediaCardClick(selectedMedia)}
                  title="Подробная информация о тайтле (актеры, бюджет, рейтинг)"
                  data-tv-focusable="true"
                >
                  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  <span>О фильме</span>
                </button>

                <button
                  type="button"
                  className="has-cinema-btn-circle"
                  title="Информация о тайтле"
                  onClick={() => handleMediaCardClick(selectedMedia)}
                  data-tv-focusable="true"
                >
                  ⓘ
                </button>
              </div>
            </div>
          </section>

          {/* ========================================================
              3. SEASONS TABS & EPISODES (For TV Series & Anime)
              ======================================================== */}
          {selectedMedia.media_type !== "movie" && selectedMedia.seasons.length > 0 && (
            <section className="has-cinema-seasons-section">
              <div className="has-cinema-season-tabs">
                {selectedMedia.seasons.map((season) => (
                  <button
                    key={season.season_number}
                    type="button"
                    className={`has-cinema-season-tab ${
                      selectedSeason === season.season_number ? "active" : ""
                    }`}
                    onClick={() => {
                      setSelectedSeason(season.season_number);
                      if (selectedMedia.tmdb_id) {
                        loadTvSeasonsDetails(selectedMedia.tmdb_id, season.season_number);
                      }
                    }}
                    data-tv-focusable="true"
                  >
                    Сезон {season.season_number}
                  </button>
                ))}
              </div>

              {/* Horizontal Carousel of Episodes */}
              <div className="has-cinema-episodes-carousel">
                {currentSeasonData.episodes.map((ep) => {
                  const progress = getEpisodeProgress(selectedSeason, ep.number);
                  return (
                    <div
                      key={ep.id}
                      className="has-cinema-episode-card"
                      onClick={() => handlePlayEpisode(selectedSeason, ep)}
                      data-tv-focusable="true"
                      tabIndex={0}
                      role="button"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " " || e.keyCode === 23 || e.keyCode === 66) {
                          e.preventDefault();
                          handlePlayEpisode(selectedSeason, ep);
                        }
                      }}
                      title={`Смотреть: Сезон ${selectedSeason}, Серия ${ep.number} — ${ep.title}`}
                    >
                      <div className="has-cinema-ep-thumb-box">
                        <img src={ep.thumbnail} alt={ep.title} className="has-cinema-ep-thumb" />
                        <div className="has-cinema-ep-card-badge">S</div>
                        <div className="has-cinema-ep-hover-play">
                          <svg width={32} height={32} viewBox="0 0 24 24" fill="white">
                            <circle
                              cx="12"
                              cy="12"
                              r="11"
                              fill="rgba(0,0,0,0.5)"
                              stroke="white"
                              strokeWidth={1.5}
                            />
                            <path d="M10 8l6 4-6 4V8z" />
                          </svg>
                        </div>
                      </div>

                      <div className="has-cinema-ep-info">
                        <div className="has-cinema-ep-title">
                          {ep.title.startsWith("Серия") ? ep.title : `${ep.number}. ${ep.title}`}
                        </div>
                        {ep.duration_minutes && (
                          <div className="has-cinema-ep-duration">{ep.duration_minutes} мин</div>
                        )}
                      </div>

                      <div className="has-cinema-ep-progress-bar">
                        <div
                          className="has-cinema-ep-progress-fill"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ========================================================
              4. FULL CATALOG ROWS & COLLECTIONS (All Movies & Series)
              ======================================================== */}
          <div className="has-cinema-rows-container">
            {/* Row 1: Continue Watching */}
            {cinemaState.history.length > 0 && activeTab === "home" && (
              <div className="has-cinema-row-block">
                <h2 className="has-cinema-row-title">Продолжить просмотр</h2>
                <div className="has-cinema-cards-scroll">
                  {cinemaState.history.map((h, i) => {
                    const percent =
                      h.duration_seconds > 0
                        ? Math.min(100, Math.round((h.progress_seconds / h.duration_seconds) * 100))
                        : 0;
                    return (
                      <div
                        key={`${h.title_id}-${i}`}
                        className="has-cinema-media-card"
                        onClick={() => {
                          const found = [
                            ...allTrending,
                            ...allMoviesList,
                            ...allSeriesList,
                            ...allAnimeList,
                          ].find((item) => item.id === h.title_id);
                          if (found) {
                            handleMediaCardClick(found);
                          } else {
                            const tmdbMatch = h.title_id.match(/tmdb-(movie|tv)-(\d+)/);
                            const isTv = tmdbMatch ? tmdbMatch[1] === "tv" : h.season > 0 && h.episode > 0;
                            const tmdbId = tmdbMatch ? parseInt(tmdbMatch[2], 10) : undefined;
                            const fallbackItem: CinemaMediaItem = {
                              id: h.title_id,
                              tmdb_id: tmdbId,
                              media_type: isTv ? "tv" : "movie",
                              title: h.title_name,
                              poster_url: h.poster_path || INITIAL_LIBRARY[0].poster_url,
                              backdrop_url: h.backdrop_path || INITIAL_LIBRARY[0].backdrop_url,
                              genre: isTv ? "Сериал" : "Фильм",
                              synopsis: `Продолжение просмотра: ${h.title_name}`,
                              release_year: "2024",
                              rating: 8.5,
                              is_original: false,
                              seasons: [
                                {
                                  season_number: h.season || 1,
                                  episodes: [
                                    {
                                      id: `ep-${h.title_id}-${h.season}-${h.episode}`,
                                      number: h.episode || 1,
                                      title: `Серия ${h.episode || 1}`,
                                      thumbnail: h.poster_path || INITIAL_LIBRARY[0].poster_url,
                                      duration_minutes: Math.round((h.duration_seconds || 3600) / 60),
                                    },
                                  ],
                                },
                              ],
                            };
                            handleMediaCardClick(fallbackItem);
                          }
                        }}
                        data-tv-focusable="true"
                        tabIndex={0}
                        role="button"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " " || e.keyCode === 23 || e.keyCode === 66) {
                            e.preventDefault();
                            const found = [
                              ...allTrending,
                              ...allMoviesList,
                              ...allSeriesList,
                              ...allAnimeList,
                            ].find((item) => item.id === h.title_id);
                            if (found) {
                              handleMediaCardClick(found);
                            } else {
                              const tmdbMatch = h.title_id.match(/tmdb-(movie|tv)-(\d+)/);
                              const isTv = tmdbMatch ? tmdbMatch[1] === "tv" : h.season > 0 && h.episode > 0;
                              const tmdbId = tmdbMatch ? parseInt(tmdbMatch[2], 10) : undefined;
                              const fallbackItem: CinemaMediaItem = {
                                id: h.title_id,
                                tmdb_id: tmdbId,
                                media_type: isTv ? "tv" : "movie",
                                title: h.title_name,
                                poster_url: h.poster_path || INITIAL_LIBRARY[0].poster_url,
                                backdrop_url: h.backdrop_path || INITIAL_LIBRARY[0].backdrop_url,
                                genre: isTv ? "Сериал" : "Фильм",
                                synopsis: `Продолжение просмотра: ${h.title_name}`,
                                release_year: "2024",
                                rating: 8.5,
                                is_original: false,
                                seasons: [
                                  {
                                    season_number: h.season || 1,
                                    episodes: [
                                      {
                                        id: `ep-${h.title_id}-${h.season}-${h.episode}`,
                                        number: h.episode || 1,
                                        title: `Серия ${h.episode || 1}`,
                                        thumbnail: h.poster_path || INITIAL_LIBRARY[0].poster_url,
                                        duration_minutes: Math.round((h.duration_seconds || 3600) / 60),
                                      },
                                    ],
                                  },
                                ],
                              };
                              handleMediaCardClick(fallbackItem);
                            }
                          }
                        }}
                      >
                        <div className="has-cinema-media-thumb-box">
                          <img
                            src={h.poster_path || h.backdrop_path || INITIAL_LIBRARY[0].poster_url}
                            alt={h.title_name}
                            className="has-cinema-media-thumb"
                            loading="lazy"
                          />
                          <div className="has-cinema-media-play-overlay">
                            <div className="has-cinema-media-play-circle">▶</div>
                          </div>
                          <div className="has-cinema-ep-progress-bar">
                            <div
                              className="has-cinema-ep-progress-fill"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                        <div className="has-cinema-media-meta">
                          <span className="has-cinema-media-title">{h.title_name}</span>
                          <span className="has-cinema-media-sub">
                            {h.season > 0 ? `Сезон ${h.season}, Серия ${h.episode}` : "Фильм"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Row 2: In Trend (All Movies & Series) */}
            {activeTab === "home" && allTrending.length > 0 && (
              <div className="has-cinema-row-block">
                <h2 className="has-cinema-row-title">В тренде на этой неделе</h2>
                <div className="has-cinema-cards-scroll">
                  {allTrending.map((item) => (
                    <div
                      key={item.id}
                      className="has-cinema-media-card"
                      onClick={() => handleMediaCardClick(item)}
                      data-tv-focusable="true"
                      tabIndex={0}
                      role="button"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " " || e.keyCode === 23 || e.keyCode === 66) {
                          e.preventDefault();
                          handleMediaCardClick(item);
                        }
                      }}
                    >
                      <div className="has-cinema-media-thumb-box">
                        <img src={item.poster_url} alt={item.title} className="has-cinema-media-thumb" loading="lazy" />
                        <div className="has-cinema-media-badge-rating">★ {item.rating}</div>
                        <div className="has-cinema-media-play-overlay">
                          <div className="has-cinema-media-play-circle">▶</div>
                        </div>
                      </div>
                      <div className="has-cinema-media-meta">
                        <span className="has-cinema-media-title">{item.title}</span>
                        <span className="has-cinema-media-sub">
                          {item.release_year} • {getMediaCategoryLabel(item)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Row 3: All Movies */}
            {(activeTab === "home" || activeTab === "movies") && (
              <div className="has-cinema-row-block">
                <h2 className="has-cinema-row-title">
                  {activeTab === "movies" ? "Все популярные фильмы" : "Фильмы"}
                </h2>
                <div className={activeTab === "movies" ? "has-cinema-grid-cards" : "has-cinema-cards-scroll"}>
                  {allMoviesList.map((movie) => (
                    <div
                      key={movie.id}
                      className={activeTab === "movies" ? "has-cinema-grid-card" : "has-cinema-media-card"}
                      onClick={() => handleMediaCardClick(movie)}
                      data-tv-focusable="true"
                      tabIndex={0}
                      role="button"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " " || e.keyCode === 23 || e.keyCode === 66) {
                          e.preventDefault();
                          handleMediaCardClick(movie);
                        }
                      }}
                    >
                      <div className="has-cinema-media-thumb-box">
                        <img src={movie.poster_url} alt={movie.title} className="has-cinema-media-thumb" loading="lazy" />
                        <div className="has-cinema-media-badge-rating">★ {movie.rating}</div>
                        <div className="has-cinema-media-play-overlay">
                          <div className="has-cinema-media-play-circle">▶</div>
                        </div>
                      </div>
                      <div className="has-cinema-media-meta">
                        <span className="has-cinema-media-title">{movie.title}</span>
                        <span className="has-cinema-media-sub">
                          {movie.release_year} • {movie.genre}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Row 4: All TV Series */}
            {(activeTab === "home" || activeTab === "series") && (
              <div className="has-cinema-row-block">
                <h2 className="has-cinema-row-title">
                  {activeTab === "series" ? "Все популярные сериалы" : "Сериалы"}
                </h2>
                <div className={activeTab === "series" ? "has-cinema-grid-cards" : "has-cinema-cards-scroll"}>
                  {allSeriesList.map((series) => (
                    <div
                      key={series.id}
                      className={activeTab === "series" ? "has-cinema-grid-card" : "has-cinema-media-card"}
                      onClick={() => handleMediaCardClick(series)}
                      data-tv-focusable="true"
                      tabIndex={0}
                      role="button"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " " || e.keyCode === 23 || e.keyCode === 66) {
                          e.preventDefault();
                          handleMediaCardClick(series);
                        }
                      }}
                    >
                      <div className="has-cinema-media-thumb-box">
                        <img src={series.poster_url} alt={series.title} className="has-cinema-media-thumb" loading="lazy" />
                        <div className="has-cinema-media-badge-rating">★ {series.rating}</div>
                        <div className="has-cinema-media-play-overlay">
                          <div className="has-cinema-media-play-circle">▶</div>
                        </div>
                      </div>
                      <div className="has-cinema-media-meta">
                        <span className="has-cinema-media-title">{series.title}</span>
                        <span className="has-cinema-media-sub">
                          {series.release_year} • {series.seasons_count || 1} сезонов
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Row 5: All Anime */}
            {(activeTab === "home" || activeTab === "anime") && (
              <div className="has-cinema-row-block">
                <h2 className="has-cinema-row-title">
                  {activeTab === "anime" ? "Все популярные аниме" : "Аниме & Мультфильмы"}
                </h2>
                <div className={activeTab === "anime" ? "has-cinema-grid-cards" : "has-cinema-cards-scroll"}>
                  {allAnimeList.map((anime) => (
                    <div
                      key={anime.id}
                      className={activeTab === "anime" ? "has-cinema-grid-card" : "has-cinema-media-card"}
                      onClick={() => handleMediaCardClick(anime)}
                      data-tv-focusable="true"
                      tabIndex={0}
                      role="button"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " " || e.keyCode === 23 || e.keyCode === 66) {
                          e.preventDefault();
                          handleMediaCardClick(anime);
                        }
                      }}
                    >
                      <div className="has-cinema-media-thumb-box">
                        <img src={anime.poster_url} alt={anime.title} className="has-cinema-media-thumb" loading="lazy" />
                        <div className="has-cinema-media-badge-rating">★ {anime.rating}</div>
                        <div className="has-cinema-media-play-overlay">
                          <div className="has-cinema-media-play-circle">▶</div>
                        </div>
                      </div>
                      <div className="has-cinema-media-meta">
                        <span className="has-cinema-media-title">{anime.title}</span>
                        <span className="has-cinema-media-sub">
                          {anime.release_year} • {anime.genre}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Row 6: My Bookmarks List */}
            {activeTab === "bookmarks" && (
              <div className="has-cinema-row-block">
                <h2 className="has-cinema-row-title">Мой список закладок</h2>
                {bookmarkedItems.length === 0 ? (
                  <div className="has-cinema-empty-bookmarks">
                    <span>В вашем списке пока нет сохраненных фильмов или сериалов.</span>
                    <span className="has-cinema-empty-sub">
                      Нажмите на кнопку <strong>+</strong> на баннере любого тайтла, чтобы добавить его сюда.
                    </span>
                  </div>
                ) : (
                  <div className="has-cinema-grid-cards">
                    {bookmarkedItems.map((item) => (
                      <div
                        key={item.id}
                        className="has-cinema-grid-card"
                        onClick={() => handleMediaCardClick(item)}
                        data-tv-focusable="true"
                        tabIndex={0}
                        role="button"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " " || e.keyCode === 23 || e.keyCode === 66) {
                            e.preventDefault();
                            handleMediaCardClick(item);
                          }
                        }}
                      >
                        <div className="has-cinema-media-thumb-box">
                          <img src={item.poster_url} alt={item.title} className="has-cinema-media-thumb" loading="lazy" />
                          <div className="has-cinema-media-badge-rating">★ {item.rating}</div>
                          <div className="has-cinema-media-play-overlay">
                            <div className="has-cinema-media-play-circle">▶</div>
                          </div>
                        </div>
                        <div className="has-cinema-media-meta">
                          <span className="has-cinema-media-title">{item.title}</span>
                          <span className="has-cinema-media-sub">
                            {item.release_year} • {getMediaCategoryLabel(item)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ========================================================
          4.5. DETAILED MOVIE & SERIES INFORMATION MODAL
          ======================================================== */}
      {detailsMedia && !playingEpisode && (
        <div
          className="has-cinema-details-overlay"
          onClick={() => setDetailsMedia(null)}
        >
          <div
            className="has-cinema-details-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {/* Background Backdrop with Gradient Fades */}
            <div className="has-cinema-details-backdrop-wrap">
              <img
                src={detailsMedia.backdrop_url || detailsMedia.poster_url}
                alt={detailsMedia.title}
                className="has-cinema-details-backdrop-img"
              />
              <div className="has-cinema-details-backdrop-gradient" />
              <button
                type="button"
                className="has-cinema-details-close-btn"
                onClick={() => setDetailsMedia(null)}
                title="Закрыть (Back / Esc)"
                data-tv-focusable="true"
              >
                ✕
              </button>
            </div>

            <div className="has-cinema-details-body">
              {/* Top Hero Grid: Poster on Left, Main Info on Right */}
              <div className="has-cinema-details-hero">
                <div className="has-cinema-details-poster-box">
                  <img
                    src={detailsMedia.poster_url}
                    alt={detailsMedia.title}
                    className="has-cinema-details-poster-img"
                  />
                  <div className="has-cinema-details-poster-badges">
                    <span className="has-cinema-badge-rating">
                      ★ {detailsMedia.rating}
                    </span>
                    {detailsMedia.kinopoisk_rating && (
                      <span className="has-cinema-badge-kp">
                        {detailsMedia.kinopoisk_rating}
                      </span>
                    )}
                    <span className="has-cinema-badge-type">
                      {getMediaBadgeLabel(detailsMedia)}
                    </span>
                  </div>
                </div>

                <div className="has-cinema-details-info-col">
                  <div className="has-cinema-details-type-pill">
                    {getMediaCategoryLabel(detailsMedia)}
                  </div>

                  <h1 className="has-cinema-details-title">{detailsMedia.title}</h1>
                  {detailsMedia.original_title && detailsMedia.original_title !== detailsMedia.title && (
                    <h2 className="has-cinema-details-orig-title">
                      {detailsMedia.original_title}
                    </h2>
                  )}

                  {detailsMedia.tagline && (
                    <p className="has-cinema-details-tagline">
                      «{detailsMedia.tagline}»
                    </p>
                  )}

                  {/* Quick Stats Badges */}
                  <div className="has-cinema-details-meta-row">
                    <span className="has-cinema-details-chip chip-year">
                      📅 {detailsMedia.release_year}
                    </span>

                    {detailsMedia.duration_minutes && detailsMedia.duration_minutes > 0 && (
                      <span className="has-cinema-details-chip chip-time">
                        ⏱ {formatRuntime(detailsMedia.duration_minutes)}
                      </span>
                    )}

                    {detailsMedia.seasons_count && detailsMedia.media_type !== "movie" && (
                      <span className="has-cinema-details-chip chip-seasons">
                        📺 Сезонов: {detailsMedia.seasons_count}
                      </span>
                    )}

                    {detailsMedia.genre && (
                      <span className="has-cinema-details-chip chip-genre">
                        🎭 {detailsMedia.genre}
                      </span>
                    )}

                    {detailsMedia.countries && (
                      <span className="has-cinema-details-chip chip-country">
                        🌍 {detailsMedia.countries}
                      </span>
                    )}
                  </div>

                  {/* Financial & Production Specs Grid */}
                  <div className="has-cinema-details-specs-grid">
                    <div className="has-cinema-spec-item">
                      <span className="has-cinema-spec-label">Рейтинг:</span>
                      <span className="has-cinema-spec-value rating-highlight">
                        ★ {detailsMedia.rating} / 10
                      </span>
                    </div>

                    {detailsMedia.director && (
                      <div className="has-cinema-spec-item">
                        <span className="has-cinema-spec-label">
                          {detailsMedia.media_type === "movie" ? "Режиссер:" : "Создатели / Режиссер:"}
                        </span>
                        <span className="has-cinema-spec-value">{detailsMedia.director}</span>
                      </div>
                    )}

                    {detailsMedia.media_type === "movie" && detailsMedia.budget && detailsMedia.budget > 0 ? (
                      <div className="has-cinema-spec-item">
                        <span className="has-cinema-spec-label">Бюджет фильма:</span>
                        <span className="has-cinema-spec-value">
                          💰 {formatCurrency(detailsMedia.budget)}
                        </span>
                      </div>
                    ) : null}

                    {detailsMedia.media_type === "movie" && detailsMedia.revenue && detailsMedia.revenue > 0 ? (
                      <div className="has-cinema-spec-item">
                        <span className="has-cinema-spec-label">Сборы в мире:</span>
                        <span className="has-cinema-spec-value revenue-highlight">
                          💵 {formatCurrency(detailsMedia.revenue)}
                        </span>
                      </div>
                    ) : null}

                    {detailsMedia.media_type === "movie" && !detailsMedia.budget && !detailsMedia.revenue && (
                      <div className="has-cinema-spec-item">
                        <span className="has-cinema-spec-label">Формат:</span>
                        <span className="has-cinema-spec-value">🎬 Полнометражный фильм</span>
                      </div>
                    )}
                  </div>

                  {detailsMedia.is_unreleased && (
                    <div
                      style={{
                        margin: "12px 0 16px 0",
                        padding: "10px 14px",
                        borderRadius: 10,
                        background: "rgba(234, 179, 8, 0.12)",
                        border: "1px solid rgba(234, 179, 8, 0.3)",
                        color: "#fde047",
                        fontSize: 13,
                        lineHeight: 1.5,
                      }}
                    >
                      ⏳ <strong>Премьера ожидается:</strong> Фильм запланирован к выходу (
                      {detailsMedia.release_date_full || detailsMedia.release_year}). Цифровой плеер
                      станет доступен сразу после официального цифрового релиза.
                    </div>
                  )}

                  {/* Action Buttons: Play + Bookmark + Trailer */}
                  <div className="has-cinema-details-actions-row">
                    <button
                      type="button"
                      className="has-cinema-details-btn-play"
                      style={
                        detailsMedia.is_unreleased
                          ? { opacity: 0.6, cursor: "not-allowed", filter: "grayscale(0.4)" }
                          : undefined
                      }
                      onClick={() => {
                        if (detailsMedia.is_unreleased) {
                          showTvToast("Фильм ещё не вышел в цифровой прокат", "⏳", 3000);
                          return;
                        }
                        handlePlayFromDetails(1, detailsMedia.seasons[0]?.episodes[0]);
                      }}
                      data-tv-focusable="true"
                    >
                      <svg width={20} height={20} viewBox="0 0 24 24" fill="currentColor">
                        {detailsMedia.is_unreleased ? (
                          <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z" />
                        ) : (
                          <path d="M8 5v14l11-7z" />
                        )}
                      </svg>
                      <span>
                        {detailsMedia.is_unreleased
                          ? "Скоро в кино"
                          : detailsMedia.media_type === "movie"
                          ? "Смотреть фильм"
                          : "Смотреть 1 серию"}
                      </span>
                    </button>

                    <button
                      type="button"
                      className={`has-cinema-details-btn-bookmark ${
                        cinemaState.bookmarks.includes(detailsMedia.id) ? "active" : ""
                      }`}
                      onClick={handleToggleBookmarkDetails}
                      data-tv-focusable="true"
                    >
                      {cinemaState.bookmarks.includes(detailsMedia.id) ? "✓ В списке" : "+ В закладки"}
                    </button>

                    {detailsMedia.trailer_youtube_key && (
                      <button
                        type="button"
                        className="has-cinema-details-btn-trailer"
                        onClick={() => setShowTrailerModal(true)}
                        data-tv-focusable="true"
                      >
                        ▶ Трейлер
                      </button>
                    )}

                    {isLoadingDetails && (
                      <span className="has-cinema-details-loading-badge">Загрузка данных...</span>
                    )}
                  </div>

                  {/* Description / Synopsis */}
                  <div className="has-cinema-details-synopsis-section">
                    <h3 className="has-cinema-details-section-title">
                      {detailsMedia.media_type === "movie" ? "О фильме" : "О сериале"}
                    </h3>
                    <p className="has-cinema-details-synopsis-text">
                      {detailsMedia.synopsis}
                    </p>
                  </div>
                </div>
              </div>

              {/* Actors / Cast Carousel */}
              {detailsMedia.cast && detailsMedia.cast.length > 0 && (
                <div className="has-cinema-details-cast-section">
                  <h3 className="has-cinema-details-section-title">В главных ролях (Актеры)</h3>
                  <div className="has-cinema-details-cast-carousel">
                    {detailsMedia.cast.map((actor) => (
                      <div
                        key={actor.id}
                        className="has-cinema-actor-card"
                        data-tv-focusable="true"
                        tabIndex={0}
                        title={`${actor.name}${actor.character ? ` — ${actor.character}` : ""}`}
                      >
                        <div className="has-cinema-actor-photo-box">
                          {actor.profile_path ? (
                            <img
                              src={actor.profile_path}
                              alt={actor.name}
                              className="has-cinema-actor-photo"
                              loading="lazy"
                            />
                          ) : (
                            <div className="has-cinema-actor-photo-placeholder">
                              {actor.name.slice(0, 1).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="has-cinema-actor-name">{actor.name}</div>
                        {actor.character && (
                          <div className="has-cinema-actor-character">{actor.character}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ========================================================
                  IF TV SERIES OR ANIME: SHOW SEASONS & EPISODES
                  IF MOVIE: ABSOLUTELY NO SEASONS OR EPISODES!
                  ======================================================== */}
              {detailsMedia.media_type !== "movie" && detailsMedia.seasons.length > 0 && (
                <div className="has-cinema-details-seasons-section">
                  <h3 className="has-cinema-details-section-title">Сезоны и серии</h3>
                  <div className="has-cinema-season-tabs">
                    {detailsMedia.seasons.map((season) => (
                      <button
                        key={season.season_number}
                        type="button"
                        className={`has-cinema-season-tab ${
                          selectedSeason === season.season_number ? "active" : ""
                        }`}
                        onClick={() => {
                          setSelectedSeason(season.season_number);
                          if (detailsMedia.tmdb_id) {
                            loadTvSeasonsDetails(detailsMedia.tmdb_id, season.season_number);
                          }
                        }}
                        data-tv-focusable="true"
                      >
                        Сезон {season.season_number}
                      </button>
                    ))}
                  </div>

                  <div className="has-cinema-episodes-carousel">
                    {((detailsMedia.seasons.find((s) => s.season_number === selectedSeason) ||
                      detailsMedia.seasons[0])?.episodes || []).map((ep) => (
                      <div
                        key={ep.id}
                        className="has-cinema-episode-card"
                        onClick={() => handlePlayFromDetails(selectedSeason, ep)}
                        data-tv-focusable="true"
                        tabIndex={0}
                        role="button"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " " || e.keyCode === 23 || e.keyCode === 66) {
                            e.preventDefault();
                            handlePlayFromDetails(selectedSeason, ep);
                          }
                        }}
                      >
                        <div className="has-cinema-ep-thumb-box">
                          <img src={ep.thumbnail} alt={ep.title} className="has-cinema-ep-thumb" />
                          <div className="has-cinema-ep-hover-play">
                            <div className="has-cinema-media-play-circle">▶</div>
                          </div>
                        </div>
                        <div className="has-cinema-ep-info">
                          <div className="has-cinema-ep-title">
                            {ep.number}. {ep.title}
                          </div>
                          {ep.duration_minutes && (
                            <div className="has-cinema-ep-duration">{ep.duration_minutes} мин</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          TRAILER MODAL
          ======================================================== */}
      {showTrailerModal && detailsMedia?.trailer_youtube_key && (
        <div
          className="has-cinema-trailer-modal-overlay"
          onClick={() => setShowTrailerModal(false)}
        >
          <div
            className="has-cinema-trailer-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="has-cinema-trailer-header">
              <span className="has-cinema-trailer-title">
                Трейлер: {detailsMedia.title}
              </span>
              <button
                type="button"
                className="has-cinema-trailer-close-btn"
                onClick={() => setShowTrailerModal(false)}
                data-tv-focusable="true"
              >
                ✕ Закрыть
              </button>
            </div>
            <div className="has-cinema-trailer-video-box">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${detailsMedia.trailer_youtube_key}?autoplay=1&rel=0`}
                title={`Трейлер ${detailsMedia.title}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="has-cinema-trailer-iframe"
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          5. UNIVERSAL STREAMING VIDEO PLAYER (CLEAN & MINIMAL)
          ======================================================== */}
      {playingEpisode && (
        <div
          className={`has-cinema-player-modal ${isFullscreen ? "fullscreen-mode" : ""} ${
            !isHudVisible ? "hud-hidden" : ""
          }`}
          onMouseMove={resetHudTimer}
          onClick={resetHudTimer}
        >
          {/* Top Edge Sensor: triggers HUD immediately when cursor moves to top 90px of screen */}
          <div
            className="has-cinema-player-top-sensor"
            onMouseEnter={() => {
              setIsHudVisible(true);
              resetHudTimer();
            }}
            onMouseMove={resetHudTimer}
          />

          {/* Elegant Floating Top HUD Bar */}
          <div
            className={`has-cinema-player-top-hud ${!isHudVisible ? "hud-hidden" : ""}`}
            onMouseEnter={() => {
              setIsHudVisible(true);
              resetHudTimer();
            }}
            onMouseMove={resetHudTimer}
          >
            <div className="has-cinema-player-hud-left">
              <button
                type="button"
                className="has-cinema-player-btn-back"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClosePlayer();
                }}
                onTouchEnd={(e) => {
                  e.stopPropagation();
                  handleClosePlayer();
                }}
                onMouseEnter={() => {
                  setIsHudVisible(true);
                  resetHudTimer();
                }}
                onFocus={() => {
                  setIsHudVisible(true);
                  resetHudTimer();
                }}
                title="Назад к информации о фильме (Esc / Back / ▲)"
                data-tv-focusable="true"
              >
                ← Назад
              </button>

              <div className="has-cinema-player-title-box">
                <span className="has-cinema-player-hud-title">
                  {(playingMedia || selectedMedia).title}
                </span>
                {(playingMedia || selectedMedia).media_type !== "movie" ? (
                  <span className="has-cinema-player-hud-subtitle">
                    Сезон {playingSeasonNumber}, Серия {playingEpisode.number}: {playingEpisode.title}
                  </span>
                ) : (
                  <span className="has-cinema-player-hud-subtitle">Полный фильм</span>
                )}
              </div>

              {(playingMedia || selectedMedia).media_type !== "movie" && (
                <div className="has-cinema-player-quick-ep-nav">
                  <button
                    type="button"
                    className="has-cinema-player-pill-nav"
                    disabled={playingEpisode.number <= 1}
                    onClick={handlePrevEpisode}
                    title="Предыдущая серия"
                    data-tv-focusable="true"
                  >
                    ◀ Пред.
                  </button>
                  <button
                    type="button"
                    className="has-cinema-player-pill-nav"
                    onClick={handleNextEpisode}
                    title="Следующая серия"
                    data-tv-focusable="true"
                  >
                    След. ▶
                  </button>
                </div>
              )}
            </div>

            <div className="has-cinema-player-hud-right">
              {/* Episodes button for Series only */}
              {(playingMedia || selectedMedia).media_type !== "movie" && (
                <button
                  type="button"
                  className={`has-cinema-player-hud-btn ${showPlayerEpisodes ? "active" : ""}`}
                  onClick={() => {
                    setShowPlayerEpisodes((prev) => !prev);
                    setShowPlayerSettings(false);
                    resetHudTimer();
                  }}
                  title="Список серий"
                  data-tv-focusable="true"
                >
                  📺 Серии
                </button>
              )}

              {/* Server selector buttons right in the HUD */}
              <div className="has-cinema-player-hud-servers">
                <button
                  type="button"
                  className={`has-cinema-player-server-pill ${selectedMirror === "vidlink_pro" ? "active" : ""}`}
                  onClick={() => handleSelectMirror("vidlink_pro")}
                  title="Сервер 1: Скоростной Full HD 1080p"
                  data-tv-focusable="true"
                >
                  ⚡ Сервер 1 (1080p)
                </button>
                <button
                  type="button"
                  className={`has-cinema-player-server-pill ${selectedMirror === "kodik_ru" ? "active" : ""}`}
                  onClick={() => handleSelectMirror("kodik_ru")}
                  title="Сервер 2: Студии дубляжа (Kodik)"
                  data-tv-focusable="true"
                >
                  🎙️ Сервер 2 (Дубляж)
                </button>
                <button
                  type="button"
                  className={`has-cinema-player-server-pill ${selectedMirror === "autoembed" ? "active" : ""}`}
                  onClick={() => handleSelectMirror("autoembed")}
                  title="Сервер 3: AutoEmbed"
                  data-tv-focusable="true"
                >
                  🌐 Сервер 3
                </button>
                <button
                  type="button"
                  className={`has-cinema-player-server-pill ${selectedMirror === "vidsrc_pm" ? "active" : ""}`}
                  onClick={() => handleSelectMirror("vidsrc_pm")}
                  title="Сервер 4: VidSrc"
                  data-tv-focusable="true"
                >
                  🎬 Сервер 4
                </button>
                <button
                  type="button"
                  className={`has-cinema-player-server-pill ${selectedMirror === "multiembed" ? "active" : ""}`}
                  onClick={() => handleSelectMirror("multiembed")}
                  title="Сервер 5: MultiStream"
                  data-tv-focusable="true"
                >
                  🚀 Сервер 5
                </button>
              </div>

              {/* Quick mirror switcher */}
              <button
                type="button"
                className="has-cinema-player-hud-btn"
                onClick={handleCycleMirror}
                title="Переключить на следующий сервер (если текущий заблокирован или не загружается)"
                data-tv-focusable="true"
              >
                🔄 Сменить источник
              </button>

              {/* AdBlock Guard toggle */}
              <button
                type="button"
                className={`has-cinema-player-hud-btn adblock-pill ${isAdBlockEnabled ? "active" : ""}`}
                onClick={() => {
                  setIsAdBlockEnabled((prev) => !prev);
                  showTvToast(
                    !isAdBlockEnabled
                      ? "🛡️ Блокировка рекламы и казино ВКЛ"
                      : "⚠️ Блокировка рекламы ВЫКЛ",
                    "🛡️",
                    1800
                  );
                  resetHudTimer();
                }}
                title={isAdBlockEnabled ? "Блокировщик рекламы активен (всплывающие окна и казино заблокированы)" : "Включить блокировку рекламы"}
                data-tv-focusable="true"
              >
                🛡️ {isAdBlockEnabled ? "Без рекламы" : "Реклама: Вкл"}
              </button>

              {/* Single Settings button (Contains voiceover studios & mirrors) */}
              <button
                type="button"
                className={`has-cinema-player-hud-btn ${showPlayerSettings ? "active" : ""}`}
                onClick={() => {
                  setShowPlayerSettings((prev) => !prev);
                  setShowPlayerEpisodes(false);
                  resetHudTimer();
                }}
                title="Озвучка, качество и серверы"
                data-tv-focusable="true"
              >
                ⚙️ Озвучка / Сервер
              </button>

              {/* Fullscreen toggle */}
              <button
                type="button"
                className="has-cinema-player-hud-btn icon-only"
                onClick={handleToggleFullscreen}
                title={isFullscreen ? "Выйти из полноэкранного режима" : "Развернуть во весь экран"}
                data-tv-focusable="true"
              >
                {isFullscreen ? "🗗" : "⛶"}
              </button>

              {/* Close */}
              <button
                type="button"
                className="has-cinema-player-hud-btn icon-only close"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClosePlayer();
                }}
                onTouchEnd={(e) => {
                  e.stopPropagation();
                  handleClosePlayer();
                }}
                title="Закрыть плеер"
                data-tv-focusable="true"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Quick Fallback Switcher (Always accessible if video fails to load) */}
          <div className={`has-cinema-player-bottom-failover ${!isHudVisible ? "hud-hidden" : ""}`}>
            <span className="failover-hint">Не работает плеер?</span>
            <button
              type="button"
              className="failover-btn"
              onClick={handleCycleMirror}
              data-tv-focusable="true"
              title="Переключить на следующий доступный сервер"
            >
              🔄 Сменить сервер
            </button>
          </div>

          {/* Clean 100% Video Canvas */}
          <div className="has-cinema-video-frame">
            {isMirrorConnecting && (
              <div className="has-cinema-mirror-connecting-banner">
                <div className="has-cinema-loading-spinner small" />
                <span>Защита от сбоев: подключение к серверу...</span>
              </div>
            )}

            {(playingMedia || selectedMedia).is_unreleased ? (
              <div className="has-cinema-unreleased-player-view">
                <div className="has-cinema-unreleased-card">
                  <span className="unreleased-icon">⏳</span>
                  <h3>Фильм ещё не вышел в цифровой прокат</h3>
                  <p>
                    «{(playingMedia || selectedMedia).title}» ещё находится в производстве или кинотеатральном прокате (релиз: {(playingMedia || selectedMedia).release_date_full || (playingMedia || selectedMedia).release_year || "2026"}).
                  </p>
                  {(playingMedia || selectedMedia).trailer_youtube_key ? (
                    <div className="unreleased-trailer-box">
                      <iframe
                        src={`https://www.youtube-nocookie.com/embed/${(playingMedia || selectedMedia).trailer_youtube_key}?autoplay=1&rel=0`}
                        title="Официальный трейлер"
                        className="unreleased-trailer-frame"
                        allow="autoplay; fullscreen"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <p style={{ color: "#64748b", fontSize: "13px" }}>
                      Цифровой плеер подключится автоматически, как только фильм выйдет в мировой релиз.
                    </p>
                  )}
                  <button
                    type="button"
                    className="has-cinema-btn-play"
                    onClick={handleClosePlayer}
                    style={{ marginTop: 12 }}
                    data-tv-focusable="true"
                  >
                    ← Вернуться в каталог
                  </button>
                </div>
              </div>
            ) : allMirrorsFailed ? (
              <div className="has-cinema-unreleased-player-view">
                <div className="has-cinema-unreleased-card">
                  <span className="unreleased-icon">🛡️</span>
                  <h3>Все доступные серверы были проверены</h3>
                  <p>
                    Видеопоток временно не ответил ни на одном из зеркал (возможно блокировка провайдера). Вы можете запустить повторную проверку или вернуться в каталог.
                  </p>
                  <div style={{ display: "flex", gap: "12px", justifyContent: "center", marginTop: "14px" }}>
                    <button
                      type="button"
                      className="has-cinema-btn-play"
                      onClick={() => {
                        triedMirrorsRef.current.clear();
                        setAllMirrorsFailed(false);
                        handleSelectMirror("vidlink_pro");
                      }}
                      data-tv-focusable="true"
                    >
                      🔄 Попробовать заново
                    </button>
                    <button
                      type="button"
                      className="failover-btn"
                      onClick={handleClosePlayer}
                      data-tv-focusable="true"
                    >
                      ← Закрыть плеер
                    </button>
                  </div>
                </div>
              </div>
            ) : selectedMirror === "anilibria" ? (
              anilibriaStreamUrl ? (
                <video
                  ref={videoRef}
                  controls
                  autoPlay
                  playsInline
                  onTimeUpdate={handleVideoTimeUpdate}
                  className="has-cinema-video-elem"
                />
              ) : (
                <div className="has-cinema-player-loading">
                  <div className="has-cinema-loading-spinner" />
                  <span>{isLoadingAniLibria ? "Подключение к Full HD дубляжу AniLibria..." : "Загрузка видеопотока..."}</span>
                </div>
              )
            ) : playerMode === "balancer" ? (
              <iframe
                key={`${selectedMirror}-${balancerEmbedUrl}-${isAdBlockEnabled}`}
                src={balancerEmbedUrl}
                title={(playingMedia || selectedMedia).title}
                className="has-cinema-iframe-elem"
                sandbox={
                  isAdBlockEnabled
                    ? "allow-scripts allow-same-origin allow-forms allow-presentation"
                    : undefined
                }
                allow="autoplay *; fullscreen *; encrypted-media *; picture-in-picture *; clipboard-write *"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
                onLoad={handleIframeLoaded}
                onError={() => handleAutoSwitchNextMirror("Сервер вернул ошибку")}
                {...{ webkitallowfullscreen: "true", mozallowfullscreen: "true" }}
              />
            ) : (
              <video
                ref={videoRef}
                src={
                  playingEpisode.stream_url ||
                  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
                }
                controls
                autoPlay
                onTimeUpdate={handleVideoTimeUpdate}
                className="has-cinema-video-elem"
              />
            )}
          </div>

          {/* ========================================================
              CLEAN DRAWER: SETTINGS & AUDIO DUBBINGS
              ======================================================== */}
          {showPlayerSettings && (
            <div
              className="has-cinema-player-drawer-backdrop"
              onClick={() => setShowPlayerSettings(false)}
            >
              <div
                className="has-cinema-player-settings-sheet"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="has-cinema-drawer-header">
                  <div className="has-cinema-drawer-title">
                    <span>⚙️ Настройки воспроизведения</span>
                    <span className="has-cinema-drawer-subtitle">
                      {(playingMedia || selectedMedia).title}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="has-cinema-drawer-close-btn"
                    onClick={() => setShowPlayerSettings(false)}
                    data-tv-focusable="true"
                  >
                    ✕
                  </button>
                </div>

                <div className="has-cinema-drawer-body">
                  {/* Voiceover / Audio Track Section */}
                  <div className="has-cinema-drawer-section">
                    <h4 className="has-cinema-drawer-section-title">
                      🎙️ Русская озвучка и студии перевода
                    </h4>

                    {russianDubNotice && (
                      <div className="has-cinema-drawer-notice-box">
                        <span>{russianDubNotice}</span>
                      </div>
                    )}

                    {isSearchingKodik && (
                      <div className="has-cinema-drawer-searching">
                        <span>🔍 Поиск вариантов озвучки и студий...</span>
                      </div>
                    )}
                    <div className="has-cinema-drawer-options-grid">
                      <button
                        type="button"
                        className={`has-cinema-drawer-option-btn ${
                          selectedMirror === "vidlink_pro" ? "active" : ""
                        }`}
                        onClick={() => {
                          handleSelectMirror("vidlink_pro");
                          showTvToast("Включен Сервер 1: Full HD (1080p)", "⚡", 1500);
                        }}
                        data-tv-focusable="true"
                      >
                        <span className="option-name">⚡ Сервер 1: VidLink Pro (1080p)</span>
                        <span className="option-desc">Высокая скорость, Full HD качество, стабильный поток</span>
                      </button>

                      <button
                        type="button"
                        className={`has-cinema-drawer-option-btn ${
                          selectedMirror === "kodik_ru" ? "active" : ""
                        }`}
                        onClick={() => {
                          handleSelectMirror("kodik_ru");
                          showTvToast("Включен Сервер 2: Kodik (Дубляж)", "🎙️", 1500);
                        }}
                        data-tv-focusable="true"
                      >
                        <span className="option-name">🎙️ Сервер 2: Kodik (Студии дубляжа)</span>
                        <span className="option-desc">Профессиональный русский дубляж (LostFilm, Red Head Sound, HDRezka)</span>
                      </button>

                      {currentAllohaUrl && (
                        <button
                          type="button"
                          className={`has-cinema-drawer-option-btn ${
                            selectedMirror === "alloha_ru" ? "active" : ""
                          }`}
                          onClick={() => {
                            handleSelectMirror("alloha_ru");
                            showTvToast("Включен Сервер 3: Alloha", "🔊", 1500);
                          }}
                          data-tv-focusable="true"
                        >
                          <span className="option-name">🔊 Сервер 3: Alloha Player</span>
                          <span className="option-desc">Российский балансер кинолент</span>
                        </button>
                      )}

                      {/* Anime-specific AniLibria HLS stream */}
                      {((playingMedia || selectedMedia).genre.toLowerCase().includes("аниме") ||
                        (playingMedia || selectedMedia).title.toLowerCase().includes("клинок")) && (
                        <button
                          type="button"
                          className={`has-cinema-drawer-option-btn ${
                            selectedMirror === "anilibria" ? "active" : ""
                          }`}
                          onClick={() => {
                            handleSelectMirror("anilibria");
                            showTvToast("Включен HLS поток AniLibria", "🌸", 1500);
                          }}
                          data-tv-focusable="true"
                        >
                          <span className="option-name">🌸 AniLibria (Прямой HLS)</span>
                          <span className="option-desc">Официальный дубляж AniLibria / Studio Band</span>
                        </button>
                      )}
                    </div>

                    {/* Kodik studio voiceovers list if available */}
                    {kodikResults.length > 0 && (
                      <div className="has-cinema-drawer-subgroup">
                        <span className="has-cinema-drawer-sublabel">Доступные варианты озвучки (Kodik):</span>
                        <div className="has-cinema-drawer-chips-wrap">
                          {kodikResults.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              className={`has-cinema-drawer-chip ${
                                selectedMirror === "kodik_ru" && selectedKodikLink === item.link ? "active" : ""
                              }`}
                              onClick={() => {
                                setSelectedKodikLink(item.link);
                                setSelectedMirror("kodik_ru");
                                showTvToast(`Озвучка: ${item.translation.title}`, "🎙️", 1500);
                              }}
                              data-tv-focusable="true"
                            >
                              {item.translation.title || "Озвучка"}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Fallback Mirrors / International Servers */}
                  <div className="has-cinema-drawer-section">
                    <h4 className="has-cinema-drawer-section-title">
                      ⚡ Запасные международные серверы
                    </h4>
                    <div className="has-cinema-drawer-chips-wrap">
                      <button
                        type="button"
                        className={`has-cinema-drawer-chip ${selectedMirror === "vidlink_pro" ? "active" : ""}`}
                        onClick={() => {
                          handleSelectMirror("vidlink_pro");
                          showTvToast("Сервер: VidLink Pro", "⚡", 1500);
                        }}
                        data-tv-focusable="true"
                      >
                        ⚡ VidLink Pro
                      </button>
                      <button
                        type="button"
                        className={`has-cinema-drawer-chip ${selectedMirror === "vidsrc_to" ? "active" : ""}`}
                        onClick={() => {
                          handleSelectMirror("vidsrc_to");
                          showTvToast("Сервер: VidSrc Pro", "🎬", 1500);
                        }}
                        data-tv-focusable="true"
                      >
                        🎬 VidSrc Pro (1080p)
                      </button>
                      <button
                        type="button"
                        className={`has-cinema-drawer-chip ${selectedMirror === "autoembed" ? "active" : ""}`}
                        onClick={() => {
                          handleSelectMirror("autoembed");
                          showTvToast("Сервер: AutoEmbed", "🌐", 1500);
                        }}
                        data-tv-focusable="true"
                      >
                        🌐 AutoEmbed
                      </button>
                    </div>
                  </div>

                  {/* AdBlock Guard Section */}
                  <div className="has-cinema-drawer-section">
                    <h4 className="has-cinema-drawer-section-title">
                      🛡️ Блокировка рекламы и всплывающих окон
                    </h4>
                    <button
                      type="button"
                      className={`has-cinema-drawer-option-btn ${isAdBlockEnabled ? "active" : ""}`}
                      onClick={() => {
                        setIsAdBlockEnabled((prev) => !prev);
                        showTvToast(!isAdBlockEnabled ? "🛡️ Защита от рекламы ВКЛ" : "⚠️ Защита от рекламы ВЫКЛ", "🛡️", 2000);
                      }}
                      data-tv-focusable="true"
                    >
                      <span className="option-name">
                        {isAdBlockEnabled ? "🛡️ Блокировщик рекламы: ВКЛЮЧЕН" : "⚠️ Блокировщик рекламы: ВЫКЛЮЧЕН"}
                      </span>
                      <span className="option-desc">
                        {isAdBlockEnabled
                          ? "Защита активна: блокируются всплывающие окна, казино 1xBet, редиректы и баннеры"
                          : "Защита отключена: разрешены все всплывающие окна балансера"}
                      </span>
                    </button>
                  </div>

                  {/* External Tools */}
                  <div className="has-cinema-drawer-section actions">
                    <button
                      type="button"
                      className="has-cinema-drawer-btn-secondary"
                      onClick={() => {
                        if (isTauri) {
                          openUrl(balancerEmbedUrl).catch(() => window.open(balancerEmbedUrl, "_blank"));
                        } else {
                          window.open(balancerEmbedUrl, "_blank");
                        }
                      }}
                      data-tv-focusable="true"
                    >
                      ↗ Открыть видео в браузере
                    </button>

                    <button
                      type="button"
                      className="has-cinema-drawer-btn-primary"
                      onClick={() => setShowPlayerSettings(false)}
                      data-tv-focusable="true"
                    >
                      ✓ Готово
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              CLEAN DRAWER: EPISODES SELECTION (SERIES ONLY)
              ======================================================== */}
          {showPlayerEpisodes && (playingMedia || selectedMedia).media_type !== "movie" && (
            <div
              className="has-cinema-player-drawer-backdrop"
              onClick={() => setShowPlayerEpisodes(false)}
            >
              <div
                className="has-cinema-player-episodes-sheet"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="has-cinema-drawer-header">
                  <div className="has-cinema-drawer-title">
                    <span>Выбор серии (Сезон {playingSeasonNumber})</span>
                    <span className="has-cinema-drawer-subtitle">
                      {(playingMedia || selectedMedia).title}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="has-cinema-drawer-close-btn"
                    onClick={() => setShowPlayerEpisodes(false)}
                    data-tv-focusable="true"
                  >
                    ✕
                  </button>
                </div>

                <div className="has-cinema-drawer-episodes-grid">
                  {((playingMedia || selectedMedia).seasons.find(
                    (s) => s.season_number === playingSeasonNumber
                  )?.episodes || []).map((ep) => (
                    <button
                      key={ep.id}
                      type="button"
                      className={`has-cinema-drawer-ep-btn ${
                        playingEpisode?.number === ep.number ? "active" : ""
                      }`}
                      onClick={() => {
                        startPlayback(playingMedia || selectedMedia, playingSeasonNumber, ep);
                        setShowPlayerEpisodes(false);
                      }}
                      data-tv-focusable="true"
                    >
                      <span className="ep-num">Серия {ep.number}</span>
                      <span className="ep-title">{ep.title}</span>
                      {ep.duration_minutes && (
                        <span className="ep-time">{ep.duration_minutes} мин</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* High-visibility TV On-Screen Toast */}
      {tvToast && (
        <div className="has-cinema-tv-toast">
          <span className="has-cinema-tv-toast-icon">{tvToast.icon || "📺"}</span>
          <span className="has-cinema-tv-toast-text">{tvToast.text}</span>
        </div>
      )}
    </div>
  );
}
