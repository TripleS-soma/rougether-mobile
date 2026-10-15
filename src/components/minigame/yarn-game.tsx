import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { GameRecovery } from '@/components/minigame/game-recovery';
import { useGameRecovery } from '@/components/minigame/use-game-recovery';
import { parseGameFx, playGameFx } from '@/features/minigame/game-fx';
import { isCurrentGameFinish } from '@/features/minigame/message-envelope';

import { Radius } from '@/constants/theme';
import { parseYarnMessage, type YarnGameProps } from '@/features/minigame/yarn-bridge';
import { createYarnHtml } from '@/features/minigame/yarn-html';
import { useTokens } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

/** Keep the game document isolated from application navigation and lifecycle. */
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
  const webView = useRef<WebView>(null);
  const appActive = useRef(AppState.currentState === 'active');
  const source = useMemo(
    () => ({
      html: createYarnHtml({
        seed,
        practice,
        channelId,
        colors: palette,
      }),
    }),
    [seed, practice, channelId, palette],
  );

  const syncActive = useCallback(() => {
    const enabled = active && appActive.current;
    webView.current?.injectJavaScript(
      `window.setYarnActive && window.setYarnActive(${enabled}); true;`,
    );
  }, [active]);

  useEffect(() => {
    const currentView = webView.current;
    return () => {
      currentView?.injectJavaScript(
        'window.setYarnActive && window.setYarnActive(false); window.destroyYarn && window.destroyYarn(); true;',
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
      const message = parseYarnMessage(event.nativeEvent.data, channelId);
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
        // 문서가 보낸 형태(ticks = 집은 횟수, picks)가 곧 서버 제출 형태다.
        onFinish({ ticks: message.result.ticks, picks: [...message.result.picks] });
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
          accessibilityLabel={tr('roomShop.minigame.frame.yarn')}
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
    aspectRatio: 420 / 600,
    borderRadius: Radius.xl,
    overflow: 'hidden',
  },
  game: { flex: 1 },
});
