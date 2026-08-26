import { fireEvent, render } from '@testing-library/react-native';

import {
  NotificationSettingsScreen,
  pushStepNotice,
} from '@/components/screens/notification-settings-screen';

describe('NotificationSettingsScreen', () => {
  it('renders the title and the server-backed rows (#495)', async () => {
    const { getByText, queryByText } = await render(<NotificationSettingsScreen />);
    expect(getByText('푸시 알림')).toBeTruthy();
    expect(getByText('전체 알림')).toBeTruthy();
    expect(getByText('루틴 리마인더')).toBeTruthy();
    expect(getByText('집 알림')).toBeTruthy();
    // 서버에 없는 항목은 화면에서도 사라졌다 (구 로컬 전용 토글).
    expect(queryByText('마케팅 정보 수신')).toBeNull();
    expect(queryByText(/서버 준비 중/)).toBeNull();
  });

  it('reports the flipped key and value', async () => {
    const onToggle = jest.fn();
    const { getByLabelText } = await render(<NotificationSettingsScreen onToggle={onToggle} />);

    await fireEvent.press(getByLabelText('전체 알림'));
    expect(onToggle).toHaveBeenCalledWith('all', false);

    await fireEvent.press(getByLabelText('집 알림'));
    expect(onToggle).toHaveBeenCalledWith('house', false);
  });

  it('ignores group toggles while the master is off (server keeps their values)', async () => {
    const onToggle = jest.fn();
    const { getByLabelText } = await render(
      <NotificationSettingsScreen
        settings={{ all: false, reminder: true, house: true }}
        onToggle={onToggle}
      />,
    );

    await fireEvent.press(getByLabelText('루틴 리마인더'));
    expect(onToggle).not.toHaveBeenCalled();
  });

  // 조회 실패 시 기본값이 서버값처럼 보이지 않게 안내한다 (#549).
  it('로드 실패 시 안내 배너 + 다시 불러오기를 보여준다 (#549)', async () => {
    const onRetry = jest.fn();
    const { getByText, getByLabelText, queryByText, rerender } = await render(
      <NotificationSettingsScreen loadError onRetry={onRetry} />,
    );

    expect(getByText(/설정을 불러오지 못했어요/)).toBeTruthy();
    await fireEvent.press(getByLabelText('다시 불러오기'));
    expect(onRetry).toHaveBeenCalledTimes(1);

    // 재조회 성공(해제) 시 배너가 사라진다.
    await rerender(<NotificationSettingsScreen loadError={false} onRetry={onRetry} />);
    expect(queryByText(/설정을 불러오지 못했어요/)).toBeNull();
  });

  /**
   * 설정을 다 켜뒀는데도 푸시가 안 오는 경우, 서버가 아니라 이 기기가
   * 등록조차 안 된 것일 수 있다 (#903). 그 구분이 화면에 없었다.
   */
  describe('기기 등록 상태 안내 (#903)', () => {
    it('등록이 끝났으면 아무 안내도 띄우지 않는다', async () => {
      const { queryByTestId } = await render(<NotificationSettingsScreen pushStep="registered" />);
      expect(queryByTestId('push-status-notice')).toBeNull();
    });

    // 한 테스트에 여러 번 render하면 앞 트리 정리가 끝나기 전에 다음이 붙어
    // 조회가 엇나간다 — 단계마다 따로 돌린다.
    it.each(['idle', 'unsupported', 'no-device'] as const)(
      '%s 에는 안내를 띄우지 않는다 — 사용자가 할 일이 없다',
      async (step) => {
        const { queryByTestId } = await render(<NotificationSettingsScreen pushStep={step} />);
        expect(queryByTestId('push-status-notice')).toBeNull();
      },
    );

    it('권한 거부는 무엇을 해야 하는지 말해준다', async () => {
      const { getByTestId, getByText } = await render(
        <NotificationSettingsScreen pushStep="permission-denied" />,
      );
      expect(getByTestId('push-status-notice')).toBeTruthy();
      expect(getByText(/시스템 설정/)).toBeTruthy();
    });

    it.each(['token-failed', 'register-failed'] as const)(
      '%s 도 무엇이 잘못됐는지 알려준다',
      async (step) => {
        const { getByTestId } = await render(<NotificationSettingsScreen pushStep={step} />);
        expect(getByTestId('push-status-notice')).toBeTruthy();
      },
    );

    it('토큰 실패와 서버 등록 실패는 서로 다른 문구다 — 원인이 다르다', () => {
      expect(pushStepNotice('token-failed')).not.toBe(pushStepNotice('register-failed'));
    });
  });
});
