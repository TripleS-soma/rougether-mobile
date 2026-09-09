import { fireEvent, render } from '@testing-library/react-native';

import { NavMenuPopover } from '@/components/app/nav-menu-popover';
import { APP_FRAME_MAX_WIDTH } from '@/hooks/use-app-frame';
import { flattenStyle } from '@/test-utils/style';

// 데스크톱 프레임(#1227): 창 폭과 프레임 폭을 갈라 팝오버 앵커 오프셋을 본다.
let mockWindowWidth = 390;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWindowWidth, height: 844, scale: 2, fontScale: 1 }),
}));
jest.mock('@/hooks/use-app-frame', () => ({
  ...jest.requireActual('@/hooks/use-app-frame'),
  useAppFrame: () => ({
    width: Math.min(mockWindowWidth, 480),
    height: 844,
    scale: 2,
    fontScale: 1,
    framed: mockWindowWidth > 480,
  }),
}));

const baseProps = {
  visible: true,
  top: 80,
  onClose: jest.fn(),
  onSaveRoomImage: jest.fn(),
  onOpenCategoryManager: jest.fn(),
};

describe('NavMenuPopover', () => {
  it('exposes the backdrop as a labeled 닫기 button (#550)', async () => {
    const onClose = jest.fn();
    const { getByLabelText } = await render(<NavMenuPopover {...baseProps} onClose={onClose} />);

    const backdrop = getByLabelText('닫기');
    expect(backdrop).toBeTruthy();

    await fireEvent.press(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes first, then runs the tapped item', async () => {
    const onClose = jest.fn();
    const onOpenCategoryManager = jest.fn();
    const { getByLabelText } = await render(
      <NavMenuPopover
        {...baseProps}
        onClose={onClose}
        onOpenCategoryManager={onOpenCategoryManager}
      />,
    );

    await fireEvent.press(getByLabelText('카테고리 관리'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onOpenCategoryManager).toHaveBeenCalledTimes(1);
  });

  it('방 작업만 남는다 — 재화 내역·출석 이벤트 항목은 내 정보로 갔다 (#1055 → #1089)', async () => {
    const { getByLabelText, queryByLabelText } = await render(<NavMenuPopover {...baseProps} />);
    expect(getByLabelText('방 꾸미기')).toBeTruthy();
    expect(getByLabelText('루틴 관리')).toBeTruthy();
    expect(queryByLabelText('재화 내역')).toBeNull();
    expect(queryByLabelText(/출석 이벤트/)).toBeNull();
  });

  it('bottom 앵커가 오면 top 대신 그걸로 버튼 위에 연다 (#1055)', async () => {
    const { getByTestId } = await render(<NavMenuPopover {...baseProps} bottom={120} />);
    const style = Object.assign(
      {},
      ...[getByTestId('nav-menu-popover').props.style].flat(Infinity).filter(Boolean),
    );
    expect(style.bottom).toBe(120);
    expect(style.top).toBeUndefined();
  });
  it('데스크톱 프레임에서는 창 오른쪽이 아니라 프레임 오른쪽에 붙는다 (#1227 리뷰)', async () => {
    mockWindowWidth = 390;
    const narrow = await render(<NavMenuPopover {...baseProps} />);
    const narrowRight = flattenStyle(narrow.getByTestId('nav-menu-popover').props.style)
      .right as number;

    mockWindowWidth = 1280;
    const wide = await render(<NavMenuPopover {...baseProps} />);
    const wideRight = flattenStyle(wide.getByTestId('nav-menu-popover').props.style).right;
    expect(wideRight).toBe(narrowRight + (1280 - APP_FRAME_MAX_WIDTH) / 2);
    mockWindowWidth = 390;
  });
  it('onSaveRoomImage가 없으면(웹) 방 이미지 저장 항목을 숨긴다', async () => {
    const { onSaveRoomImage: _omit, ...rest } = baseProps;
    const ui = await render(<NavMenuPopover {...rest} />);
    expect(ui.queryByLabelText('방 이미지 저장')).toBeNull();
    expect(ui.getByLabelText('방 꾸미기')).toBeTruthy();
  });
});
