import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { GameRecovery } from '@/components/minigame/game-recovery';
import { useGameRecovery } from '@/components/minigame/use-game-recovery';
import { parseGameFx, playGameFx } from '@/features/minigame/game-fx';
import { isCurrentGameFinish } from '@/features/minigame/message-envelope';

import { Radius } from '@/constants/theme';
import {
  parseTowerMessage,
  towerReplay,
  type TowerGameProps,
} from '@/features/minigame/tower-bridge';
import { createTowerHtml } from '@/features/minigame/tower-html';
import { useTokens } from '@/hooks/use-tokens';
import { useT } from '@/i18n';

/** Keep the game document isolated from application navigation and lifecycle. */
export function TowerGame({
  seed,
  active = true,
  practice = false,
  onFinish,
  onPauseChange,
  testID = 'tower-game',
}: TowerGameProps) {
  const t = useTokens();
  const tr = useT();
  const palette = useRef(t).current;
  const { channelId, finished, error, fail, retry, isCurrentChannel } = useGameRecovery(
    'tower',
    seed,
    practice,
  );
  const webView = useRef<WebView>(null);
  const appActive = useRef(AppState.currentState === 'active');
  const source = useMemo(
    () => ({
      html: createTowerHtml({
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
      `window.setTowerActive && window.setTowerActive(${enabled}); true;`,
    );
  }, [active]);

  useEffect(() => {
    const currentView = webView.current;
    return () => {
      currentView?.injectJavaScript(
        'window.setTowerActive && window.setTowerActive(false); window.destroyTower && window.destroyTower(); true;',
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
      const message = parseTowerMessage(event.nativeEvent.data, channelId);
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
        // 떨어뜨린 틱은 러너의 제출 필드(jumpTicks)로 보낸다 — 서버가 같은 요청 형식을 재사용한다.
        onFinish(towerReplay(message.result));
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
          accessibilityLabel={tr('roomShop.minigame.frame.tower')}
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
    aspectRatio: 420 / 520,
    borderRadius: Radius.xl,
    overflow: 'hidden',
  },
  game: { flex: 1 },
});
