import { useCallback, useEffect, useId, useMemo, useRef } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { Radius } from '@/constants/theme';
import { parseMergeMessage, type MergeGameProps } from '@/features/minigame/merge-bridge';
import { createMergeHtml } from '@/features/minigame/merge-html';
import { useTokens } from '@/hooks/use-tokens';

/** Keep the game document isolated from application navigation and lifecycle. */
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
  const webView = useRef<WebView>(null);
  const finished = useRef(false);
  const appActive = useRef(AppState.currentState === 'active');
  const source = useMemo(
    () => ({
      html: createMergeHtml({
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
      `window.setMergeActive && window.setMergeActive(${enabled}); true;`,
    );
  }, [active]);

  useEffect(() => {
    finished.current = false;
    const currentView = webView.current;
    return () => {
      currentView?.injectJavaScript(
        'window.setMergeActive && window.setMergeActive(false); window.destroyMerge && window.destroyMerge(); true;',
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
      const message = parseMergeMessage(event.nativeEvent.data, channelId);
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
        accessibilityLabel="고양이 합치기"
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
    aspectRatio: 400 / 600,
    borderRadius: Radius.xl,
    overflow: 'hidden',
  },
  game: { flex: 1 },
});
