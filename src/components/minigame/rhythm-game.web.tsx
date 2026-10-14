import { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { GameRecovery } from '@/components/minigame/game-recovery';
import { useGameRecovery } from '@/components/minigame/use-game-recovery';
import { isCurrentGameFinish } from '@/features/minigame/message-envelope';

import { Radius } from '@/constants/theme';
import { parseRhythmMessage, type RhythmGameProps } from '@/features/minigame/rhythm-bridge';
import { createRhythmHtml } from '@/features/minigame/rhythm-html';
import { useTokens } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

export function RhythmGame({ active = true, onFinish }: RhythmGameProps) {
  const t = useTokens();
  const tr = useT();
  const palette = useRef(t).current;
  const { channelId, finished, error, fail, retry, isCurrentChannel } = useGameRecovery(
    'rhythm',
    1,
    true,
  );
  const frame = useRef<HTMLIFrameElement>(null);
  const html = useMemo(
    () =>
      createRhythmHtml({
        allowManualTime: __DEV__,
        channelId,
        colors: palette,
      }),
    [channelId, palette],
  );

  const syncActive = useCallback(() => {
    frame.current?.contentWindow?.postMessage(
      { channelId, type: 'active', active: active && document.visibilityState !== 'hidden' },
      '*',
    );
  }, [active, channelId]);

  useEffect(() => {
    const gameWindow = frame.current?.contentWindow;
    return () => {
      gameWindow?.postMessage({ channelId, type: 'active', active: false }, '*');
      gameWindow?.postMessage({ channelId, type: 'destroy' }, '*');
    };
  }, [channelId]);

  useEffect(() => {
    const receive = (event: MessageEvent<unknown>) => {
      if (event.source !== frame.current?.contentWindow) return;
      if (!isCurrentChannel(channelId)) return;
      const message = parseRhythmMessage(event.data, channelId);
      if (!message) {
        if (isCurrentGameFinish(event.data, channelId)) fail('finish');
        return;
      }
      if (message.type === 'ready') {
        syncActive();
      } else if (message.type === 'error') {
        fail('load');
      } else if (message.type === 'finish' && message.result && !finished.current) {
        finished.current = true;
        onFinish?.(message.result);
      }
    };
    window.addEventListener('message', receive);
    document.addEventListener('visibilitychange', syncActive);
    syncActive();
    return () => {
      window.removeEventListener('message', receive);
      document.removeEventListener('visibilitychange', syncActive);
    };
  }, [channelId, onFinish, syncActive, fail, finished, isCurrentChannel]);

  return (
    <View style={[styles.frame, { backgroundColor: t.surfaceMuted }]} testID="rhythm-game">
      {error ? (
        <GameRecovery error={error} onRetry={retry} />
      ) : (
        <iframe
          key={channelId}
          ref={frame}
          title={tr('minigame.rhythm.canvas')}
          srcDoc={html}
          sandbox="allow-scripts"
          onLoad={syncActive}
          onError={() => fail('load')}
          style={iframeStyle}
        />
      )}
    </View>
  );
}

const iframeStyle = { width: '100%', height: '100%', border: 0, display: 'block' } as const;

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    aspectRatio: 420 / 580,
    borderRadius: Radius.xl,
    overflow: 'hidden',
  },
});
