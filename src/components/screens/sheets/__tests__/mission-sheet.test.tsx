import { fireEvent, render } from '@testing-library/react-native';

import { MissionSheet } from '@/components/screens/sheets/mission-sheet';

describe('MissionSheet (#571)', () => {
  it('완료 전환: 미션 N 완료와 다음 미션, 하러 가기를 보여준다', async () => {
    const onGo = jest.fn();
    const onClose = jest.fn();
    const { getByText, getByLabelText } = await render(
      <MissionSheet
        visible
        completedStep={1}
        totalSteps={4}
        nextLabel="뽑기 1회 해보기"
        onGo={onGo}
        onClose={onClose}
      />,
    );
    expect(getByText('✅ 미션 1 완료!')).toBeTruthy();
    expect(getByText('다음 미션: 뽑기 1회 해보기')).toBeTruthy();

    await fireEvent.press(getByLabelText('다음 미션 하러 가기'));
    expect(onGo).toHaveBeenCalled();

    await fireEvent.press(getByLabelText('나중에 하기'));
    expect(onClose).toHaveBeenCalled();
  });

  it('마지막 미션: 축하 문구와 닫기 버튼만 보여준다', async () => {
    const onClose = jest.fn();
    const { getByText, getByLabelText, queryByLabelText } = await render(
      <MissionSheet visible completedStep={4} totalSteps={4} nextLabel={null} onClose={onClose} />,
    );
    expect(getByText('🎉 모든 미션 완료!')).toBeTruthy();
    expect(queryByLabelText('다음 미션 하러 가기')).toBeNull();

    await fireEvent.press(getByLabelText('미션 마치기'));
    expect(onClose).toHaveBeenCalled();
  });

  it('visible이 아니면 렌더되지 않는다', async () => {
    const { queryByText } = await render(
      <MissionSheet visible={false} completedStep={1} totalSteps={4} nextLabel="다음" />,
    );
    expect(queryByText('✅ 미션 1 완료!')).toBeNull();
  });

  it('다음 미션의 방법 한 줄(nextHint)을 함께 보여준다 (#571 후속)', async () => {
    const { getByText } = await render(
      <MissionSheet
        visible
        completedStep={1}
        totalSteps={4}
        nextLabel="뽑기 1회 해보기"
        nextHint="뽑기에서 코인으로 한 번 뽑아요"
      />,
    );
    expect(getByText(/뽑기에서 코인으로 한 번 뽑아요/)).toBeTruthy();
  });
});
