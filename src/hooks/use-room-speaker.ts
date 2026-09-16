import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createSpeakerPlayer } from '@/lib/speaker-player';
import { i18n } from '@/i18n';
import type { SpeakerPlayer } from '@/lib/speaker-player.types';
import {
  clampVolume,
  isSpeakerTrackId,
  SPEAKER_TRACKS,
  type SpeakerTrackId,
} from '@/resources/speaker';

const STORAGE_KEY = 'rougether.speaker.v1';
export function useRoomSpeaker(active = true) {
  const [trackId, setTrackId] = useState<SpeakerTrackId>('rain');
  const [volume, setVolumeState] = useState(0.35);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const playback = useRef({ playing, loading });
  playback.current = { playing, loading };
  const player = useRef<SpeakerPlayer | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revision = useRef(0);
  const touched = useRef(false);
  const preferences = useRef({ trackId, volume });
  const activeRef = useRef(active);
  activeRef.current = active;
  const stop = useCallback(() => {
    ++revision.current;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    player.current?.dispose();
    player.current = null;
    setPlaying(false);
    setLoading(false);
  }, []);
  useEffect(() => {
    let alive = true;
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!alive || touched.current || !raw) return;
        try {
          const saved = JSON.parse(raw);
          if (isSpeakerTrackId(saved.trackId)) preferences.current.trackId = saved.trackId;
          if (typeof saved.volume === 'number')
            preferences.current.volume = clampVolume(saved.volume);
          setTrackId(preferences.current.trackId);
          setVolumeState(preferences.current.volume);
        } catch {
          /* Keep defaults for corrupt preferences. */
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
      stop();
    };
  }, [stop]);
  useEffect(() => {
    if (!active) stop();
  }, [active, stop]);
  const persist = useCallback(() => {
    touched.current = true;
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(preferences.current)).catch(() => {});
  }, []);
  const play = useCallback(() => {
    if (!activeRef.current) return;
    stop();
    setError(null);
    setLoading(true);
    touched.current = true;
    const current = revision.current;
    const fail = () => {
      if (current !== revision.current) return;
      stop();
      setError(i18n.t('roomShop.speaker.playError'));
    };
    try {
      const track = SPEAKER_TRACKS.find((t) => t.id === preferences.current.trackId)!;
      player.current = createSpeakerPlayer(
        track.source,
        preferences.current.volume,
        (value) => {
          if (current !== revision.current) return;
          setPlaying(value);
          if (value) {
            setLoading(false);
            if (timer.current) clearTimeout(timer.current);
          }
        },
        fail,
        track.name,
      );
      timer.current = setTimeout(fail, 15000);
      void player.current.play().catch(fail);
    } catch {
      fail();
    }
  }, [stop]);
  const selectTrack = useCallback(
    (id: SpeakerTrackId) => {
      if (!isSpeakerTrackId(id) || id === preferences.current.trackId) return;
      const resume = playback.current.playing || playback.current.loading;
      stop();
      preferences.current.trackId = id;
      setTrackId(id);
      setError(null);
      persist();
      if (resume) play();
    },
    [persist, play, stop],
  );
  const setVolume = useCallback(
    (next: number) => {
      const value = clampVolume(next);
      preferences.current.volume = value;
      setVolumeState(value);
      player.current?.setVolume(value);
      persist();
    },
    [persist],
  );
  return { trackId, volume, playing, loading, error, play, stop, selectTrack, setVolume };
}
