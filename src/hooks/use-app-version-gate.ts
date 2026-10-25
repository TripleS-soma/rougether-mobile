import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Platform } from 'react-native';

import { getSessionUserId } from '@/api';
import { storeAppUrl, storeWebUrl } from '@/constants/store-links';
import { useAuth } from '@/hooks/use-auth';
import {
  decideVersionGate,
  fetchVersionGate,
  installedRuntime,
  type VersionGateVerdict,
} from '@/lib/app-version-gate';
import { loadDismissedVersion, saveDismissedVersion } from '@/lib/version-gate-store';

/** 하루에 여러 번 받을 이유가 없다 — 포커스 복귀마다 왕복하지 않게 길게 잡는다. */
const GATE_STALE_TIME = 6 * 60 * 60 * 1000;

const OK: VersionGateVerdict = { level: 'ok' };

export type AppVersionGate = {
  verdict: VersionGateVerdict;
  /** 권장 안내 미루기 — 이 세션에서 감추고, 로그인 상태면 버전을 기억한다. */
  later: () => void;
  /** 스토어 열기 — 스토어 앱 → 실패 시 웹 주소. `canOpenURL`은 쓰지 않는다. */
  openStore: () => void;
};

/**
 * 구버전 설치본 업데이트 안내 (#1572). 원격 설정(`app-version.json`)의 지문 목록과
 * 설치된 바이너리의 런타임 지문을 맞춘다. 조회 실패·지문 미확인·웹은 모두 'ok'로
 * 통과한다 — 안내를 못 하는 것보다 쓰던 앱을 못 쓰게 만드는 쪽이 나쁘다.
 */
export function useAppVersionGate(): AppVersionGate {
  // `getSessionUserId()`는 모듈 변수를 읽는 비반응형 함수다. 이 훅은 내비게이터
  // 바깥에 있어 세션 복원·로그인으로 저절로 리렌더되지 않는다 — `useAuth()`를
  // 구독해야 복원이 첫 렌더보다 늦을 때 userId가 undefined로 굳지 않는다.
  const { status } = useAuth();
  const userId = status === 'authed' ? getSessionUserId() : undefined;

  const { data } = useQuery({
    queryKey: ['app-version-gate'],
    queryFn: ({ signal }) => fetchVersionGate(signal),
    enabled: Platform.OS !== 'web',
    staleTime: GATE_STALE_TIME,
  });

  // 런타임 지문은 앱 수명 동안 바뀌지 않는다 — 한 번만 읽는다.
  const [runtime] = useState(() => installedRuntime());
  // 이 세션에서 미뤘는지. 로그인 전의 유일한 기억이다.
  const [laterInSession, setLaterInSession] = useState(false);
  /**
   * 지난 세션에 미룬 버전. 원격의 latestVersion이 달라지면 다시 안내한다.
   *
   * **누구의 기억인지 함께 들고 있는다.** 값만 들면 두 가지가 샌다 — 로드가
   * 끝나기 전(원격 조회가 더 빠를 때) 안 미룬 것으로 보여 시트가 떴다 닫히고,
   * 계정이 바뀐 직후엔 새 값이 올 때까지 이전 계정의 기억이 남는다.
   */
  const [dismissed, setDismissed] = useState<{
    userId: number | undefined;
    version?: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    // 계정이 바뀌면 이전 기억을 즉시 버린다 — 새 값을 기다리는 동안 쓰지 않는다.
    setDismissed(null);
    void loadDismissedVersion(userId).then((version) => {
      if (active) setDismissed({ userId, version });
    });
    return () => {
      active = false;
    };
  }, [userId]);

  const raw = useMemo(() => decideVersionGate(data, runtime), [data, runtime]);

  const verdict = useMemo(() => {
    // 막는 판정은 미룰 수 없다.
    if (raw.level !== 'recommended') return raw;
    if (laterInSession) return OK;
    // 이 계정의 기억을 읽기 전에는 띄우지 않는다 — 이미 미룬 사람에게
    // 시트가 떴다 닫히는 깜빡임이 된다.
    if (dismissed == null || dismissed.userId !== userId) return OK;
    if (dismissed.version != null && dismissed.version === raw.latestVersion) return OK;
    return raw;
  }, [raw, laterInSession, dismissed, userId]);

  const later = useCallback(() => {
    setLaterInSession(true);
    // 원격에 latestVersion이 없으면 저장할 단위가 없어 이 세션만 유효하다.
    // 랜딩 스모크가 semver를 요구하므로 정상 설정에서는 일어나지 않는다.
    void saveDismissedVersion(userId, raw.latestVersion);
  }, [raw.latestVersion, userId]);

  const openStore = useCallback(() => {
    const app = storeAppUrl();
    const web = storeWebUrl();
    const fallback = () => {
      if (web) void Linking.openURL(web).catch(() => {});
    };
    if (app) void Linking.openURL(app).catch(fallback);
    else fallback();
  }, []);

  return useMemo(() => ({ verdict, later, openStore }), [verdict, later, openStore]);
}
