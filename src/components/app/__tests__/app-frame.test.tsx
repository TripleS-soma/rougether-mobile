import { render, within } from '@testing-library/react-native';
import { useEffect, useMemo } from 'react';
import { Platform, Text, View } from 'react-native';

import { AppFrame, ModalFrame, PhoneColumn } from '@/components/app/app-frame';
import { useFrameBackdrop } from '@/components/app/frame-backdrop';
import {
  APP_FRAME_MAX_WIDTH,
  SHEET_FRAME_MAX_WIDTH,
  type AppFrame as AppFrameSize,
} from '@/hooks/use-app-frame';
import { PageActiveContext } from '@/hooks/use-page-active';
import { flattenStyle } from '@/test-utils/style';

// 프레임 판정만 바꿔 가며 컴포넌트의 렌더 동작을 본다 — 순수 계산은 use-app-frame.test.
let mockFrame: AppFrameSize = {
  width: 390,
  height: 844,
  scale: 2,
  fontScale: 1,
  framed: false,
  split: false,
};
jest.mock('@/hooks/use-app-frame', () => ({
  ...jest.requireActual('@/hooks/use-app-frame'),
  useAppFrame: () => mockFrame,
}));

const NARROW: AppFrameSize = {
  width: 390,
  height: 844,
  scale: 2,
  fontScale: 1,
  framed: false,
  split: false,
};
const WIDE: AppFrameSize = {
  width: APP_FRAME_MAX_WIDTH,
  height: 900,
  scale: 2,
  fontScale: 1,
  framed: true,
  split: false,
};
const SPLIT: AppFrameSize = {
  width: 1200,
  height: 900,
  scale: 2,
  fontScale: 1,
  framed: true,
  split: true,
};

function Probe({ onMount }: { onMount: () => void }) {
  useEffect(() => {
    onMount();
  }, [onMount]);
  return <Text>probe</Text>;
}

