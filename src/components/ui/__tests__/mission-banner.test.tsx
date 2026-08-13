import { fireEvent, render } from '@testing-library/react-native';

import { MissionBanner } from '@/components/ui/mission-banner';

describe('MissionBanner (#571)', () => {
  it('진행 카운터와 현재 미션 라벨을 보여주고, 탭하면 onPress가 발화한다', async () => {
    const onPress = jest.fn();
    const { getByText, getByLabelText } = await render(
      <MissionBanner
        stepIndex={1}
        totalSteps={4}
        label="뽑기 1회 해보기"
        onPress={onPress}
        onSkip={jest.fn()}
      />,
    );
    expect(getByText(/미션 2\/4/)).toBeTruthy();
    expect(getByText('뽑기 1회 해보기')).toBeTruthy();

    await fireEvent.press(getByLabelText('미션 2 뽑기 1회 해보기'));
    expect(onPress).toHaveBeenCalled();
  });

  it('건너뛰기는 확인 다이얼로그를 거쳐야 onSkip이 발화한다', async () => {
    const onSkip = jest.fn();
    const { getByText, getByLabelText } = await render(
      <MissionBanner
        stepIndex={0}
        totalSteps={4}
        label="첫 루틴 등록하기"
        onPress={jest.fn()}
        onSkip={onSkip}
      />,
    );
    await fireEvent.press(getByLabelText('미션 건너뛰기'));
    expect(getByText('미션을 건너뛸까요?')).toBeTruthy();
    expect(onSkip).not.toHaveBeenCalled();

    await fireEvent.press(getByLabelText('미션 건너뛰기 확인'));
    expect(onSkip).toHaveBeenCalled();
  });

  it('취소하면 onSkip 없이 다이얼로그만 닫힌다', async () => {
    const onSkip = jest.fn();
    const { getByLabelText, queryByText } = await render(
      <MissionBanner stepIndex={0} totalSteps={4} label="첫 루틴 등록하기" onSkip={onSkip} />,
    );
    await fireEvent.press(getByLabelText('미션 건너뛰기'));
    await fireEvent.press(getByLabelText('취소'));
    expect(onSkip).not.toHaveBeenCalled();
    expect(queryByText('미션을 건너뛸까요?')).toBeNull();
  });

  it('탭 어포던스 문구를 보여준다 (#571 후속)', async () => {
    const { getByText } = await render(
      <MissionBanner stepIndex={0} totalSteps={4} label="첫 루틴 등록하기" />,
    );
    expect(getByText(/눌러서 바로 시작해요/)).toBeTruthy();
  });
});
