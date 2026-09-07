import { useCallback, useEffect, useState } from 'react';

import type { NavTab } from '@/components/ui/bottom-nav';
import { readStartTab, writeStartTab } from '@/lib/start-tab';

/**
 * 시작 화면 설정 (#1139) — 마운트 시 기기 저장값을 읽고(`null` = 아직), 바꾸면 즉시
 * 보관한다. 앱 루트는 읽기만(첫 화면 결정), 설정 화면은 읽고 쓴다 — 서로 다른
 * 인스턴스라 설정을 바꿔도 지금 세션은 그대로고 다음 실행부터 적용된다.
 */
export function useStartTab(): { tab: NavTab | null; set: (tab: NavTab) => void } {
  const [tab, setTab] = useState<NavTab | null>(null);
  useEffect(() => {
    let active = true;
    void readStartTab().then((t) => {
      if (active) setTab(t);
    });
    return () => {
      active = false;
    };
  }, []);
  const set = useCallback((next: NavTab) => {
    setTab(next);
    void writeStartTab(next);
  }, []);
  return { tab, set };
}