describe('AppFrame / ModalFrame (#1227)', () => {
  afterEach(() => {
    mockFrame = NARROW;
  });

  // 폴드를 접었다 펴면 폭이 411 ↔ 750으로 바뀐다. 루트 타입이 바뀌면 라우터 Stack이
  // 통째로 리마운트돼 보던 화면이 처음으로 돌아간다.
  it('네이티브에서 폴드를 접었다 펴도(480 경계) 자식이 리마운트되지 않는다', async () => {
    const os = jest.replaceProperty(Platform, 'OS', 'android');
    try {
      const onMount = jest.fn();
      mockFrame = NARROW;
      const view = await render(
        <AppFrame>
          <Probe onMount={onMount} />
        </AppFrame>,
      );
      const narrowInner = flattenStyle(view.getByTestId('app-frame-inner').props.style);
      expect(narrowInner.width).toBe('100%');
      expect(narrowInner.maxWidth).toBeUndefined();

      mockFrame = WIDE;
      await view.rerender(
        <AppFrame>
          <Probe onMount={onMount} />
        </AppFrame>,
      );
      expect(onMount).toHaveBeenCalledTimes(1);
      const wideInner = flattenStyle(view.getByTestId('app-frame-inner').props.style);
      expect(wideInner.maxWidth).toBe(APP_FRAME_MAX_WIDTH);
    } finally {
      os.restore();
    }
  });

  it('네이티브 넓은 창에서 시트는 폰 컬럼 폭으로, 좁은 창에서는 창 폭 그대로', async () => {
    const os = jest.replaceProperty(Platform, 'OS', 'android');
    try {
      const onMount = jest.fn();
      mockFrame = NARROW;
      const view = await render(
        <ModalFrame>
          <Probe onMount={onMount} />
        </ModalFrame>,
      );
      const narrow = flattenStyle(view.getByTestId('modal-frame-inner').props.style);
      expect(narrow.width).toBe('100%');
      expect(narrow.justifyContent).toBe('flex-end');

      mockFrame = WIDE;
      await view.rerender(
        <ModalFrame>
          <Probe onMount={onMount} />
        </ModalFrame>,
      );
      // 시트를 연 채 펴도 시트 안 입력이 날아가지 않는다.
      expect(onMount).toHaveBeenCalledTimes(1);
      const wide = flattenStyle(view.getByTestId('modal-frame-inner').props.style);
      expect(wide.width).toBe(APP_FRAME_MAX_WIDTH);
      expect(view.getByTestId('modal-frame').props.pointerEvents).toBe('box-none');
    } finally {
      os.restore();
    }
  });

  it('웹에서 창이 480px 경계를 넘나들어도 자식이 리마운트되지 않는다', async () => {
    const os = jest.replaceProperty(Platform, 'OS', 'web');
    try {
      const onMount = jest.fn();
      mockFrame = NARROW;
      const view = await render(
        <AppFrame>
          <Probe onMount={onMount} />
        </AppFrame>,
      );
      expect(onMount).toHaveBeenCalledTimes(1);
      const narrowInner = flattenStyle(view.getByTestId('app-frame-inner').props.style);
      expect(narrowInner.width).toBe('100%');

      mockFrame = WIDE;
      await view.rerender(
        <AppFrame>
          <Probe onMount={onMount} />
        </AppFrame>,
      );
      expect(onMount).toHaveBeenCalledTimes(1);
      const wideInner = flattenStyle(view.getByTestId('app-frame-inner').props.style);
      expect(wideInner.maxWidth).toBe(APP_FRAME_MAX_WIDTH);
    } finally {
      os.restore();
    }
  });

  it('ModalFrame은 카드를 바닥에 붙이는 배치를 유지한다 (justifyContent flex-end)', async () => {
    const os = jest.replaceProperty(Platform, 'OS', 'web');
    try {
      mockFrame = WIDE;
      const { getByTestId } = await render(
        <ModalFrame>
          <View testID="card" />
        </ModalFrame>,
      );
      const inner = flattenStyle(getByTestId('modal-frame-inner').props.style);
      expect(inner.justifyContent).toBe('flex-end');
      expect(inner.width).toBe(APP_FRAME_MAX_WIDTH);
      // 앱 프레임의 양옆 테두리를 시트가 물려받으면 검은 선이 보인다 (#1367).
      expect(inner.borderLeftWidth).toBeUndefined();
      expect(inner.borderRightWidth).toBeUndefined();
      expect(getByTestId('modal-frame').props.pointerEvents).toBe('box-none');
    } finally {
      os.restore();
    }
  });

  it('2단 창에서는 시트 폭이 폰 컬럼보다 넓어지고(최대 640) 테두리는 없다 (#1367)', async () => {
    const os = jest.replaceProperty(Platform, 'OS', 'web');
    try {
      mockFrame = SPLIT;
      const { getByTestId } = await render(
        <ModalFrame>
          <View testID="card" />
        </ModalFrame>,
      );
      const inner = flattenStyle(getByTestId('modal-frame-inner').props.style);
      expect(inner.maxWidth).toBe(SHEET_FRAME_MAX_WIDTH);
      expect(inner.width).toBe('100%');
      expect(inner.borderLeftWidth).toBeUndefined();
      expect(inner.justifyContent).toBe('flex-end');
    } finally {
      os.restore();
    }
  });
  it('터치 기기의 2단(splitFill)은 최대 폭·테두리 없이 창을 다 쓴다 — 펼친 폴더블', async () => {
    mockFrame = { ...SPLIT, width: 867, splitFill: true };
    const { getByTestId } = await render(
      <AppFrame>
        <Text>page</Text>
      </AppFrame>,
    );
    const inner = flattenStyle(getByTestId('app-frame-inner').props.style);
    expect(inner.width).toBe('100%');
    expect(inner.maxWidth).toBeUndefined();
    expect(inner.borderLeftWidth).toBeUndefined();
  });

  it('2단 프레임은 훅이 정한 폭(최대 1200)으로 넓어지고, PhoneColumn은 그 안에서 480 컬럼 (#1230)', async () => {
    const os = jest.replaceProperty(Platform, 'OS', 'web');
    try {
      mockFrame = SPLIT;
      const { getByTestId } = await render(
        <AppFrame>
          <PhoneColumn>
            <Text>page</Text>
          </PhoneColumn>
        </AppFrame>,
      );
      const inner = flattenStyle(getByTestId('app-frame-inner').props.style);
      // 정적 maxWidth 클래스 — 동적 width는 웹 DOM에 안 실렸다.
      expect(inner.maxWidth).toBe(1200);
      expect(inner.width).toBe('100%');
      // 2단은 폰 프레임 테두리가 없다 — 창 전체가 한 면, 내용 블록만 가운데.
      expect(inner.borderLeftWidth).toBeUndefined();
      const col = flattenStyle(getByTestId('phone-column').props.style);
      expect(col.width).toBe(APP_FRAME_MAX_WIDTH);
      expect(col.alignSelf).toBe('center');
    } finally {
      os.restore();
    }
  });

  // 아이폰 Duo: 오른쪽 84pt가 시스템 표시 영역(가로 안전 영역 인셋). 프레임이 그만큼 비워야
  // 머리 버튼·모달 닫기 버튼이 그 밑에 깔리지 않는다. 바탕색은 화면색으로 이어 칠한다.
  it('가로 안전 영역 인셋만큼 앱 프레임 양옆을 비우고 화면색으로 칠한다', async () => {
    mockFrame = { ...NARROW, width: 382, insetLeft: 0, insetRight: 84 };
    const view = await render(
      <AppFrame>
        <Text>내용</Text>
      </AppFrame>,
    );
    const outer = flattenStyle(view.getByTestId('app-frame').props.style);
    expect(outer.paddingRight).toBe(84);
    expect(outer.paddingLeft).toBe(0);
    expect(outer.backgroundColor).toBeDefined();
  });

  it('인셋이 없으면 앱 프레임에 여백도 바탕색도 넣지 않는다 (폰 화면 불변)', async () => {
    mockFrame = NARROW;
    const view = await render(
      <AppFrame>
        <Text>내용</Text>
      </AppFrame>,
    );
    const outer = flattenStyle(view.getByTestId('app-frame').props.style);
    expect(outer.paddingRight).toBeUndefined();
    expect(outer.paddingLeft).toBeUndefined();
    expect(outer.backgroundColor).toBeUndefined();
  });

  it('모달 프레임도 같은 인셋만큼 내용을 안으로 들인다 — 딤은 프레임 밖이라 창 전체를 덮는다', async () => {
    mockFrame = { ...NARROW, width: 382, insetLeft: 0, insetRight: 84 };
    const view = await render(
      <ModalFrame>
        <Text>시트</Text>
      </ModalFrame>,
    );
    const outer = flattenStyle(view.getByTestId('modal-frame').props.style);
    expect(outer.paddingRight).toBe(84);
    expect(outer.paddingLeft).toBe(0);
  });

  it('PhoneColumn은 2단이 아니면 래퍼 없이 자식 그대로', async () => {
    mockFrame = WIDE;
    const { queryByTestId, getByText } = await render(
      <PhoneColumn>
        <Text>page</Text>
      </PhoneColumn>,
    );
    expect(getByText('page')).toBeTruthy();
    expect(queryByTestId('phone-column')).toBeNull();
  });
});

