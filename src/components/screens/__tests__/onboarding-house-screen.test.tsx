import { fireEvent, render } from '@testing-library/react-native';

import { OnboardingHouseScreen } from '@/components/screens/onboarding-house-screen';

describe('OnboardingHouseScreen (#1407)', () => {
  it('좋아요·괜찮아요 두 선택을 보여주고 고른 값을 서버 enum으로 넘긴다', async () => {
    const onChoose = jest.fn();
    const { getByText } = await render(<OnboardingHouseScreen onChoose={onChoose} />);
    expect(getByText('루틴을 함께할 집을 찾아드릴까요?')).toBeTruthy();
    await fireEvent.press(getByText('좋아요'));
    expect(onChoose).toHaveBeenLastCalledWith('AUTO_JOIN');
    await fireEvent.press(getByText('괜찮아요'));
    expect(onChoose).toHaveBeenLastCalledWith('PERSONAL');
  });

  it('보내는 동안은 두 버튼이 잠긴다', async () => {
    const onChoose = jest.fn();
    const { getByText, getByLabelText } = await render(
      <OnboardingHouseScreen saving onChoose={onChoose} />,
    );
    expect(getByLabelText('집을 찾는 중')).toBeTruthy();
    await fireEvent.press(getByText('좋아요'));
    expect(onChoose).not.toHaveBeenCalled();
  });

  it('합류 결과 카드는 집 이름·인원을, 매칭 실패 카드는 공개 전환 안내를 보여준다', async () => {
    const onContinue = jest.fn();
    const joined = await render(
      <OnboardingHouseScreen
        outcome={{ result: 'JOINED', houseName: '아침형 인간들', memberCount: 3 }}
        onContinue={onContinue}
      />,
    );
    expect(joined.getByText("'아침형 인간들'에 합류했어요!")).toBeTruthy();
    expect(joined.getByText('구성원 3명이 함께해요')).toBeTruthy();
    await fireEvent.press(joined.getByText('계속'));
    expect(onContinue).toHaveBeenCalledTimes(1);
    await joined.unmount();

    const noMatch = await render(<OnboardingHouseScreen outcome={{ result: 'NO_MATCH' }} />);
    expect(noMatch.getByText('아직 함께할 집이 없어요')).toBeTruthy();
    expect(noMatch.queryByText('좋아요')).toBeNull();
    await noMatch.unmount();
  });

  it('집 이름을 못 받았으면 이름 없는 문구로 대신한다', async () => {
    const { getByText } = await render(<OnboardingHouseScreen outcome={{ result: 'JOINED' }} />);
    expect(getByText('새 집에 합류했어요!')).toBeTruthy();
    expect(getByText('집 탭에서 구성원을 만나보세요')).toBeTruthy();
  });
});
