import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { usePageActive } from '@/hooks/use-page-active';

type SetBackdrop = (owner: object, node: ReactNode | null) => void;

const FrameBackdropContext = createContext<SetBackdrop>(() => {});

export const FrameBackdropProvider = FrameBackdropContext.Provider;

/**
 * 앱 프레임 쪽 — 화면이 등록한 배경 하나를 들고 있는다. 등록은 주인(화면 인스턴스)별이라,
 * 탭이 바뀔 때 떠나는 화면의 해제가 새 화면의 등록을 지우지 않는다.
 */
export function useFrameBackdropHost(): { node: ReactNode | null; set: SetBackdrop } {
  const [entry, setEntry] = useState<{ owner: object; node: ReactNode } | null>(null);
  const set = useCallback<SetBackdrop>((owner, node) => {
    setEntry((cur) => {
      if (node == null) return cur?.owner === owner ? null : cur;
      return cur?.owner === owner && cur.node === node ? cur : { owner, node };
    });
  }, []);
  return useMemo(() => ({ node: entry?.node ?? null, set }), [entry, set]);
}

/**
 * 화면 쪽 — 가로 안전 영역 띠(접힌 아이폰 Duo의 오른쪽 시스템 표시 영역)까지 이어 그릴 배경을
 * 등록한다. 앱 프레임이 **창 전체 크기**의 층에 그리고 그 위를 화면이 덮으므로, 화면에서 쓰는
 * 것과 같은 세로 좌표로 그리면 띠에서 그대로 이어진다.
 *
 * `node`는 **참조를 고정**해서 넘긴다(useMemo) — 매 렌더 새 엘리먼트면 프레임이 계속 다시 그린다.
 * 보이지 않는 탭 페이지(`usePageActive`)는 등록하지 않는다. 프레임 밖(테스트·갤러리)에서는 무동작.
 */
export function useFrameBackdrop(node: ReactNode | null): void {
  const set = useContext(FrameBackdropContext);
  const active = usePageActive();
  const [owner] = useState(() => ({}));
  useEffect(() => {
    set(owner, active ? node : null);
  }, [set, owner, active, node]);
  useEffect(() => () => set(owner, null), [set, owner]);
}