// 가로 안전 영역 띠(접힌 아이폰 Duo의 오른쪽 84pt)는 지금 보이는 화면의 배경으로 잇는다 —
// 집의 하늘·방의 벽지 옆에 앱 기본색 띠가 서면 여백으로 보인다.
describe('AppFrame — 안전 영역 띠의 화면 배경', () => {
  const DUO: AppFrameSize = { ...NARROW, width: 382, height: 678, insetLeft: 0, insetRight: 84 };
  afterEach(() => {
    mockFrame = NARROW;
  });
  function Sky({ on = true }: { on?: boolean }) {
    const node = useMemo(() => <View testID="sky" />, []);
    useFrameBackdrop(on ? node : null);
    return <Text>house</Text>;
  }

  it('화면이 등록한 배경을 프레임 뒤(띠 자리)에 그린다', async () => {
    mockFrame = DUO;
    const ui = await render(
      <AppFrame>
        <Sky />
      </AppFrame>,
    );
    expect(within(ui.getByTestId('frame-backdrop')).getByTestId('sky')).toBeTruthy();
    // 내용 칸 밖(앞 형제)이라 화면을 가리지 않는다.
    const outer = ui.getByTestId('app-frame');
    expect(outer.children[0]).toBe(ui.getByTestId('frame-backdrop'));
  });

  it('등록을 풀거나 화면이 사라지면 지운다', async () => {
    mockFrame = DUO;
    const ui = await render(
      <AppFrame>
        <Sky />
      </AppFrame>,
    );
    await ui.rerender(
      <AppFrame>
        <Sky on={false} />
      </AppFrame>,
    );
    expect(ui.queryByTestId('frame-backdrop')).toBeNull();
    await ui.rerender(
      <AppFrame>
        <Sky />
      </AppFrame>,
    );
    expect(ui.getByTestId('sky')).toBeTruthy();
    await ui.rerender(
      <AppFrame>
        <Text>other</Text>
      </AppFrame>,
    );
    expect(ui.queryByTestId('frame-backdrop')).toBeNull();
  });

  it('보이지 않는 탭 페이지의 배경은 그리지 않는다', async () => {
    mockFrame = DUO;
    const ui = await render(
      <AppFrame>
        <PageActiveContext.Provider value={false}>
          <Sky />
        </PageActiveContext.Provider>
      </AppFrame>,
    );
    expect(ui.queryByTestId('frame-backdrop')).toBeNull();
  });

  it('가로 인셋이 없거나 폰 컬럼 프레임이면 그리지 않는다', async () => {
    for (const frame of [NARROW, { ...WIDE, insetLeft: 0, insetRight: 84 }]) {
      mockFrame = frame;
      const ui = await render(
        <AppFrame>
          <Sky />
        </AppFrame>,
      );
      expect(ui.queryByTestId('frame-backdrop')).toBeNull();
      ui.unmount();
    }
  });
});
