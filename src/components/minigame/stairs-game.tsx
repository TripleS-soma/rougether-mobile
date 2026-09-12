import { useCallback, useEffect, useId, useMemo, useRef } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { Radius } from '@/constants/theme';
import { parseStairsMessage, type StairsGameProps } from '@/features/minigame/stairs-bridge';
import { createStairsHtml } from '@/features/minigame/stairs-html';
import { useTokens } from '@/hooks/use-tokens';

/** Keep the game document isolated from application navigation and lifecycle. */
export function StairsGame({
  seed,
  active = true,
  practice = false,
  onFinish,
  onPauseChange,
  testID = 'stairs-game',
}: StairsGameProps) {
  const t = useTokens();
  const palette = useRef(t).current;
  const instanceId = useId();
  const channelId = `${instanceId}-stairs-${seed}-${practice}`;
  const webView = useRef<WebView>(null);
  const finished = useRef(false);
  const appActive = useRef(AppState.currentState === 'active');
  const source = useMemo(
    () => ({
      html: createStairsHtml({
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
      `window.setStairsActive && window.setStairsActive(${enabled}); true;`,
    );
  }, [active]);

  useEffect(() => {
    finished.current = false;
    const currentView = webView.current;
    return () => {
      currentView?.injectJavaScript(
        'window.setStairsActive && window.setStairsActive(false); window.destroyStairs && window.destroyStairs(); true;',
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
      const message = parseStairsMessage(event.nativeEvent.data, channelId);
      if (!message) return;
      if (message.type === 'ready') {
        syncActive();
      } else if (message.type === 'pause') {
        onPauseChange?.(message.paused);
      } else if (!finished.current) {
        finished.current = true;
        onFinish(message.result);
      }
    },
    [channelId, onFinish, onPauseChange, syncActive],
  );

  return (
    <View style={[styles.frame, { backgroundColor: t.surfaceMuted }]}>
      <WebView
        key={channelId}
        ref={webView}
        testID={testID}
        accessibilityLabel="고양이 계단 오르기"
        source={source}
        style={[styles.game, { backgroundColor: t.surfaceMuted }]}
        originWhitelist={['*']}
        onShouldStartLoadWithRequest={({ url }) => url === 'about:blank'}
        onMessage={handleMessage}
        onLoadEnd={syncActive}
        javaScriptEnabled
        javaScriptCanOpenWindowsAutomatically={false}
        setSupportMultipleWindows={false}
        allowsLinkPreview={false}
        dataDetectorTypes="none"
        scrollEnabled={false}
        bounces={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    aspectRatio: 420 / 520,
    borderRadius: Radius.xl,
    overflow: 'hidden',
  },
  game: { flex: 1 },
});
