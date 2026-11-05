import { useEffect, useRef } from "react";
import Hls from "hls.js";
import type { BalancerMirror } from "../types";

interface UseHlsPlayerOptions {
  videoRef: React.RefObject<HTMLVideoElement>;
  streamUrl: string | null;
  selectedMirror: BalancerMirror;
  onError?: (reason: string) => void;
}

export const useHlsPlayer = ({
  videoRef,
  streamUrl,
  selectedMirror,
  onError,
}: UseHlsPlayerOptions) => {
  const hlsInstanceRef = useRef<Hls | null>(null);

  useEffect(() => {
    if (!streamUrl || selectedMirror !== "anilibria") {
      return;
    }

    const video = videoRef.current;
    if (!video) {
      return;
    }

    if (Hls.isSupported()) {
      if (hlsInstanceRef.current) {
        hlsInstanceRef.current.destroy();
      }

      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
        maxBufferLength: 30,
        maxMaxBufferLength: 600,
        maxBufferSize: 60 * 1000 * 1000,
        maxBufferHole: 0.5,
        highBufferWatchdogPeriod: 2,
        nudgeOffset: 0.1,
        nudgeMaxRetry: 3,
        maxFragLookUpTolerance: 0.25,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 10,
        liveDurationInfinity: false,
        preferManagedMediaSource: true,
        progressive: true,
        abrEwmaDefaultEstimate: 500000,
        abrBandWidthFactor: 0.95,
        abrBandWidthUpFactor: 0.7,
        abrMaxWithRealBitrate: false,
        maxStarvationDelay: 4,
        maxLoadingDelay: 4,
        minAutoBitrate: 0,
        startLevel: -1,
        capLevelOnFPSDrop: false,
        capLevelToPlayerSize: false,
        testBandwidth: true,
        debug: false,
      });

      hlsInstanceRef.current = hls;
      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        try {
          video.volume = 1.0;
          video.muted = false;
        } catch {}
        video.play().catch(() => {});
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          console.warn("HLS fatal error, falling back:", data);
          hls.destroy();
          hlsInstanceRef.current = null;
          onError?.("HLS fatal error");
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = streamUrl;
      video.play().catch(() => {});
      video.onerror = () => {
        onError?.("Native HLS playback error");
      };
    }

    return () => {
      if (hlsInstanceRef.current) {
        hlsInstanceRef.current.destroy();
        hlsInstanceRef.current = null;
      }
    };
  }, [selectedMirror, streamUrl, videoRef, onError]);

  return { hlsInstanceRef };
};
