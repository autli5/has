import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { WatchRoom } from "../types";
import type { CinemaMediaItem, CinemaEpisode, UserDto } from "../../../types";

interface UseWatchRoomOptions {
  isTauri: boolean;
  currentUser: UserDto | null;
  isPlayingState: boolean;
  playingMedia: CinemaMediaItem | null;
  playingSeasonNumber: number;
  playingEpisode: CinemaEpisode | null;
  currentPlaybackRef: React.MutableRefObject<{ currentTime: number; duration: number }>;
  showTvToast: (message: string, icon: string, duration: number) => void;
  triggerPlayerPlay: () => void;
  triggerPlayerPause: () => void;
  seekToPlayerTime: (time: number) => void;
  startPlayback: (media: CinemaMediaItem, season: number, episode?: CinemaEpisode) => void;
  trendingAll: CinemaMediaItem[];
  popularMovies: CinemaMediaItem[];
  popularSeries: CinemaMediaItem[];
  popularAnime: CinemaMediaItem[];
  searchResults: CinemaMediaItem[];
  selectedMedia: CinemaMediaItem | null;
  queryTmdb: (endpoint: string) => Promise<any>;
  mapTmdbItem: (item: any, forcedType?: "movie" | "tv") => CinemaMediaItem;
}

export const useWatchRoom = (options: UseWatchRoomOptions) => {
  const {
    isTauri,
    currentUser,
    isPlayingState,
    playingMedia,
    playingSeasonNumber,
    playingEpisode,
    currentPlaybackRef,
    showTvToast,
    triggerPlayerPlay,
    triggerPlayerPause,
    seekToPlayerTime,
    startPlayback,
    trendingAll,
    popularMovies,
    popularSeries,
    popularAnime,
    searchResults,
    selectedMedia,
    queryTmdb,
    mapTmdbItem,
  } = options;

  const [activeWatchRoom, setActiveWatchRoom] = useState<WatchRoom | null>(null);
  const [isRoomBusy, setIsRoomBusy] = useState<boolean>(false);
  const [roomError, setRoomError] = useState<string | null>(null);

  const activeRoomRef = useRef<WatchRoom | null>(null);
  const isSyncingFromRemoteRef = useRef<boolean>(false);
  const lastSyncedRemoteEpochRef = useRef<number>(0);

  activeRoomRef.current = activeWatchRoom;

  // Sync room state when play/pause/seek happens
  const syncRoomState = useCallback(
    async (isPlaying?: boolean, currentTimeSeconds?: number) => {
      if (!activeRoomRef.current || !isTauri || isSyncingFromRemoteRef.current) {
        return;
      }

      try {
        await invoke("sync_cinema_room", {
          roomCode: activeRoomRef.current.room_code,
          userEmail: currentUser?.email || "anonymous@has.local",
          userName: currentUser?.username || currentUser?.email || "Пользователь",
          isPlaying: isPlaying !== undefined ? isPlaying : isPlayingState,
          currentTimeSeconds: currentTimeSeconds !== undefined ? currentTimeSeconds : currentPlaybackRef.current.currentTime || 0,
          season: playingSeasonNumber,
          episode: playingEpisode?.number || 1,
        });
      } catch (err) {
        console.warn("Failed to sync room state:", err);
      }
    },
    [
      isTauri,
      currentUser,
      isPlayingState,
      playingSeasonNumber,
      playingEpisode,
      currentPlaybackRef,
    ]
  );

  // Synchronize local player to remote watch room state
  const syncPlaybackToRoom = useCallback(
    async (room: WatchRoom) => {
      isSyncingFromRemoteRef.current = true;
      lastSyncedRemoteEpochRef.current = room.updated_at_epoch;

      // 1. Locate media item
      let media = [
        ...trendingAll,
        ...popularMovies,
        ...popularSeries,
        ...popularAnime,
        ...searchResults,
        selectedMedia,
      ].find((m) => m && (m.id === room.media_id || (m.tmdb_id && String(m.tmdb_id) === String(room.media_id))));

      if (!media && room.media_id.startsWith("tmdb-")) {
        const parts = room.media_id.replace("tmdb-", "").split("-");
        const isTv = parts[0] === "tv";
        const tmdbId = parts[1];
        if (tmdbId) {
          try {
            const endpoint = isTv ? `/tv/${tmdbId}?language=ru-RU` : `/movie/${tmdbId}?language=ru-RU`;
            const raw = await queryTmdb(endpoint);
            if (raw) {
              media = mapTmdbItem(raw, isTv ? "tv" : "movie");
            }
          } catch {}
        }
      }

      if (!media) {
        // Fallback synthetic item from room metadata
        media = {
          id: room.media_id,
          title: room.media_title,
          media_type: room.media_type as "movie" | "tv",
          poster_url: room.poster_path || "",
          backdrop_url: room.poster_path || "",
          release_year: "2024",
          genre: room.media_type === "tv" ? "Сериал" : "Фильм",
          rating: 8.5,
          synopsis: `Совместный просмотр «${room.media_title}» в комнате ${room.room_code}.`,
          seasons: [],
        };
      }

      // 2. Start playback
      const ep =
        media.seasons.find((s) => s.season_number === room.season)?.episodes.find((e) => e.number === room.episode) ||
        {
          id: `play-${media.id}-s${room.season}-e${room.episode}`,
          number: room.episode || 1,
          title: room.media_type === "movie" ? "Полный фильм" : `Серия ${room.episode || 1}`,
          thumbnail: media.poster_url,
          duration_minutes: media.duration_minutes || (media.media_type === "movie" ? 120 : 45),
        };

      startPlayback(media, room.season, ep);

      // 3. Sync time position and playback status
      setTimeout(() => {
        if (room.current_time_seconds > 0) {
          seekToPlayerTime(room.current_time_seconds);
        }
        if (room.is_playing) {
          triggerPlayerPlay();
        } else {
          triggerPlayerPause();
        }
        setTimeout(() => {
          isSyncingFromRemoteRef.current = false;
        }, 500);
      }, 300);
    },
    [
      trendingAll,
      popularMovies,
      popularSeries,
      popularAnime,
      searchResults,
      selectedMedia,
      queryTmdb,
      mapTmdbItem,
      startPlayback,
      seekToPlayerTime,
      triggerPlayerPlay,
      triggerPlayerPause,
    ]
  );

  const handleCreateRoom = useCallback(
    async (mediaToUse?: CinemaMediaItem) => {
      const targetMedia = mediaToUse || playingMedia || selectedMedia;
      if (!targetMedia) {
        setRoomError("Выберите фильм или сериал для совместного просмотра");
        return;
      }

      if (!targetMedia.id || !targetMedia.title) {
        setRoomError("Некорректные данные медиа. Попробуйте другой контент.");
        return;
      }

      if (activeWatchRoom) {
        setRoomError("Вы уже находитесь в комнате. Сначала выйдите из текущей.");
        return;
      }

      setIsRoomBusy(true);
      setRoomError(null);
      try {
        const room: WatchRoom = await invoke("create_cinema_room", {
          userEmail: currentUser?.email || "anonymous@has.local",
          userName: currentUser?.username || currentUser?.email || "Пользователь",
          mediaId: targetMedia.id,
          mediaTitle: targetMedia.title,
          mediaType: targetMedia.media_type,
          posterPath: targetMedia.poster_url || targetMedia.backdrop_url || null,
          season: playingSeasonNumber || 1,
          episode: playingEpisode?.number || 1,
          currentTimeSeconds: currentPlaybackRef.current.currentTime || 0,
          isPlaying: isPlayingState,
        });

        setActiveWatchRoom(room);
        showTvToast(`Комната создана! Код: ${room.room_code}`, "🍿", 4000);

        // If not currently playing, start playback of target media
        if (!playingEpisode) {
          startPlayback(targetMedia, room.season);
        }

        return room;
      } catch (err: any) {
        setRoomError(err?.toString() || "Не удалось создать комнату");
      } finally {
        setIsRoomBusy(false);
      }
    },
    [
      playingMedia,
      selectedMedia,
      activeWatchRoom,
      currentUser,
      playingSeasonNumber,
      playingEpisode,
      currentPlaybackRef,
      isPlayingState,
      showTvToast,
      startPlayback,
    ]
  );

  const handleJoinRoom = useCallback(
    async (roomCode: string) => {
      const code = roomCode.trim().toUpperCase();
      if (!code) {
        setRoomError("Введите 6-значный код комнаты");
        return;
      }

      if (code.length !== 6) {
        setRoomError("Код комнаты должен быть 6 символов");
        return;
      }

      if (activeWatchRoom) {
        setRoomError("Вы уже находитесь в комнате. Сначала выйдите из текущей.");
        return;
      }

      setIsRoomBusy(true);
      setRoomError(null);
      try {
        const room: WatchRoom = await invoke("join_cinema_room", {
          roomCode: code,
          userEmail: currentUser?.email || "anonymous@has.local",
          userName: currentUser?.username || currentUser?.email || "Пользователь",
        });

        setActiveWatchRoom(room);
        showTvToast(`Вы вошли в комнату ${room.room_code}!`, "🍿", 3000);

        // Sync player to room media and position
        await syncPlaybackToRoom(room);

        return room;
      } catch (err: any) {
        setRoomError(err?.toString() || "Комната не найдена или ошибка сети");
      } finally {
        setIsRoomBusy(false);
      }
    },
    [activeWatchRoom, currentUser, showTvToast, syncPlaybackToRoom]
  );

  const handleLeaveRoom = useCallback(async () => {
    if (!activeWatchRoom) return;
    try {
      await invoke("leave_cinema_room", {
        roomCode: activeWatchRoom.room_code,
        userEmail: currentUser?.email || "anonymous@has.local",
      });
      setActiveWatchRoom(null);
      showTvToast("Вы вышли из комнаты совместного просмотра", "🚪", 2000);
    } catch (err) {
      console.warn("Failed to leave room gracefully:", err);
      setActiveWatchRoom(null);
      showTvToast("Соединение с комнатой потеряно", "⚠️", 2000);
    }
  }, [activeWatchRoom, currentUser, showTvToast]);

  // Polling loop for active Watch Together room
  useEffect(() => {
    if (!activeWatchRoom) return;

    const interval = setInterval(async () => {
      try {
        const room: WatchRoom | null = await invoke("get_cinema_room", {
          roomCode: activeWatchRoom.room_code,
          userEmail: currentUser?.email || "anonymous@has.local",
        });

        if (!room) {
          setActiveWatchRoom(null);
          showTvToast("Комната закрыта", "ℹ️", 3000);
          return;
        }

        setActiveWatchRoom(room);

        // Check for remote sync events
        const isRemoteNewer = room.updated_at_epoch > (lastSyncedRemoteEpochRef.current || 0);
        const myName = currentUser?.username || currentUser?.email || "Я";
        const isByOther = room.updated_by !== myName && room.updated_by !== (currentUser?.email || "");

        if (isRemoteNewer && isByOther) {
          lastSyncedRemoteEpochRef.current = room.updated_at_epoch;
          isSyncingFromRemoteRef.current = true;

          // 1. Episode / Season check
          if (playingMedia && (playingSeasonNumber !== room.season || playingEpisode?.number !== room.episode)) {
            showTvToast(`${room.updated_by} переключил на сезон ${room.season}, серию ${room.episode}`, "📺", 3000);
            const ep = playingMedia.seasons
              .find((s) => s.season_number === room.season)
              ?.episodes.find((e) => e.number === room.episode);
            startPlayback(playingMedia, room.season, ep);
          }

          // 2. Play / Pause check
          if (room.is_playing !== isPlayingState) {
            if (room.is_playing) {
              triggerPlayerPlay();
              showTvToast(`${room.updated_by} запустил воспроизведение`, "▶", 2000);
            } else {
              triggerPlayerPause();
              showTvToast(`${room.updated_by} поставил на паузу`, "⏸", 2000);
            }
          }

          // 3. Seek / Time drift check (> 1.5 seconds)
          const localTime = currentPlaybackRef.current.currentTime || 0;
          const drift = Math.abs(localTime - room.current_time_seconds);
          if (drift > 1.5) {
            seekToPlayerTime(room.current_time_seconds);
            const mins = Math.floor(room.current_time_seconds / 60);
            const secs = Math.floor(room.current_time_seconds % 60);
            const formatted = `${mins}:${secs < 10 ? "0" : ""}${secs}`;
            showTvToast(`${room.updated_by} перемотал на ${formatted}`, "⏩", 2500);
          }

          setTimeout(() => {
            isSyncingFromRemoteRef.current = false;
          }, 400);
        }
      } catch (err) {
        console.warn("Room polling error:", err);
      }
    }, 800);

    return () => clearInterval(interval);
  }, [
    activeWatchRoom,
    currentUser,
    showTvToast,
    playingMedia,
    playingSeasonNumber,
    playingEpisode,
    isPlayingState,
    startPlayback,
    triggerPlayerPlay,
    triggerPlayerPause,
    seekToPlayerTime,
    currentPlaybackRef,
  ]);

  return {
    activeWatchRoom,
    isRoomBusy,
    roomError,
    setRoomError,
    syncRoomState,
    handleCreateRoom,
    handleJoinRoom,
    handleLeaveRoom,
    isSyncingFromRemoteRef,
  };
};
