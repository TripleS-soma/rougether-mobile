import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { i18n } from '@/i18n';
import { createInstrumentPlayer } from '@/lib/instrument-player';
import type { InstrumentPlayer } from '@/lib/instrument-player.types';
import { getInstrumentSound, INSTRUMENT_COOLDOWN_MS } from '@/resources/instrument-sounds';

/** At most one player per known instrument; never auto-play or resume on focus. */
export function useRoomInstrumentSounds(enabled = true) {
  const [error, setError] = useState<string | null>(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const foreground = useRef(
    AppState.currentState !== 'background' && AppState.currentState !== 'inactive',
  );
  const mounted = useRef(true);
  const players = useRef(new Map<string, InstrumentPlayer>());
  const lastTap = useRef(new Map<string, number>());

  const stop = useCallback(() => {
    for (const player of players.current.values()) player.dispose();
    players.current.clear();
    lastTap.current.clear();
  }, []);

  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener('change', (state) => {
      foreground.current = state === 'active';
      if (!foreground.current) stop();
    });
    return () => {
      mounted.current = false;
      subscription.remove();
      stop();
    };
  }, [stop]);
  useEffect(() => {
    if (!enabled) stop();
  }, [enabled, stop]);

  const play = useCallback((assetKey: string) => {
    const sound = getInstrumentSound(assetKey);
    if (!sound || !enabledRef.current || !foreground.current || !mounted.current) return;
    const now = Date.now();
    if (now - (lastTap.current.get(assetKey) ?? -Infinity) < INSTRUMENT_COOLDOWN_MS) return;
    lastTap.current.set(assetKey, now);
    setError(null);
    let player = players.current.get(assetKey);
    const fail = () => {
      if (!mounted.current || !player || players.current.get(assetKey) !== player) return;
      player.dispose();
      players.current.delete(assetKey);
      lastTap.current.delete(assetKey);
      setError(i18n.t('roomShop.instruments.playError'));
    };
    try {
      if (!player) {
        player = createInstrumentPlayer(sound.source, fail);
        players.current.set(assetKey, player);
      }
      void player.replay().catch(fail);
    } catch {
      if (player) fail();
      else {
        lastTap.current.delete(assetKey);
        setError(i18n.t('roomShop.instruments.playError'));
      }
    }
  }, []);

  return { play, stop, error };
}
