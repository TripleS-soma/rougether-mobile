import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppUpdateScreen, AppUpdateSheet } from '@/components/screens/app-update-screen';
import { useAppVersionGate } from '@/hooks/use-app-version-gate';

/**
 * 구버전 설치본 업데이트 안내 배선 (#1572).
 *
 * 자식(앱 트리)은 **판정과 무관하게 항상 같은 자리에 마운트**된다 — 막는 판정에서
 * 내비게이터를 치우면 라우터 컨텍스트가 끊기고, 판정이 늦게 오는 순간(원격 조회가
 * 끝나는 시점) 앱 트리 전체가 다시 마운트된다. 막을 때는 위에 덮는다.
 *
 * 덮기만 하면 **스크린리더에는 아래 화면이 계속 읽힌다** — 터치는 오버레이가 막지만
 * VoiceOver·TalkBack 포커스는 그대로 들어간다. 그래서 막는 동안에는 아래 트리를
 * 접근성 트리에서만 걷어 낸다(마운트는 유지).
 */
export function AppVersionGate({ children }: { children: ReactNode }) {
  const { verdict, later, openStore } = useAppVersionGate();
  const blocked = verdict.level === 'blocked';
  return (
    <>
      <View
        style={styles.fill}
        accessibilityElementsHidden={blocked}
        importantForAccessibility={blocked ? 'no-hide-descendants' : 'auto'}>
        {children}
      </View>
      {blocked ? (
        <View style={StyleSheet.absoluteFill}>
          <AppUpdateScreen latestVersion={verdict.latestVersion} onOpenStore={openStore} />
        </View>
      ) : null}
      <AppUpdateSheet
        visible={verdict.level === 'recommended'}
        latestVersion={verdict.latestVersion}
        onOpenStore={openStore}
        onLater={later}
      />
    </>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
