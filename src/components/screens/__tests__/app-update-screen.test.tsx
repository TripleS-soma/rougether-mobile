import { fireEvent, render } from '@testing-library/react-native';

import { AppUpdateScreen, AppUpdateSheet } from '@/components/screens/app-update-screen';

describe('AppUpdateScreen', () => {
  it('막는 화면 — 안내와 스토어 버튼만 있고 닫는 길이 없다 (#1572)', async () => {
    const onOpenStore = jest.fn();
    const { getByText, queryByText } = await render(
      <AppUpdateScreen latestVersion="1.5.4" onOpenStore={onOpenStore} />,
    );
    expect(getByText('업데이트가 필요해요')).toBeTruthy();
    expect(getByText('최신 버전 1.5.4')).toBeTruthy();
    // 막는 판정은 미룰 수 없다 — '나중에'가 새어 나오면 여기서 잡는다.
    expect(queryByText('나중에')).toBeNull();
    await fireEvent.press(getByText('스토어로 가기'));
    expect(onOpenStore).toHaveBeenCalledTimes(1);
  });

  it('최신 버전을 모르면 버전 줄을 생략한다', async () => {
    const { queryByText } = await render(<AppUpdateScreen />);
    expect(queryByText(/^최신 버전 /)).toBeNull();
    expect(queryByText('업데이트가 필요해요')).toBeTruthy();
  });
});

describe('AppUpdateSheet', () => {
  it('닫혀 있으면 아무것도 보이지 않는다', async () => {
    const { queryByText } = await render(<AppUpdateSheet visible={false} />);
    expect(queryByText('새 버전이 나왔어요')).toBeNull();
  });

  it('열리면 안내와 두 버튼 — 나중에·스토어로 가기 (#1572)', async () => {
    const onOpenStore = jest.fn();
    const onLater = jest.fn();
    const { getByText } = await render(
      <AppUpdateSheet visible latestVersion="1.5.4" onOpenStore={onOpenStore} onLater={onLater} />,
    );
    expect(getByText('새 버전이 나왔어요')).toBeTruthy();
    expect(getByText('최신 버전 1.5.4')).toBeTruthy();
    await fireEvent.press(getByText('나중에'));
    expect(onLater).toHaveBeenCalledTimes(1);
    await fireEvent.press(getByText('스토어로 가기'));
    expect(onOpenStore).toHaveBeenCalledTimes(1);
  });
});
