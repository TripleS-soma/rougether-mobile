import { useCallback, useEffect, useId, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { parseMergeMessage, type MergeGameProps } from '@/features/minigame/merge-bridge';
import { createMergeHtml } from '@/features/minigame/merge-html';
import { useTokens } from '@/hooks/use-tokens';

export function MergeGame({
  seed,
  active = true,
  practice = false,
  onFinish,
  onPauseChange,
  testID = 'merge-game',
}: MergeGameProps) {
  const t = useTokens();
  const palette = useRef(t).current;
  const instanceId = useId();
  const channelId = `${instanceId}-merge-${seed}-${practice}`;
  const frame = useRef<HTMLIFrameElement>(null);
  const finished = useRef(false);
  const html = useMemo(
    () =>
      createMergeHtml({
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
    finished.current = false;
    const gameWindow = frame.current?.contentWindow;
    return () => {
      gameWindow?.postMessage({ channelId, type: 'active', active: false }, '*');
      gameWindow?.postMessage({ channelId, type: 'destroy' }, '*');
    };
  }, [channelId]);

  useEffect(() => {
    const receive = (event: MessageEvent<unknown>) => {
      if (event.source !== frame.current?.contentWindow) return;
      const message = parseMergeMessage(event.data, channelId);
      if (!message) return;
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
  }, [channelId, onFinish, onPauseChange, syncActive]);

  return (
    <View style={[styles.frame, { backgroundColor: t.surfaceMuted }]} testID={testID}>
      <iframe
        key={channelId}
        ref={frame}
        title="고양이 합치기"
        srcDoc={html}
        sandbox="allow-scripts"
        allowFullScreen
        onLoad={syncActive}
        style={iframeStyle}
      />
    </View>
  );
}

const iframeStyle = { width: '100%', height: '100%', border: 0, display: 'block' } as const;

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    aspectRatio: 400 / 600,
    borderRadius: Radius.xl,
    overflow: 'hidden',
  },
});
