import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Platform } from 'react-native';

import { getSessionUserId } from '@/api';
import { storeAppUrl, storeWebUrl } from '@/constants/store-links';
import {
  decideVersionGate,
  fetchVersionGate,
  installedBuildNumber,
  ruleForPlatform,
  type VersionGateVerdict,
} from '@/lib/app-version-gate';
import { loadDismissedBuild, saveDismissedBuild } from '@/lib/version-gate-store';

/** 하루에 여러 번 받을 이유가 없다 — 포커스 복귀마다 왕복하지 않게 길게 잡는다. */
const GATE_STALE_TIME = 6 * 60 * 60 * 1000;

const OK: VersionGateVerdict = { level: 'ok' };

export type AppVersionGate = {
  verdict: VersionGateVerdict;
  /** 권장 안내 미루기 — 이 세션에서 감추고, 로그인 상태면 번호를 기억한다. */
  later: () => void;
  /** 스토어 열기 — 스토어 앱 → 실패 시 웹 주소. `canOpenURL`은 쓰지 않는다. */
  openStore: () => void;
};

/**
 * 구버전 설치본 업데이트 안내 (#1572). 원격 설정(`app-version.json`)과 설치된
 * 바이너리의 빌드 번호를 비교한다. 조회 실패·번호 미확인·웹은 모두 'ok'로 통과한다 —
 * 안내를 못 하는 것보다 쓰던 앱을 못 쓰게 만드는 쪽이 나쁘다.
 */
export function useAppVersionGate(): AppVersionGate {
  const userId = getSessionUserId();
  const { data } = useQuery({
    queryKey: ['app-version-gate'],
    queryFn: ({ signal }) => fetchVersionGate(signal),
    enabled: Platform.OS !== 'web',
    staleTime: GATE_STALE_TIME,
  });

  // 바이너리 번호는 앱 수명 동안 바뀌지 않는다 — 한 번만 읽는다.
  const [installedBuild] = useState(() => installedBuildNumber());
  // 이 세션에서 미뤘는지. 계정이 없을 때(로그인 전)의 유일한 기억이다.
  const [laterInSession, setLaterInSession] = useState(false);
  // 지난 세션에 미룬 recommendedBuild. 번호가 더 올라가면 다시 안내한다.
  const [dismissedBuild, setDismissedBuild] = useState<number | undefined>(undefined);

  useEffect(() => {
    let active = true;
    void loadDismissedBuild(userId).then((build) => {
      if (active) setDismissedBuild(build);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  const raw = useMemo(
    () => decideVersionGate(ruleForPlatform(data), installedBuild),
    [data, installedBuild],
  );

  const verdict = useMemo(() => {
    // 막는 판정은 미룰 수 없다.
    if (raw.level !== 'recommended') return raw;
    if (laterInSession) return OK;
    if (
      dismissedBuild != null &&
      raw.recommendedBuild != null &&
      dismissedBuild >= raw.recommendedBuild
    )
      return OK;
    return raw;
  }, [raw, laterInSession, dismissedBuild]);

  const later = useCallback(() => {
    setLaterInSession(true);
    if (raw.recommendedBuild != null) void saveDismissedBuild(userId, raw.recommendedBuild);
  }, [raw.recommendedBuild, userId]);

  const openStore = useCallback(() => {
    const app = storeAppUrl();
    const web = storeWebUrl();
    if (!app && !web) return;
    const fallback = () => {
      if (web) void Linking.openURL(web).catch(() => {});
    };
    if (app) void Linking.openURL(app).catch(fallback);
    else fallback();
  }, []);

  return useMemo(() => ({ verdict, later, openStore }), [verdict, later, openStore]);
}
