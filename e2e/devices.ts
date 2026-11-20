export type Rect = { x: number; y: number; width: number; height: number };

export type E2eDevice = {
  name: 'phone' | 'duo-folded' | 'duo-open' | 'desktop';
  viewport: { width: number; height: number };
  touch: boolean;
  /** 시스템이 그리는 영역 — 조작 요소가 겹치면 안 된다. 뷰포트 좌표. */
  obstructions: Rect[];
};

export const DEVICES: Record<E2eDevice['name'], E2eDevice> = {
  phone: { name: 'phone', viewport: { width: 402, height: 874 }, touch: true, obstructions: [] },
  'duo-folded': {
    name: 'duo-folded',
    viewport: { width: 466, height: 678 },
    touch: true,
    obstructions: [{ x: 385, y: 20, width: 52, height: 133 }],
  },
  'duo-open': {
    name: 'duo-open',
    viewport: { width: 951, height: 669 },
    touch: true,
    obstructions: [{ x: 881, y: 29, width: 42, height: 70 }],
  },
  desktop: {
    name: 'desktop',
    viewport: { width: 1280, height: 800 },
    touch: false,
    obstructions: [],
  },
};
