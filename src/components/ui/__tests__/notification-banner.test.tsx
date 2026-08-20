import { act, fireEvent, render } from '@testing-library/react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { NotificationBanner } from '@/components/ui/notification-banner';

describe('NotificationBanner (#902 — 인앱 푸시 배너)', () => {
  it('제목과 본문을 보여주고, 탭하면 목적지로 보낸 뒤 스스로 닫는다', async () => {
    const onPress = jest.fn();
    const onDismiss = jest.fn();
    const { getByText, getByLabelText } = await render(
      <NotificationBanner
        type="FRIEND_CHEER"
        title="응원이 도착했어요"
        body="오늘도 화이팅!"
        onPress={onPress}
        onDismiss={onDismiss}
      />,
    );
    expect(getByText('응원이 도착했어요')).toBeTruthy();
    expect(getByText('오늘도 화이팅!')).toBeTruthy();

    // 접근성 라벨은 제목과 본문을 합쳐 읽어준다 — 스크린리더가 배너 하나로 듣는다.
    await fireEvent.press(getByLabelText('응원이 도착했어요. 오늘도 화이팅!'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('visibleMs가 지나면 스스로 닫힌다', async () => {
    jest.useFakeTimers();
    try {
      const onDismiss = jest.fn();
      await render(
        <NotificationBanner title="제목" body="본문" visibleMs={1000} onDismiss={onDismiss} />,
      );
      expect(onDismiss).not.toHaveBeenCalled();
      await act(async () => {
        jest.advanceTimersByTime(1500);
      });
      expect(onDismiss).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('visibleMs가 0이면 자동으로 닫히지 않는다 (갤러리·수동 확인용)', async () => {
    jest.useFakeTimers();
    try {
      const onDismiss = jest.fn();
      await render(
        <NotificationBanner title="제목" body="본문" visibleMs={0} onDismiss={onDismiss} />,
      );
      await act(async () => {
        jest.advanceTimersByTime(30000);
      });
      expect(onDismiss).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('위로 밀면 닫히고, 아래로 미는 건 무시한다', async () => {
    // onDismiss는 접힘 애니메이션이 끝나야 불린다 — 타이머를 돌려야 확인된다.
    jest.useFakeTimers();
    try {
      const onDismiss = jest.fn();
      const swipe = async (translationY: number) => {
        fireGestureHandler(getByGestureTestId('notification-banner-pan'), [
          { state: State.BEGAN },
          { state: State.ACTIVE, translationY: 0 },
          { state: State.ACTIVE, translationY },
          { state: State.END, translationY },
        ]);
        await act(async () => {
          jest.advanceTimersByTime(600);
        });
      };
      await render(
        <NotificationBanner title="제목" body="본문" visibleMs={0} onDismiss={onDismiss} />,
      );

      // 아래로: 닫히지 않는다 (실수로 스크롤하다 사라지면 안 된다).
      await swipe(40);
      expect(onDismiss).not.toHaveBeenCalled();

      await swipe(-40);
      expect(onDismiss).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});
