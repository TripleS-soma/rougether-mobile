import { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { GameRecovery } from '@/components/minigame/game-recovery';
import { useGameRecovery } from '@/components/minigame/use-game-recovery';
import { isCurrentGameFinish } from '@/features/minigame/message-envelope';

import { Radius } from '@/constants/theme';
import { parseRunnerMessage, type RunnerGameProps } from '@/features/minigame/runner-bridge';
import { createRunnerHtml } from '@/features/minigame/runner-html';
import { useTokens } from '@/hooks/use-tokens';

export function RunnerGame({
  seed,
  active = true,
  practice = false,
  onFinish,
  onPauseChange,
  testID = 'runner-game',
}: RunnerGameProps) {
  const t = useTokens();
  const palette = useRef(t).current;
  const { channelId, finished, error, fail, retry, isCurrentChannel } = useGameRecovery(
    'runner',
    seed,
    practice,
  );
  const frame = useRef<HTMLIFrameElement>(null);
  const html = useMemo(
    () =>
      createRunnerHtml({
        seed,
        practice,
        allowManualTime: __DEV__ && practice,
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
      const message = parseRunnerMessage(event.data, channelId);
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
        onFinish(message.result);
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
          title="러너 게임"
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
    aspectRatio: 720 / 420,
    borderRadius: Radius.xl,
    overflow: 'hidden',
  },
});
