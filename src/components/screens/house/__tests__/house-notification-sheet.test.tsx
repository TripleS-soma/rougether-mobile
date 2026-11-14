import { fireEvent, render } from '@testing-library/react-native';

import { HouseNotificationSheet } from '@/components/screens/house/house-notification-sheet';

const READY = { state: 'ready' as const, freePostPush: true, verificationPostPush: false };

describe('HouseNotificationSheet (이 집 알림)', () => {
  it('채팅·자유글·인증글 세 줄을 값 그대로 스위치로 보인다', async () => {
    const ui = await render(
      <HouseNotificationSheet
        visible
        chat={{ on: true, onToggle: jest.fn() }}
        feed={{ ...READY, onToggle: jest.fn() }}
      />,
    );
    expect(ui.getByText('이 집 알림')).toBeTruthy();
    expect(ui.getByLabelText('채팅 알림').props.accessibilityState).toMatchObject({
      checked: true,
    });
    expect(ui.getByLabelText('자유글 알림').props.accessibilityState).toMatchObject({
      checked: true,
    });
    expect(ui.getByLabelText('인증글 알림').props.accessibilityState).toMatchObject({
      checked: false,
    });
    expect(ui.queryByText(/서버 준비 중/)).toBeNull();
  });

  it('스위치를 누르면 그 줄의 콜백만 불린다', async () => {
    const onChat = jest.fn();
    const onFeed = jest.fn();
    const ui = await render(
      <HouseNotificationSheet
        visible
        chat={{ on: true, onToggle: onChat }}
        feed={{ ...READY, onToggle: onFeed }}
      />,
    );
    await fireEvent.press(ui.getByLabelText('인증글 알림'));
    expect(onFeed).toHaveBeenCalledWith('verificationPostPush');
    await fireEvent.press(ui.getByLabelText('자유글 알림'));
    expect(onFeed).toHaveBeenLastCalledWith('freePostPush');
    expect(onChat).not.toHaveBeenCalled();
    await fireEvent.press(ui.getByLabelText('채팅 알림'));
    expect(onChat).toHaveBeenCalledTimes(1);
  });

  it('서버에 글 알림 설정이 아직 없으면 두 줄을 잠그고 안내한다 — 채팅은 그대로 쓴다', async () => {
    const onChat = jest.fn();
    const onFeed = jest.fn();
    const ui = await render(
      <HouseNotificationSheet
        visible
        chat={{ on: false, onToggle: onChat }}
        feed={{ ...READY, state: 'unavailable', onToggle: onFeed }}
      />,
    );
    expect(ui.getByText(/글 알림 설정은 서버 준비 중이에요/)).toBeTruthy();
    await fireEvent.press(ui.getByLabelText('자유글 알림'));
    await fireEvent.press(ui.getByLabelText('인증글 알림'));
    expect(onFeed).not.toHaveBeenCalled();
    await fireEvent.press(ui.getByLabelText('채팅 알림'));
    expect(onChat).toHaveBeenCalledTimes(1);
  });

  it('받는 중에는 누를 수 없다', async () => {
    const onFeed = jest.fn();
    const ui = await render(
      <HouseNotificationSheet
        visible
        chat={{ on: false }}
        feed={{ ...READY, state: 'loading', onToggle: onFeed }}
      />,
    );
    await fireEvent.press(ui.getByLabelText('자유글 알림'));
    expect(onFeed).not.toHaveBeenCalled();
    expect(ui.queryByText(/서버 준비 중/)).toBeNull();
  });

  it('피드가 꺼진 설치본(feed 없음)은 채팅 줄만 그린다', async () => {
    const ui = await render(
      <HouseNotificationSheet visible chat={{ on: true, onToggle: jest.fn() }} />,
    );
    expect(ui.getByLabelText('채팅 알림')).toBeTruthy();
    expect(ui.queryByLabelText('자유글 알림')).toBeNull();
    expect(ui.queryByLabelText('인증글 알림')).toBeNull();
  });
});
