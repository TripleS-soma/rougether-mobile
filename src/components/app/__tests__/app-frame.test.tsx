import { render } from '@testing-library/react-native';
import { useEffect } from 'react';
import { Platform, Text, View } from 'react-native';

import { AppFrame, ModalFrame } from '@/components/app/app-frame';
import { APP_FRAME_MAX_WIDTH, type AppFrame as AppFrameSize } from '@/hooks/use-app-frame';
import { flattenStyle } from '@/test-utils/style';

// 프레임 판정만 바꿔 가며 컴포넌트의 렌더 동작을 본다 — 순수 계산은 use-app-frame.test.
let mockFrame: AppFrameSize = { width: 390, height: 844, scale: 2, fontScale: 1, framed: false };
jest.mock('@/hooks/use-app-frame', () => ({
  ...jest.requireActual('@/hooks/use-app-frame'),
  useAppFrame: () => mockFrame,
}));

const NARROW: AppFrameSize = { width: 390, height: 844, scale: 2, fontScale: 1, framed: false };
const WIDE: AppFrameSize = {
  width: APP_FRAME_MAX_WIDTH,
  height: 900,
  scale: 2,
  fontScale: 1,
  framed: true,
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

  it('네이티브에서는 래퍼 View 없이 자식을 그대로 돌려준다', async () => {
    const os = jest.replaceProperty(Platform, 'OS', 'ios');
    try {
      mockFrame = WIDE;
      const { queryByTestId, getByText } = await render(
        <AppFrame>
          <Text>child</Text>
        </AppFrame>,
      );
      expect(getByText('child')).toBeTruthy();
      expect(queryByTestId('app-frame')).toBeNull();
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
      expect(wideInner.width).toBe(APP_FRAME_MAX_WIDTH);
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
      expect(getByTestId('modal-frame').props.pointerEvents).toBe('box-none');
    } finally {
      os.restore();
    }
  });
});
