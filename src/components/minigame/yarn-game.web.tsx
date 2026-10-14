import { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { GameRecovery } from '@/components/minigame/game-recovery';
import { useGameRecovery } from '@/components/minigame/use-game-recovery';
import { isCurrentGameFinish } from '@/features/minigame/message-envelope';

import { Radius } from '@/constants/theme';
import { parseYarnMessage, type YarnGameProps } from '@/features/minigame/yarn-bridge';
import { createYarnHtml } from '@/features/minigame/yarn-html';
import { useTokens } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

export function YarnGame({
  seed,
  active = true,
  practice = false,
  onFinish,
  onPauseChange,
  testID = 'yarn-game',
}: YarnGameProps) {
  const t = useTokens();
  const tr = useT();
  const palette = useRef(t).current;
  const { channelId, finished, error, fail, retry, isCurrentChannel } = useGameRecovery(
    'yarn',
    seed,
    practice,
  );
  const frame = useRef<HTMLIFrameElement>(null);
  const html = useMemo(
    () =>
      createYarnHtml({
        seed,
        practice,
        channelId,
        colors: palette,
      }),
    [seed, practice, channelId, palette],
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
      const message = parseYarnMessage(event.data, channelId);
      if (!message) {
        if (isCurrentGameFinish(event.data, channelId)) fail('finish');
        return;
      }
      if (message.type === 'ready') {
        syncActive();
      } else if (message.type === 'pause') {
        onPauseChange?.(message.paused);
      } else if (!finished.current) {
        finished.current = true;
        // 문서가 보낸 형태(ticks = 집은 횟수, picks)가 곧 서버 제출 형태다.
        onFinish({ ticks: message.result.ticks, picks: [...message.result.picks] });
      }
    };
    window.addEventListener('message', receive);
    document.addEventListener('visibilitychange', syncActive);
    syncActive();
    return () => {
      window.removeEventListener('message', receive);
      document.removeEventListener('visibilitychange', syncActive);
    };
  }, [channelId, onFinish, onPauseChange, syncActive, fail, finished, isCurrentChannel]);

  return (
    <View style={[styles.frame, { backgroundColor: t.surfaceMuted }]} testID={testID}>
      {error ? (
        <GameRecovery error={error} onRetry={retry} />
      ) : (
        <iframe
          key={channelId}
          ref={frame}
          title={tr('roomShop.minigame.frame.yarn')}
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
    aspectRatio: 420 / 600,
    borderRadius: Radius.xl,
    overflow: 'hidden',
  },
});
