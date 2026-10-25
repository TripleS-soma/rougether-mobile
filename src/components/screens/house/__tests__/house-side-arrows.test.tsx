import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import {
  HouseSideArrows,
  SIDE_ARROW_SIZE,
  sideArrowTop,
} from '@/components/screens/house/house-side-arrows';
import { Spacing } from '@/constants/theme';

describe('HouseSideArrows (#1575)', () => {
  it('이전/다음 집 라벨로 콜백을 부른다', async () => {
    const onPrev = jest.fn();
    const onNext = jest.fn();
    const ui = await render(<HouseSideArrows showArrows onPrev={onPrev} onNext={onNext} />);
    await fireEvent.press(ui.getByLabelText('이전 집'));
    await fireEvent.press(ui.getByLabelText('다음 집'));
    expect(onPrev).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('집이 하나면 그리지 않는다', async () => {
    const ui = await render(
      <HouseSideArrows showArrows={false} onPrev={jest.fn()} onNext={jest.fn()} />,
    );
    expect(ui.queryByLabelText('이전 집')).toBeNull();
    expect(ui.queryByLabelText('다음 집')).toBeNull();
  });

  it('화면 세로 가운데, 왼쪽·오른쪽 끝에 뜬다', async () => {
    const ui = await render(<HouseSideArrows showArrows onPrev={jest.fn()} onNext={jest.fn()} />);
    const prev = StyleSheet.flatten(ui.getByLabelText('이전 집').props.style);
    const next = StyleSheet.flatten(ui.getByLabelText('다음 집').props.style);
    for (const style of [prev, next]) {
      expect(style.position).toBe('absolute');
      expect(style.top).toBe('50%');
      expect(style.marginTop).toBe(-style.height / 2);
    }
    expect(prev.left).toBeDefined();
    expect(next.right).toBeDefined();
  });

  it('버튼 사이는 터치를 막지 않는다 — 집 프레임·방 타일이 그대로 눌린다', async () => {
    const ui = await render(<HouseSideArrows showArrows onPrev={jest.fn()} onNext={jest.fn()} />);
    expect(ui.getByTestId('house-side-arrows').props.pointerEvents).toBe('box-none');
  });

  /**
   * 오른쪽 위 레일과 겹치지 않게 (#1575). 실제 집엔 채팅까지 레일 버튼이 4개라
   * iPhone 15(852, 위 59)에서 레일이 469까지 내려온다 — 가운데(406~446)면 "집 관리" 위다.
   */
  describe('sideArrowTop', () => {
    it('레일과 겹치지 않으면 정확히 세로 가운데', () => {
      expect(sideArrowTop(900, 330)).toBe(450 - SIDE_ARROW_SIZE / 2);
    });
    it('레일과 겹치면 양쪽을 같이 레일 바로 아래로 내린다', () => {
      expect(sideArrowTop(852, 469)).toBe(469 + Spacing.three);
      expect(sideArrowTop(667, 430)).toBe(430 + Spacing.three);
    });
    it('측정 전엔 가운데 — 레일을 아직 못 쟀거나 레일이 없으면', () => {
      expect(sideArrowTop(0, 469)).toBeUndefined();
      expect(sideArrowTop(800, 0)).toBe(400 - SIDE_ARROW_SIZE / 2);
    });
  });

  it('위치를 받으면 양쪽 버튼이 같은 높이에 선다', async () => {
    const ui = await render(
      <HouseSideArrows showArrows top={485} onPrev={jest.fn()} onNext={jest.fn()} />,
    );
    for (const label of ['이전 집', '다음 집']) {
      const style = StyleSheet.flatten(ui.getByLabelText(label).props.style);
      expect(style.top).toBe(485);
      expect(style.marginTop).toBe(0);
    }
  });
});
