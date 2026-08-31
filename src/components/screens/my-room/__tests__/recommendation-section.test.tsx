import { fireEvent, render } from '@testing-library/react-native';

import {
  RecommendationSection,
  dayLabels,
  dayLabelsFromNums,
  daysLeftLabel,
} from '@/components/screens/my-room/recommendation-section';

const ITEM = {
  recommendationId: 1,
  type: 'ADJUST_DAYS',
  message: '『아침 러닝』 수요일 수행이 3주 연속 실패했어요.',
  routineId: 42,
  routineTitle: '아침 러닝',
  proposal: { repeatType: 'WEEKLY', daysOfWeek: ['FRI', 'MON'] },
  expiresAt: '2026-09-05T00:00:00',
};

const NOW = new Date('2026-08-31T09:00:00');

describe('요일·만료 라벨', () => {
  it('서버 토큰 순서와 무관하게 일~토 순으로 세운다', () => {
    expect(dayLabels(['FRI', 'MON'])).toBe('월 금');
    expect(dayLabels([])).toBe('');
  });

  it('앱 요일 번호도 같은 표기로 그린다', () => {
    expect(dayLabelsFromNums([5, 1, 3])).toBe('월 수 금');
  });

  it('만료까지 남은 날을 D-n으로, 당일은 오늘까지로 센다', () => {
    expect(daysLeftLabel('2026-09-05T00:00:00', NOW)).toBe('D-5');
    expect(daysLeftLabel('2026-08-31T23:00:00', NOW)).toBe('오늘까지');
    // 지난 건 서버가 목록에서 빼지만, 보는 사이 넘어가도 거짓말은 안 한다.
    expect(daysLeftLabel('2026-08-30T00:00:00', NOW)).toBeNull();
    expect(daysLeftLabel(undefined, NOW)).toBeNull();
  });
});

describe('RecommendationSection', () => {
  const setup = async (props: Partial<React.ComponentProps<typeof RecommendationSection>> = {}) => {
    const onAccept = jest.fn();
    const onDismiss = jest.fn();
    const view = await render(
      <RecommendationSection
        items={[ITEM]}
        onAccept={onAccept}
        onDismiss={onDismiss}
        currentDaysById={{ 42: [1, 3, 5] }}
        now={NOW}
        {...props}
      />,
    );
    return { onAccept, onDismiss, ...view };
  };

  it('제안이 없으면 아무것도 그리지 않는다', async () => {
    const { queryByTestId } = await setup({ items: [] });
    expect(queryByTestId('recommendation-section')).toBeNull();
  });

  it('서버 문구를 그대로 보여주고 만료까지 남은 날을 붙인다', async () => {
    const { getByText } = await setup();
    expect(getByText(ITEM.message)).toBeTruthy();
    expect(getByText('아침 러닝')).toBeTruthy();
    expect(getByText('D-5')).toBeTruthy();
  });

  it('변경 전 요일을 알면 전→후로 보여준다', async () => {
    const { getByText } = await setup();
    expect(getByText('월 수 금 → 월 금')).toBeTruthy();
  });

  it('변경 전 요일을 모르면 제안 요일만 보여준다', async () => {
    const { getByText } = await setup({ currentDaysById: undefined });
    expect(getByText('월 금')).toBeTruthy();
  });

  it('무시는 확인 없이 바로 처리한다 — 루틴을 건드리지 않으니까', async () => {
    const { onDismiss, onAccept, getByLabelText } = await setup();
    await fireEvent.press(getByLabelText('아침 러닝 제안 무시'));
    expect(onDismiss).toHaveBeenCalledWith(1);
    expect(onAccept).not.toHaveBeenCalled();
  });

  it('적용하기는 확인을 한 번 거친다 — 되돌릴 수 없는 변경', async () => {
    const { onAccept, getByLabelText, getByText } = await setup();
    await fireEvent.press(getByLabelText('아침 러닝 제안 적용하기'));
    expect(onAccept).not.toHaveBeenCalled();
    expect(getByText('반복 요일을 바꿀까요?')).toBeTruthy();

    await fireEvent.press(getByLabelText('제안 적용 확인'));
    expect(onAccept).toHaveBeenCalledWith(1);
  });

  it('확인을 취소하면 아무 일도 일어나지 않는다', async () => {
    const { onAccept, getByLabelText } = await setup();
    await fireEvent.press(getByLabelText('아침 러닝 제안 적용하기'));
    await fireEvent.press(getByLabelText('제안 적용 취소'));
    expect(onAccept).not.toHaveBeenCalled();
  });

  it('처리 중에는 버튼이 잠긴다 — 같은 제안이 두 번 나가지 않게', async () => {
    const { onAccept, onDismiss, getByLabelText } = await setup({ pendingId: 1 });
    await fireEvent.press(getByLabelText('아침 러닝 제안 무시'));
    await fireEvent.press(getByLabelText('아침 러닝 제안 적용하기'));
    expect(onDismiss).not.toHaveBeenCalled();
    expect(onAccept).not.toHaveBeenCalled();
  });
});
