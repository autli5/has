import { useState, useEffect, useRef, useCallback } from "react";
import Hls from "hls.js";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openUrl } from "@tauri-apps/plugin-opener";
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
    synopsis:
      "Герцог Пол Атрейдес объединяется с фременами, чтобы отомстить заговорщикам, уничтожившим его семью. Эпическое продолжение борьбы за Арракис.",
    is_original: false,
    seasons: [
      {
        season_number: 1,
        episodes: [
          {
            id: "dune-2-full",
            number: 1,
            title: "Полный фильм",
            thumbnail: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=600&auto=format&fit=crop",
            duration_minutes: 166,
          },
        ],
      },
    ],
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
    synopsis:
      "Когда засуха приводит человечество к глобальному продовольственному кризису, группа ученых отправляется сквозь червоточину в поисках нового дома для людей.",
    is_original: false,
    seasons: [
      {
        season_number: 1,
        episodes: [
          {
            id: "interstellar-full",
            number: 1,
            title: "Полный фильм",
            thumbnail: "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?q=80&w=600&auto=format&fit=crop",
            duration_minutes: 169,
          },
        ],
      },
    ],
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
    synopsis:
      "История двух сестер, Джинкс и Вай, оказавшихся по разные стороны баррикад в войне между технологическим Пилтовером и преступным Зауном.",
    is_original: false,
    seasons: [
      {
        season_number: 1,
        episodes: [
          {
            id: "arcane-1-1",
            number: 1,
            title: "Добро пожаловать в игру",
            thumbnail: "https://images.unsplash.com/photo-1563089145-599997674d42?q=80&w=600&auto=format&fit=crop",
            duration_minutes: 43,
          },
        ],
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
        episodes: [
          {
            id: "bb-1-1",
            number: 1,
            title: "Пилот",
            thumbnail: "https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=600&auto=format&fit=crop",
            duration_minutes: 58,
          },
        ],
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
    seasons: [
      {
        season_number: 1,
        episodes: [
          {
            id: "oppenheimer-full",
            number: 1,
            title: "Полный фильм",
            thumbnail: "https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=600&auto=format&fit=crop",
            duration_minutes: 180,
          },
        ],
      },
    ],
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
  genre_ids?: number[];
  number_of_seasons?: number;
}

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
  | "smotrim_ru"
  | "embess_ru"
  | "alloha_ru"
  | "kodik_ru"
  | "anilibria"
  | "vidlink_pro"
  | "vidsrc_to"
  | "autoembed";

const BALANCER_MIRRORS: { id: BalancerMirror; label: string; note: string }[] = [
  {
    id: "smotrim_ru",
    label: "🇷🇺 Зеркало 1 (Smotrim • Полный дубляж)",
    note: "100% русская аудиодорожка (профессиональный дубляж / многоголосый перевод) без рекламы",
  },
  {
    id: "embess_ru",
    label: "🎙️ Зеркало 2 (Embess • Русская озвучка Full HD)",
    note: "Плеер высокой четкости с русской озвучкой и выбором качества 1080p",
  },
  {
    id: "alloha_ru",
    label: "🔊 Зеркало 3 (Alloha • Студийные переводы)",
    note: "Русская озвучка студий: Red Head Sound, Flarrow Films, LostFilm, HDRezka",
  },
  {
    id: "kodik_ru",
    label: "🌸 Зеркало 4 (Kodik • Студии аниме)",
    note: "Русские студийные озвучки аниме: Studio Band, AniLibria, AniDUB, SHIZA Project",
  },
  {
    id: "vidlink_pro",
    label: "⚡ Зеркало 5 (VidLink Pro • Мульти-аудио)",
    note: "Международный скоростной плеер с выбором аудио и субтитрами",
  },
  {
    id: "vidsrc_to",
    label: "🎬 Зеркало 6 (VidSrc Pro • 1080p)",
    note: "Резервный зарубежный Full HD поток",
  },
];

// Reliable image URL helper with proxy caching (bypasses Russian ISP / Cloudflare blocks on image.tmdb.org)
const formatMediaImg = (path: string | undefined, size: "w500" | "original" = "w500"): string => {
  if (!path) return size === "original" ? INITIAL_LIBRARY[0].backdrop_url : INITIAL_LIBRARY[0].poster_url;
  if (path.startsWith("http")) return path;
  return `https://wsrv.nl/?url=https://image.tmdb.org/t/p/${size}${path}`;
};

export default function Cinema({ currentUser }: CinemaProps) {
  const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

  // Local Cinema State (Bookmarks & Progress saved on user's machine)
  const [cinemaState, setCinemaState] = useState<CinemaState>({
    bookmarks: [],
    history: [],
  });
  const [, setConfig] = useState<CinemaConfig>({ tmdb_api_key: null });

  // Navigation Filter
  const [activeTab, setActiveTab] = useState<"home" | "movies" | "series" | "anime" | "bookmarks">("home");
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
  const [playerMode, setPlayerMode] = useState<"balancer" | "direct">("balancer");
  const [selectedMirror, setSelectedMirror] = useState<BalancerMirror>("smotrim_ru");
  const [currentKpId, setCurrentKpId] = useState<number | null>(null);
  const [currentImdbId, setCurrentImdbId] = useState<string | null>(null);
  const [currentAllohaUrl, setCurrentAllohaUrl] = useState<string | null>(null);
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

  // Universal helper to convert a TMDB item into CinemaMediaItem
  const mapTmdbItem = (item: RawTmdbItem, forcedType?: "movie" | "tv"): CinemaMediaItem => {
    const isTv = forcedType ? forcedType === "tv" : item.media_type === "tv" || !!item.first_air_date;
    const title = item.title || item.name || item.original_title || item.original_name || "Без названия";
    const backdrop = formatMediaImg(item.backdrop_path || item.poster_path, "original");
    const poster = formatMediaImg(item.poster_path || item.backdrop_path, "w500");
    const year = (item.release_date || item.first_air_date || "").slice(0, 4) || "2024";
    const seasonsCount = isTv ? (item.number_of_seasons || 3) : 1;

    const seasonsList: CinemaSeason[] = [];
    for (let s = 1; s <= seasonsCount; s++) {
      const episodes: CinemaEpisode[] = [];
      const count = isTv ? 8 : 1;
      for (let e = 1; e <= count; e++) {
        episodes.push({
          id: `tmdb-${item.id}-s${s}-e${e}`,
          number: e,
          title: isTv ? `Серия ${e}` : title,
          thumbnail: poster,
          duration_minutes: isTv ? 45 : 120,
        });
      }
      seasonsList.push({
        season_number: s,
        episodes,
      });
    }

    return {
      id: `tmdb-${isTv ? "tv" : "movie"}-${item.id}`,
      tmdb_id: item.id,
      media_type: isTv ? "tv" : "movie",
      title,
      original_title: item.original_name || item.original_title,
      backdrop_url: backdrop,
      poster_url: poster,
      release_year: year,
      seasons_count: isTv ? seasonsCount : undefined,
      duration_minutes: isTv ? undefined : 120,
      genre: isTv ? "Сериал" : "Фильм",
      rating: item.vote_average ? Math.round(item.vote_average * 10) / 10 : 8.0,
      synopsis: item.overview?.trim() || "Описание фильма/сериала из международной базы TMDB.",
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

  // Load All Catalogs (Movies, Series, Anime, Trending) on Mount
  const loadFullCatalog = useCallback(async () => {
    try {
      // 1. Trending All (Top 40 - page 1 & 2)
      const [tData1, tData2] = await Promise.all([
        queryTmdb("/trending/all/week?language=ru-RU&page=1"),
        queryTmdb("/trending/all/week?language=ru-RU&page=2"),
      ]);
      const allTrendingRaw = [...(tData1?.results || []), ...(tData2?.results || [])];
      if (allTrendingRaw.length > 0) {
        const mapped = allTrendingRaw
          .filter((i: RawTmdbItem) => i.title || i.name)
          .map((i: RawTmdbItem) => mapTmdbItem(i));
        setTrendingAll(mapped);
        if (mapped.length > 0) {
          setSelectedMedia(mapped[0]);
        }
      }

      // 2. Popular Movies (40 items - page 1 & 2)
      const [mData1, mData2] = await Promise.all([
        queryTmdb("/movie/popular?language=ru-RU&page=1"),
        queryTmdb("/movie/popular?language=ru-RU&page=2"),
      ]);
      const allMoviesRaw = [...(mData1?.results || []), ...(mData2?.results || [])];
      if (allMoviesRaw.length > 0) {
        setPopularMovies(allMoviesRaw.map((i: RawTmdbItem) => mapTmdbItem(i, "movie")));
      }

      // 3. Popular TV Shows (40 items - page 1 & 2)
      const [tvData1, tvData2] = await Promise.all([
        queryTmdb("/tv/popular?language=ru-RU&page=1"),
        queryTmdb("/tv/popular?language=ru-RU&page=2"),
      ]);
      const allTvRaw = [...(tvData1?.results || []), ...(tvData2?.results || [])];
      if (allTvRaw.length > 0) {
        setPopularSeries(allTvRaw.map((i: RawTmdbItem) => mapTmdbItem(i, "tv")));
      }

      // 4. Genuine Anime (Japanese Animation, 40 items - page 1 & 2)
      const [aData1, aData2] = await Promise.all([
        queryTmdb("/discover/tv?with_genres=16&with_original_language=ja&sort_by=popularity.desc&language=ru-RU&page=1"),
        queryTmdb("/discover/tv?with_genres=16&with_original_language=ja&sort_by=popularity.desc&language=ru-RU&page=2"),
      ]);
      const allAnimeRaw = [...(aData1?.results || []), ...(aData2?.results || [])];
      if (allAnimeRaw.length > 0) {
        setPopularAnime(allAnimeRaw.map((i: RawTmdbItem) => mapTmdbItem(i, "tv")));
      }
    } catch (err) {
      console.warn("Failed to load catalog from TMDB:", err);
    }
  }, [queryTmdb]);

  // Load config, state, and full catalog on mount
  useEffect(() => {
    if (!isTauri) return;

    invoke<CinemaConfig>("get_cinema_config")
      .then((cfg) => {
        setConfig(cfg);
        loadFullCatalog();
      })
      .catch((err) => console.warn("Failed to get cinema config:", err));

    invoke<CinemaState>("get_cinema_state")
      .then((state) => {
        if (state) setCinemaState(state);
      })
      .catch((err) => console.warn("Failed to get local cinema state:", err));
  }, [isTauri, loadFullCatalog]);

  // Search TMDB live across all movies, series, and anime
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
        if (data?.results && data.results.length > 0) {
          const filtered = data.results
            .filter((r: RawTmdbItem) => (r.media_type === "movie" || r.media_type === "tv") && (r.title || r.name))
            .sort((a: any, b: any) => (b.vote_count || b.popularity || 0) - (a.vote_count || a.popularity || 0))
            .map((r: RawTmdbItem) => mapTmdbItem(r));
          setSearchResults(filtered);
        } else {
          // Fallback search with en-US query if Russian gave 0 results
          const dataEn = await queryTmdb(
            `/search/multi?query=${encodeURIComponent(query)}&language=en-US&page=1`
          );
          if (dataEn?.results) {
            const filtered = dataEn.results
              .filter((r: RawTmdbItem) => (r.media_type === "movie" || r.media_type === "tv") && (r.title || r.name))
              .sort((a: any, b: any) => (b.vote_count || b.popularity || 0) - (a.vote_count || a.popularity || 0))
              .map((r: RawTmdbItem) => mapTmdbItem(r));
            setSearchResults(filtered);
          } else {
            setSearchResults([]);
          }
        }
      } catch (err) {
        console.warn("Search error:", err);
      } finally {
        setIsSearching(false);
      }
    },
    [queryTmdb]
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
    const data = await queryTmdb(`/tv/${tmdbId}/season/${seasonNumber}?language=ru-RU`);
    if (data?.episodes && data.episodes.length > 0) {
      const loadedEpisodes: CinemaEpisode[] = data.episodes.map((ep: any) => ({
        id: `tmdb-${tmdbId}-s${seasonNumber}-e${ep.episode_number}`,
        number: ep.episode_number,
        title: ep.name || `Серия ${ep.episode_number}`,
        thumbnail: ep.still_path
          ? formatMediaImg(ep.still_path, "w500")
          : selectedMedia.poster_url,
        duration_minutes: ep.runtime || 45,
        description: ep.overview || undefined,
      }));

      setSelectedMedia((prev) => ({
        ...prev,
        seasons: prev.seasons.map((s) =>
          s.season_number === seasonNumber ? { ...s, episodes: loadedEpisodes } : s
        ),
      }));
    }
  };


  const isBookmarked = cinemaState.bookmarks.includes(selectedMedia.id);

  // Toggle Bookmark (Saved locally on user's computer in cinema_state.json)
  const handleToggleBookmark = async () => {
    if (isTauri) {
      try {
        const nextState = await invoke<CinemaState>("toggle_cinema_bookmark", {
          titleId: selectedMedia.id,
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

  // Start playback for a media item (movie or specific series episode)
  const startPlayback = (media: CinemaMediaItem, seasonNum: number = 1, episode?: CinemaEpisode) => {
    setSelectedMedia(media);
    setPlayingMedia(media);
    setPlayingSeasonNumber(seasonNum);
    setRussianDubNotice(null);
    setAnilibriaStreamUrl(null);

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

    // Default to genuine Russian spoken voiceover:
    // For anime: Kodik with Russian studios (Studio Band, AniLibria, AniDUB)
    // For movies & series: Smotrim / Embess with 100% Russian audio dubbing
    if (isAnime) {
      setSelectedMirror("kodik_ru");
      setRussianDubNotice("🌸 Подключены студии русской озвучки аниме (Studio Band, AniLibria, AniDUB).");
    } else {
      setSelectedMirror("smotrim_ru");
      setRussianDubNotice("🇷🇺 Включена русская озвучка (полный профессиональный дубляж). Вы можете слушать и смотреть на русском языке!");
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
            if (info.iframe_url) setCurrentAllohaUrl(info.iframe_url);
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
            if (d?.iframe) setCurrentAllohaUrl(d.iframe);
          }
        })
        .catch(() => {});
    }

    // Search Kodik in background for anime or studio translations
    searchKodikDubbings(media.original_title || media.title, isAnime);
  };

  // 1-Click Card Action: ANY movie, series, or anime starts playing immediately!
  const handleMediaCardClick = (item: CinemaMediaItem) => {
    setSelectedMedia(item);
    if (item.media_type === "movie") {
      startPlayback(item, 1, item.seasons[0]?.episodes[0]);
    } else {
      setSelectedSeason(1);
      if (item.tmdb_id) {
        loadTvSeasonsDetails(item.tmdb_id, 1);
      }
      startPlayback(item, 1, item.seasons[0]?.episodes[0]);
    }
  };

  // Play a specific episode
  const handlePlayEpisode = (seasonNum: number, episode: CinemaEpisode) => {
    startPlayback(selectedMedia, seasonNum, episode);
  };

  // Play button on Hero Banner
  const handleHeroPlay = () => {
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

  // Save playback progress on time update
  const handleVideoTimeUpdate = () => {
    if (!videoRef.current || !playingEpisode) return;
    const currentTime = videoRef.current.currentTime;
    const duration = videoRef.current.duration;
    const activeMedia = playingMedia || selectedMedia;

    if (duration > 0 && isTauri) {
      const payload: CinemaPlayback = {
        title_id: activeMedia.id,
        title_name: activeMedia.title,
        poster_path: activeMedia.poster_url,
        backdrop_path: activeMedia.backdrop_url,
        season: playingSeasonNumber,
        episode: playingEpisode.number,
        progress_seconds: currentTime,
        duration_seconds: duration,
        last_watched: new Date().toISOString(),
      };

      if (Math.floor(currentTime) % 5 === 0) {
        invoke<CinemaState>("update_cinema_progress", { item: payload })
          .then((st) => setCinemaState(st))
          .catch(() => {});
      }
    }
  };

  // Close player and save exact position
  const handleClosePlayer = () => {
    const activeMedia = playingMedia || selectedMedia;
    if (isTauri && isFullscreen) {
      getCurrentWindow().setFullscreen(false).catch(() => {});
      setIsFullscreen(false);
    }
    if (videoRef.current && playingEpisode && isTauri) {
      const currentTime = videoRef.current.currentTime;
      const duration = videoRef.current.duration;
      if (duration > 0) {
        const payload: CinemaPlayback = {
          title_id: activeMedia.id,
          title_name: activeMedia.title,
          poster_path: activeMedia.poster_url,
          backdrop_path: activeMedia.backdrop_url,
          season: playingSeasonNumber,
          episode: playingEpisode.number,
          progress_seconds: currentTime,
          duration_seconds: duration,
          last_watched: new Date().toISOString(),
        };
        invoke<CinemaState>("update_cinema_progress", { item: payload })
          .then((st) => setCinemaState(st))
          .catch(() => {});
      }
    }
    if (hlsInstanceRef.current) {
      hlsInstanceRef.current.destroy();
      hlsInstanceRef.current = null;
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
  };

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
    setSelectedMirror(mirrorId);
    if (mirrorId === "anilibria") {
      const activeMedia = playingMedia || selectedMedia;
      const epNum = playingEpisode?.number || 1;
      const stream = await fetchAniLibriaEpisodeStream(activeMedia, playingSeasonNumber, epNum);
      if (stream) {
        setAnilibriaStreamUrl(stream);
        setRussianDubNotice("🌸 Подключен поток AniLibria Full HD (Studio Band).");
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

  // Activate or toggle Russian dubbing inside the in-app player (no external browser!)
  const handleActivateRussianDubbing = () => {
    const activeMedia = playingMedia || selectedMedia;
    const isAnime =
      activeMedia.genre?.toLowerCase().includes("аниме") ||
      activeMedia.genre?.toLowerCase().includes("cartoon") ||
      activeMedia.title.toLowerCase().includes("клинок") ||
      (activeMedia.original_title || "").toLowerCase().includes("kimetsu");

    if (isAnime) {
      searchKodikDubbings(activeMedia.original_title || activeMedia.title, true);
    } else {
      if (selectedMirror === "smotrim_ru") {
        setSelectedMirror("embess_ru");
        setRussianDubNotice("🎙️ Переключено на зеркало Embess (русская озвучка Full HD).");
      } else if (selectedMirror === "embess_ru") {
        setSelectedMirror("alloha_ru");
        setRussianDubNotice("🔊 Переключено на зеркало Alloha (студийные переводы).");
      } else {
        setSelectedMirror("smotrim_ru");
        setRussianDubNotice("🇷🇺 Включено зеркало Smotrim (профессиональный русский дубляж).");
      }
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
      case "smotrim_ru":
        if (kpId) {
          return `https://smotrimfilms.lovable.app/kp/${kpId}${isTv ? `?season=${sNum}&episode=${epNum}` : ""}`;
        }
        if (imdbId) {
          return `https://smotrimfilms.lovable.app/imdb/${imdbId}${isTv ? `?season=${sNum}&episode=${epNum}` : ""}`;
        }
        return `https://api.embess.ws/embed/movie/${tmdb || 693134}`;

      case "embess_ru":
        if (kpId) {
          return `https://api.embess.ws/embed/kp/${kpId}${isTv ? `?season=${sNum}&episode=${epNum}` : ""}`;
        }
        if (imdbId) {
          return `https://api.embess.ws/embed/imdb/${imdbId}${isTv ? `?season=${sNum}&episode=${epNum}` : ""}`;
        }
        return `https://api.embess.ws/embed/movie/${tmdb || 693134}`;

      case "alloha_ru":
        if (currentAllohaUrl) {
          return currentAllohaUrl;
        }
        if (kpId) {
          return `https://api.delivembd.ws/embed/kp/${kpId}${isTv ? `?season=${sNum}&episode=${epNum}` : ""}`;
        }
        return `https://smotrimfilms.lovable.app/kp/${kpId || 258687}`;

      case "kodik_ru":
        if (selectedKodikLink) {
          return selectedKodikLink.startsWith("//") ? `https:${selectedKodikLink}` : selectedKodikLink;
        }
        if (kpId) {
          return `https://smotrimfilms.lovable.app/kp/${kpId}${isTv ? `?season=${sNum}&episode=${epNum}` : ""}`;
        }
        return isTv
          ? `https://vidlink.pro/tv/${tmdb || 693134}/${sNum}/${epNum}?primaryColor=6366f1`
          : `https://vidlink.pro/movie/${tmdb || 693134}?primaryColor=6366f1`;

      case "vidlink_pro":
        return isTv
          ? `https://vidlink.pro/tv/${tmdb || 693134}/${sNum}/${epNum}?primaryColor=6366f1`
          : `https://vidlink.pro/movie/${tmdb || 693134}?primaryColor=6366f1`;

      case "vidsrc_to":
        return isTv
          ? `https://vidsrc.to/embed/tv/${tmdb || 693134}/${sNum}/${epNum}`
          : `https://vidsrc.to/embed/movie/${tmdb || 693134}`;

      case "autoembed":
        return isTv
          ? `https://player.autoembed.co/embed/tv/${tmdb || 693134}/${sNum}/${epNum}`
          : `https://player.autoembed.co/embed/movie/${tmdb || 693134}`;

      default:
        return `https://smotrimfilms.lovable.app/kp/${kpId || 258687}`;
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
    <div className="has-cinema-container" ref={topRef}>
      {/* ========================================================
          1. TOP NAVIGATION BAR (All categories & search)
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
          >
            Главная
          </button>
          <button
            type="button"
            className={`has-cinema-nav-item ${activeTab === "movies" && !searchQuery ? "active" : ""}`}
            onClick={() => {
              setActiveTab("movies");
              setSearchQuery("");
            }}
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
              />
              {isSearching && <span className="has-cinema-search-spinner" />}
              {searchQuery && (
                <button
                  type="button"
                  className="has-cinema-search-clear-btn"
                  onClick={() => setSearchQuery("")}
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
                      {item.release_year} • {item.media_type === "tv" ? "Сериал" : "Фильм"}
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
                {selectedMedia.media_type === "movie" ? "Фильм" : "Сериал"}
              </div>

              {/* Title */}
              <h1 className="has-cinema-hero-title">{selectedMedia.title}</h1>

              {/* Metadata Row */}
              <div className="has-cinema-meta-row">
                <span className="has-cinema-meta-year">{selectedMedia.release_year}</span>
                {selectedMedia.seasons_count && (
                  <span className="has-cinema-meta-seasons">{selectedMedia.seasons_count} Seasons</span>
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
                >
                  {isBookmarked ? "✓" : "+"}
                </button>

                <button
                  type="button"
                  className="has-cinema-btn-circle"
                  title="Информация о тайтле"
                  onClick={() =>
                    alert(
                      `Тайтл: ${selectedMedia.title} (${selectedMedia.release_year})\nЖанр: ${selectedMedia.genre}\nРейтинг: ${selectedMedia.rating}\nЛокальный файл: cinema_state.json`
                    )
                  }
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
                  >
                    Season {season.season_number}
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
                          Episode {ep.number}: {ep.title}
                        </div>
                        {ep.duration_minutes && (
                          <div className="has-cinema-ep-duration">{ep.duration_minutes}m</div>
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
                          {item.release_year} • {item.media_type === "tv" ? "Сериал" : "Фильм"}
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
                            {item.release_year} • {item.media_type === "tv" ? "Сериал" : "Фильм"}
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
          5. UNIVERSAL STREAMING VIDEO PLAYER MODAL
          ======================================================== */}
      {playingEpisode && (
        <div className={`has-cinema-player-modal ${isFullscreen ? "fullscreen-mode" : ""}`}>
          <div className="has-cinema-player-header">
            <div className="has-cinema-player-title-info">
              <span className="has-cinema-player-series-title">{(playingMedia || selectedMedia).title}</span>
              <span className="has-cinema-player-dot">•</span>
              <span className="has-cinema-player-ep-name">
                {(playingMedia || selectedMedia).media_type === "movie"
                  ? "Полный фильм"
                  : `Сезон ${playingSeasonNumber}, Серия ${playingEpisode.number}: ${playingEpisode.title}`}
              </span>
            </div>

            {(playingMedia || selectedMedia).media_type !== "movie" && (
              <div className="has-cinema-player-ep-nav">
                <button
                  type="button"
                  className="has-cinema-player-nav-btn"
                  disabled={playingEpisode.number <= 1}
                  onClick={handlePrevEpisode}
                  title="Предыдущая серия"
                >
                  ◀ Пред.
                </button>
                <button
                  type="button"
                  className="has-cinema-player-nav-btn"
                  onClick={handleNextEpisode}
                  title="Следующая серия"
                >
                  След. ▶
                </button>
              </div>
            )}

            <div className="has-cinema-player-mode-toggle">
              <button
                type="button"
                className={`has-cinema-mode-btn ${playerMode === "balancer" ? "active" : ""}`}
                onClick={() => setPlayerMode("balancer")}
                title="Онлайн плеер с возможностью выбора проверенных зеркал"
              >
                Онлайн Плеер
              </button>
              <button
                type="button"
                className={`has-cinema-mode-btn ${playerMode === "direct" ? "active" : ""}`}
                onClick={() => setPlayerMode("direct")}
              >
                Прямой поток
              </button>
              <button
                type="button"
                className={`has-cinema-russian-dub-btn ${
                  selectedMirror === "smotrim_ru" ||
                  selectedMirror === "embess_ru" ||
                  selectedMirror === "alloha_ru" ||
                  selectedMirror === "kodik_ru" ||
                  selectedMirror === "anilibria"
                    ? "active"
                    : ""
                }`}
                onClick={handleActivateRussianDubbing}
                title="Русская озвучка активна. Нажмите для переключения серверов и студий озвучки."
              >
                {isLoadingAniLibria || isSearchingKodik
                  ? "⏳ Подключение..."
                  : selectedMirror === "smotrim_ru" ||
                    selectedMirror === "embess_ru" ||
                    selectedMirror === "alloha_ru" ||
                    selectedMirror === "kodik_ru" ||
                    selectedMirror === "anilibria"
                  ? "🇷🇺 Русская озвучка: ВКЛ ✓"
                  : "🇷🇺 Включить русскую озвучку"}
              </button>
              <button
                type="button"
                className="has-cinema-player-fs-btn"
                onClick={handleToggleFullscreen}
                title={isFullscreen ? "Выйти из полноэкранного режима" : "Развернуть во весь экран"}
              >
                {isFullscreen ? "🗗 В окно" : "⛶ Во весь экран"}
              </button>
              <button
                type="button"
                className="has-cinema-player-nav-btn"
                onClick={() => {
                  if (isTauri) {
                    openUrl(balancerEmbedUrl).catch(() => window.open(balancerEmbedUrl, "_blank"));
                  } else {
                    window.open(balancerEmbedUrl, "_blank");
                  }
                }}
                title="Открыть видео во внешнем браузере"
              >
                ↗ В браузере
              </button>
            </div>

            <button
              type="button"
              className="has-cinema-player-close-btn"
              onClick={handleClosePlayer}
              title="Закрыть плеер"
            >
              ✕
            </button>
          </div>

          {/* Mirror Selector Bar for bypassing blocks in Russia */}
          {playerMode === "balancer" && (
            <div className="has-cinema-player-mirrors-bar">
              <span className="has-cinema-mirrors-label">Обход блокировок (Зеркала):</span>
              {BALANCER_MIRRORS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`has-cinema-mirror-btn ${selectedMirror === m.id ? "active" : ""}`}
                  onClick={() => handleSelectMirror(m.id)}
                  title={m.note}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}

          {/* Kodik Russian Dubbings Selection Bar */}
          {playerMode === "balancer" && kodikResults.length > 0 && (
            <div className="has-cinema-translations-bar">
              <span className="has-cinema-trans-label">🎙️ Выберите студию озвучки:</span>
              <div className="has-cinema-trans-list">
                {kodikResults.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`has-cinema-trans-btn ${selectedMirror === "kodik_ru" && selectedKodikLink === item.link ? "active" : ""}`}
                    onClick={() => {
                      setSelectedKodikLink(item.link);
                      setSelectedMirror("kodik_ru");
                    }}
                    title={item.title}
                  >
                    {item.translation.title || "Озвучка"}
                  </button>
                ))}
              </div>
            </div>
          )}

          {russianDubNotice && (
            <div className="has-cinema-dub-notice">
              {russianDubNotice}
            </div>
          )}

          <div className="has-cinema-video-frame">
            {selectedMirror === "anilibria" ? (
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
                key={`${selectedMirror}-${balancerEmbedUrl}`}
                src={balancerEmbedUrl}
                title={(playingMedia || selectedMedia).title}
                className="has-cinema-iframe-elem"
                allow="autoplay *; fullscreen *; encrypted-media *; picture-in-picture *; clipboard-write *"
                allowFullScreen
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

          {(playingMedia || selectedMedia).media_type !== "movie" && (
            <div className="has-cinema-player-episodes-strip">
              <span className="has-cinema-player-episodes-label">
                Серии (Сезон {playingSeasonNumber}):
              </span>
              <div className="has-cinema-player-episodes-list">
                {((playingMedia || selectedMedia).seasons.find(
                  (s) => s.season_number === playingSeasonNumber
                )?.episodes || []).map((ep) => (
                  <button
                    key={ep.id}
                    type="button"
                    className={`has-cinema-player-ep-chip ${
                      playingEpisode?.number === ep.number ? "active" : ""
                    }`}
                    onClick={() =>
                      startPlayback(playingMedia || selectedMedia, playingSeasonNumber, ep)
                    }
                    title={ep.title}
                  >
                    {ep.number}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="has-cinema-player-footer">
            <span className="has-cinema-player-note">
              🎬 <strong>Основной плеер:</strong> <strong>VidSrc Pro</strong> и <strong>VidLink Pro</strong> воспроизводят любые фильмы, сериалы и аниме без блокировок. Для переключения студийных озвучек нажмите <strong>«🇷🇺 Включить русскую озвучку»</strong> или выберите зеркало выше.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
