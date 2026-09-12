import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { GameRecovery } from '@/components/minigame/game-recovery';
import { useGameRecovery } from '@/components/minigame/use-game-recovery';
import { isCurrentGameFinish } from '@/features/minigame/message-envelope';

import { Radius } from '@/constants/theme';
import { parseRunnerMessage, type RunnerGameProps } from '@/features/minigame/runner-bridge';
import { createRunnerHtml } from '@/features/minigame/runner-html';
import { useTokens } from '@/hooks/use-tokens';

/** Keep the game document isolated from application navigation and lifecycle. */
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
  const webView = useRef<WebView>(null);
  const appActive = useRef(AppState.currentState === 'active');
  const source = useMemo(
    () => ({
      html: createRunnerHtml({
        seed,
        practice,
        allowManualTime: __DEV__ && practice,
        channelId,
        colors: palette,
      }),
    }),
    [seed, practice, channelId, palette],
  );

  const syncActive = useCallback(() => {
    const enabled = active && appActive.current;
    webView.current?.injectJavaScript(
      `window.setRunnerActive && window.setRunnerActive(${enabled}); true;`,
    );
  }, [active]);

  useEffect(() => {
    const currentView = webView.current;
    return () => {
      currentView?.injectJavaScript(
        'window.setRunnerActive && window.setRunnerActive(false); window.destroyRunner && window.destroyRunner(); true;',
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
      const message = parseRunnerMessage(event.nativeEvent.data, channelId);
      if (!message) {
        if (isCurrentGameFinish(event.nativeEvent.data, channelId)) fail('finish');
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
    },
    [channelId, onFinish, onPauseChange, syncActive, fail, finished, isCurrentChannel],
  );

  return (
    <View style={[styles.frame, { backgroundColor: t.surfaceMuted }]}>
      {error ? (
        <GameRecovery error={error} onRetry={retry} />
      ) : (
        <WebView
          key={channelId}
          ref={webView}
          testID={testID}
          accessibilityLabel="러너 게임"
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
          dataDetectorTypes="none"
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
    aspectRatio: 720 / 420,
    borderRadius: Radius.xl,
    overflow: 'hidden',
  },
  game: { flex: 1 },
});
