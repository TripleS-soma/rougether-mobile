import { type ReactNode, useState } from 'react';

/**
 * 처음 열릴 때 마운트하고 그 뒤로는 유지한다 (성능 장부 R5).
 *
 * 나의 방은 닫힌 시트 9종을 두 인스턴스(방·달력 탭) 모두 항상 마운트해 두고, 인라인 콜백
 * 때문에 화면이 그려질 때마다 같이 그렸다(실측: 콜드 약 15ms, 토글마다 약 7ms). 한 번도 안
 * 연 시트는 그리지 않는다. 한 번 열린 뒤에는 남겨 둬 닫힘 애니메이션이 그대로 돈다.
 */
export function MountOnce({ when, children }: { when: boolean; children: ReactNode }) {
  const [opened, setOpened] = useState(when);
  // 렌더 중 파생 상태 갱신 — 여는 그 렌더에 바로 그린다(effect면 한 프레임 늦는다).
  if (when && !opened) setOpened(true);
  return opened || when ? children : null;
}
