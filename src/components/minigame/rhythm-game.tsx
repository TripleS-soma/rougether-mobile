import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { GameRecovery } from '@/components/minigame/game-recovery';
import { useGameRecovery } from '@/components/minigame/use-game-recovery';
import { parseGameFx, playGameFx } from '@/features/minigame/game-fx';
import { isCurrentGameFinish } from '@/features/minigame/message-envelope';

import { Radius } from '@/constants/theme';
import { parseRhythmMessage, type RhythmGameProps } from '@/features/minigame/rhythm-bridge';
import { createRhythmHtml } from '@/features/minigame/rhythm-html';
import { useTokens } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

/** Keep the game document isolated from application navigation and lifecycle. */
export function RhythmGame({ active = true, onFinish }: RhythmGameProps) {
  const t = useTokens();
  const tr = useT();
  const palette = useRef(t).current;
  const { channelId, finished, error, fail, retry, isCurrentChannel } = useGameRecovery(
    'rhythm',
    1,
    true,
  );
  const webView = useRef<WebView>(null);
  const appActive = useRef(AppState.currentState === 'active');
  const source = useMemo(
    () => ({
      html: createRhythmHtml({
        allowManualTime: __DEV__,
        channelId,
        colors: palette,
      }),
    }),
    [channelId, palette],
  );

  const syncActive = useCallback(() => {
    const enabled = active && appActive.current;
    webView.current?.injectJavaScript(
      `window.setRhythmActive && window.setRhythmActive(${enabled}); true;`,
    );
  }, [active]);

  useEffect(() => {
    const currentView = webView.current;
    return () => {
      currentView?.injectJavaScript(
        'window.setRhythmActive && window.setRhythmActive(false); window.destroyRhythm && window.destroyRhythm(); true;',
      );
    };
  }, [channelId]);

  useEffect(() => {
    syncActive();
    const subscription = AppState.addEventListener('change', (state) => {
      appActive.current = state === 'active';
      // Foreground availability does not resume play; the game asks the player.
      syncActive();
    });
    return () => subscription.remove();
  }, [syncActive]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      if (!isCurrentChannel(channelId)) return;
      // 손맛 (#1425) — 표시용 신호라 게임 상태와 무관하게 먼저 처리한다.
      const fx = parseGameFx(event.nativeEvent.data, channelId);
      if (fx) {
        playGameFx(fx);
        return;
      }
      const message = parseRhythmMessage(event.nativeEvent.data, channelId);
      if (!message) {
        if (isCurrentGameFinish(event.nativeEvent.data, channelId)) fail('finish');
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
    },
    [channelId, onFinish, syncActive, fail, finished, isCurrentChannel],
  );

  return (
    <View style={[styles.frame, { backgroundColor: t.surfaceMuted }]}>
      {error ? (
        <GameRecovery error={error} onRetry={retry} />
      ) : (
        <WebView
          key={channelId}
          ref={webView}
          testID="rhythm-game"
          accessibilityLabel={tr('minigame.rhythm.canvas')}
          source={source}
          style={[styles.game, { backgroundColor: t.surfaceMuted }]}
          originWhitelist={['*']}
          onShouldStartLoadWithRequest={({ url }) => url === 'about:blank'}
          onMessage={handleMessage}
          onLoadEnd={syncActive}
          onError={() => fail('load')}
          onContentProcessDidTerminate={() => fail('load')}
          onRenderProcessGone={() => fail('load')}
          javaScriptEnabled
          javaScriptCanOpenWindowsAutomatically={false}
          setSupportMultipleWindows={false}
          allowsLinkPreview={false}
          scrollEnabled={false}
          bounces={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    aspectRatio: 420 / 580,
    borderRadius: Radius.xl,
    overflow: 'hidden',
  },
  game: { flex: 1 },
});
