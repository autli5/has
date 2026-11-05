import { useCallback } from "react";

interface UsePlayerControlsOptions {
  videoRef: React.RefObject<HTMLVideoElement>;
  setIsPlayingState: (playing: boolean) => void;
  showTvToast: (message: string, icon: string, duration: number) => void;
  sendIframePlaybackCommand: (command: string) => void;
  broadcastToWindowTree: (message: any) => void;
  currentPlaybackRef: React.MutableRefObject<{ currentTime: number; duration: number }>;
}

export const usePlayerControls = ({
  videoRef,
  setIsPlayingState,
  showTvToast,
  sendIframePlaybackCommand,
  broadcastToWindowTree,
  currentPlaybackRef,
}: UsePlayerControlsOptions) => {

  const triggerPlayerPlay = useCallback(() => {
    if (videoRef.current) {
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {});
      }
    } else {
      sendIframePlaybackCommand("play");
    }
    setIsPlayingState(true);
    showTvToast("Воспроизведение", "▶", 1200);
  }, [videoRef, sendIframePlaybackCommand, setIsPlayingState, showTvToast]);

  const triggerPlayerPause = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause();
    } else {
      sendIframePlaybackCommand("pause");
    }
    setIsPlayingState(false);
    showTvToast("Пауза", "⏸", 1200);
  }, [videoRef, sendIframePlaybackCommand, setIsPlayingState, showTvToast]);

  const triggerPlayerPlayPause = useCallback(() => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        triggerPlayerPlay();
      } else {
        triggerPlayerPause();
      }
    } else {
      sendIframePlaybackCommand("toggle");
    }
  }, [videoRef, triggerPlayerPlay, triggerPlayerPause, sendIframePlaybackCommand]);

  const seekToPlayerTime = useCallback((targetTime: number) => {
    const boundedTime = Math.max(0, targetTime);
    if (videoRef.current) {
      videoRef.current.currentTime = boundedTime;
      currentPlaybackRef.current.currentTime = boundedTime;
    } else {
      currentPlaybackRef.current.currentTime = boundedTime;
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          broadcastToWindowTree({ key: "kodik_player_api", value: { method: "seek", time: boundedTime } });
          broadcastToWindowTree({ api: "seek", set: boundedTime });
          broadcastToWindowTree({ api: "seek", time: boundedTime });
          broadcastToWindowTree({ action: "seek", time: boundedTime });
          broadcastToWindowTree({ method: "seek", time: boundedTime });
          broadcastToWindowTree({ method: "seekTo", value: boundedTime });
          broadcastToWindowTree({ type: "SEEK", data: { time: boundedTime } });
          broadcastToWindowTree({ type: "PLAYER_SEEK", time: boundedTime });
          broadcastToWindowTree({ type: "seek", time: boundedTime });
          broadcastToWindowTree({ action: "seek", time: boundedTime });
          broadcastToWindowTree({ event: "command", func: "seekTo", args: [boundedTime, true] });
          broadcastToWindowTree({ method: "setCurrentTime", value: boundedTime });
        }, i * 100);
      }
    }
  }, [videoRef, currentPlaybackRef, broadcastToWindowTree]);

  const skipPlayerTime = useCallback((secondsDelta: number) => {
    const newTime = (currentPlaybackRef.current.currentTime || 0) + secondsDelta;
    seekToPlayerTime(newTime);
    showTvToast(
      secondsDelta > 0 ? `+${secondsDelta} сек` : `${secondsDelta} сек`,
      secondsDelta > 0 ? "⏩" : "⏪",
      1000
    );
  }, [currentPlaybackRef, seekToPlayerTime, showTvToast]);

  return {
    triggerPlayerPlay,
    triggerPlayerPause,
    triggerPlayerPlayPause,
    seekToPlayerTime,
    skipPlayerTime,
  };
};
