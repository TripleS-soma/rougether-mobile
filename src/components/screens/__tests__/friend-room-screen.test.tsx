import { act, fireEvent, render } from '@testing-library/react-native';

import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { FriendRoomScreen } from '@/components/screens/friend-room-screen';
import { shiftIso as isoShift, todayIso } from '@/utils/datetime';
import { ToastProvider } from '@/components/ui/toast';

describe('FriendRoomScreen', () => {
  // 거미줄 (#829) — 친구 방 씬 번들도 명시 조립이라 도달 여부를 직접 본다.
  it('거미줄 prop이 친구 방 캔버스까지 전달된다 (#829)', async () => {
    const { getByLabelText } = await render(
      <FriendRoomScreen cobweb={{ assetKey: 'items/cobweb.png' }} />,
    );
    expect(getByLabelText('거미줄이 꼈어요')).toBeTruthy();
  });

  it('renders the friend name, routine progress, and cheer buttons', async () => {
    const { getByText } = await render(<FriendRoomScreen friendName="민지" />);
    expect(getByText('민지의 방')).toBeTruthy();
    expect(getByText('민지의 루틴')).toBeTruthy();
    // 4 of 5 default routines completed.
    expect(getByText('4 / 5')).toBeTruthy();
    expect(getByText('잘하고 있어!')).toBeTruthy();
  });

  it('keeps the 의 방 suffix visible on narrow screens (shrink + middle ellipsis)', async () => {
    const { getByText } = await render(<FriendRoomScreen friendName="아주아주긴친구닉네임" />);
    const title = getByText('아주아주긴친구닉네임의 방');
    expect(title.props.adjustsFontSizeToFit).toBe(true);
    expect(title.props.minimumFontScale).toBe(0.75);
    expect(title.props.ellipsizeMode).toBe('middle');
    expect(title.props.numberOfLines).toBe(1);
  });

  /**
   * 최근 활동은 카드 섹션이 아니라 한 줄 스트립이다 (#860) — 접힌 상태에선
   * 요약만 보이고, 탭해야 날짜별 상세가 펼쳐진다.
   */
  it('접힌 상태에선 요약만, 탭하면 날짜별 상세를 펼친다 (#860)', async () => {
    const today = todayIso();
    const recentActivity = [
      { date: today, label: '오늘', titles: ['아침 기상'] },
      { date: isoShift(today, -1), label: '어제', titles: ['아침 기상', '독서 30분'] },
    ];
    const { getByText, queryByText, getByLabelText } = await render(
      <FriendRoomScreen recentActivity={recentActivity} />,
    );
    // 14일 중 2일 완료 — 숫자로도 읽힌다(점만으로는 못 센다).
    expect(getByText('최근 2주')).toBeTruthy();
    expect(getByText('2/14일')).toBeTruthy();
    // 접힌 상태에선 상세가 없다 — 이게 방명록을 위로 올린 핵심이다.
    expect(queryByText('아침 기상 · 독서 30분')).toBeNull();

    await fireEvent.press(getByLabelText(/최근 14일 중 2일 완료/));
    expect(getByText('아침 기상 · 독서 30분')).toBeTruthy();
    expect(getByText('어제')).toBeTruthy();
  });

  /**
   * 서버는 **완료가 있는 날만** 보낸다. 배열 길이를 그대로 세면 쉰 날이
   * 사라져 추이가 실제보다 좋아 보인다 — 오늘 기준 14일 축으로 세야 한다.
   */
  it('완료가 없는 날도 축에 세어 14일 기준으로 센다 (#860)', async () => {
    const today = todayIso();
    const recentActivity = [
      // 20일 전은 14일 축 밖 — 세면 안 된다.
      { date: isoShift(today, -20), label: '옛날', titles: ['아침 기상'] },
      { date: isoShift(today, -3), label: '3일 전', titles: ['아침 기상'] },
    ];
    const { getByText } = await render(<FriendRoomScreen recentActivity={recentActivity} />);
    expect(getByText('1/14일')).toBeTruthy();
  });

  it('기록이 없으면 0/14일, 펼치면 빈 상태 문구 (#860)', async () => {
    const { getByText, getByLabelText } = await render(<FriendRoomScreen recentActivity={[]} />);
    expect(getByText('0/14일')).toBeTruthy();
    await fireEvent.press(getByLabelText(/최근 14일 중 0일 완료/));
    expect(getByText('최근 2주간 완료한 공개 루틴이 없어요.')).toBeTruthy();
  });

  it('미배선이면 스트립 자체를 그리지 않는다', async () => {
    const { queryByText } = await render(<FriendRoomScreen />);
    expect(queryByText('최근 2주')).toBeNull();
  });

  it('첫 탭 후 5초 연타 윈도우 — 연타는 전송 0, 5초 지점에 1회만 (#491)', async () => {
    jest.useFakeTimers();
    const onCheer = jest.fn();
    const { getByText } = await render(<FriendRoomScreen onCheer={onCheer} />);

    // 윈도우 안의 연타는 연출만 — 요청이 나가지 않는다.
    await fireEvent.press(getByText('응원하기'));
    await fireEvent.press(getByText('응원하기'));
    await fireEvent.press(getByText('응원하기'));
    expect(onCheer).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(onCheer).toHaveBeenCalledTimes(1);
    expect(onCheer).toHaveBeenCalledWith('support');
    jest.useRealTimers();
  });

  it('윈도우가 끝나기 전에 나가면 미전송 응원을 flush한다 (#491)', async () => {
    jest.useFakeTimers();
    const onCheer = jest.fn();
    const ui = await render(<FriendRoomScreen onCheer={onCheer} />);
    await fireEvent.press(ui.getByText('응원하기'));
    expect(onCheer).not.toHaveBeenCalled();

    await act(async () => {
      ui.unmount(); // 5초 전 이탈 — 나가면서 전송.
    });
    expect(onCheer).toHaveBeenCalledTimes(1);
    expect(onCheer).toHaveBeenCalledWith('support');
    jest.useRealTimers();
  });

  it('같은 타입 재요청은 확인 모달을 거친다 — 취소는 미전송, 보내기는 전송 (#427)', async () => {
    jest.useFakeTimers();
    const onCheer = jest.fn();
    const { getByText, getByLabelText, queryByText } = await render(
      <FriendRoomScreen onCheer={onCheer} />,
    );

    // 첫 요청은 모달 없이 — 5초 윈도우가 끝나면 전송 (#491).
    await fireEvent.press(getByText('응원하기'));
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(onCheer).toHaveBeenCalledTimes(1);

    // 전송이 끝난 같은 타입 재탭 → 전송 대신 확인 모달.
    await fireEvent.press(getByText('응원하기'));
    expect(onCheer).toHaveBeenCalledTimes(1);
    expect(getByText('오늘은 이미 보낸 응원이에요. 그래도 보낼까요?')).toBeTruthy();

    // 취소 → 닫히고 미전송.
    await fireEvent.press(getByLabelText('응원 다시 보내기 취소'));
    expect(queryByText('응원 다시 보내기')).toBeNull();
    expect(onCheer).toHaveBeenCalledTimes(1);

    // 재탭 → 보내기 확인 → 전송 시도.
    await fireEvent.press(getByText('응원하기'));
    await fireEvent.press(getByLabelText('응원 다시 보내기 확인'));
    expect(onCheer).toHaveBeenCalledTimes(2);
    expect(onCheer).toHaveBeenLastCalledWith('support');
    jest.useRealTimers();
  });

  it('다른 타입 응원은 각자 윈도우로 모달 없이 전송된다 (#427/#491)', async () => {
    jest.useFakeTimers();
    const onCheer = jest.fn();
    const { getByText, queryByText } = await render(<FriendRoomScreen onCheer={onCheer} />);
    await fireEvent.press(getByText('응원하기'));
    await fireEvent.press(getByText('잘하고 있어!'));
    expect(queryByText('오늘은 이미 보낸 응원이에요. 그래도 보낼까요?')).toBeNull();
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(onCheer).toHaveBeenCalledTimes(2);
    expect(onCheer).toHaveBeenCalledWith('support');
    expect(onCheer).toHaveBeenCalledWith('great');
    jest.useRealTimers();
  });

  it('renders the server guestbook and writes through the API callback', async () => {
    const onWriteGuestbook = jest.fn();
    const { getByText, getByLabelText, queryByText } = await render(
      <FriendRoomScreen
        guestbook={[{ id: '1', author: '이웃준서', content: '방 예쁘다!', date: '7월 7일' }]}
        onWriteGuestbook={onWriteGuestbook}
      />,
    );
    expect(getByText('방명록')).toBeTruthy();
    expect(getByText('이웃준서')).toBeTruthy();
    expect(getByText('방 예쁘다!')).toBeTruthy();
    // Server list replaces the demo entries.
    expect(queryByText('기상 인증 대단해요')).toBeNull();

    await fireEvent.changeText(getByLabelText('방명록 입력'), '오늘도 화이팅!');
    await fireEvent.press(getByLabelText('방명록 남기기'));
    expect(onWriteGuestbook).toHaveBeenCalledWith('오늘도 화이팅!');
  });

  it('explains an empty guestbook draft with a toast instead of sending', async () => {
    const onWriteGuestbook = jest.fn();
    const { getByText, getByLabelText } = await render(
      <ToastProvider>
        <FriendRoomScreen guestbook={[]} onWriteGuestbook={onWriteGuestbook} />
      </ToastProvider>,
    );

    await fireEvent.press(getByLabelText('방명록 남기기'));

    expect(getByText('방명록 내용을 입력해주세요')).toBeTruthy();
    expect(onWriteGuestbook).not.toHaveBeenCalled();
  });

  it('shows the empty hint and 더보기 pagination', async () => {
    const onLoadMoreGuestbook = jest.fn();
    const empty = await render(<FriendRoomScreen guestbook={[]} />);
    expect(empty.getByText('아직 방명록이 없어요. 첫 인사를 남겨보세요!')).toBeTruthy();

    const paged = await render(
      <FriendRoomScreen
        guestbook={[{ id: '1', author: 'a', content: 'b', date: 'c' }]}
        guestbookHasNext
        onLoadMoreGuestbook={onLoadMoreGuestbook}
      />,
    );
    await fireEvent.press(paged.getByLabelText('방명록 더보기'));
    expect(onLoadMoreGuestbook).toHaveBeenCalled();
  });

  it('shows the preview notice only while unwired (no routines prop)', async () => {
    const NOTICE = /서버 준비 중이라 미리보기/;
    const preview = await render(<FriendRoomScreen />);
    expect(preview.getByText(NOTICE)).toBeTruthy();

    const live = await render(
      <FriendRoomScreen
        routines={[
          { id: '1', title: '아침 기상', completed: true },
          { id: 'todo-9', title: '장보기', kind: 'todo', completed: false },
        ]}
      />,
    );
    expect(live.queryByText(NOTICE)).toBeNull();
    expect(live.getByText('아침 기상')).toBeTruthy();
    expect(live.getByText('장보기')).toBeTruthy();
    expect(live.getByText('1 / 2')).toBeTruthy();
  });

  it('shows a routine loading state, then an empty hint with no routines today', async () => {
    const loading = await render(<FriendRoomScreen routines={[]} loading />);
    expect(loading.queryByText('오늘 예정된 루틴이 없어요.')).toBeNull();
    expect(loading.queryByText('0 / 0')).toBeNull();

    const empty = await render(<FriendRoomScreen routines={[]} />);
    expect(empty.getByText('오늘 예정된 루틴이 없어요.')).toBeTruthy();
  });

  it('keeps a local demo guestbook when unwired', async () => {
    const { getByText, getByLabelText } = await render(<FriendRoomScreen />);
    expect(getByText('기상 인증 대단해요')).toBeTruthy();
    await fireEvent.changeText(getByLabelText('방명록 입력'), '데모 방명록');
    await fireEvent.press(getByLabelText('방명록 남기기'));
    expect(getByText('데모 방명록')).toBeTruthy();
  });

  // 방문 실패는 빈 방으로 위장하지 않는다 (#549).
  it('로드 실패 시 방 대신 실패 상태 + 다시 시도를 보여준다 (#549)', async () => {
    const onRetry = jest.fn();
    const { getByText, getByLabelText, queryByText } = await render(
      <FriendRoomScreen friendName="민지" loadError onRetry={onRetry} />,
    );

    expect(getByText('친구 방을 불러오지 못했어요')).toBeTruthy();
    // 방·루틴 섹션은 렌더하지 않는다.
    expect(queryByText('민지의 루틴')).toBeNull();
    await fireEvent.press(getByLabelText('다시 시도'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  // 카테고리 그룹핑 (#528, 서버 #237) — 메타가 있으면 본인 화면처럼 그룹으로,
  // 메타에 없는 항목은 미분류로.
  it('카테고리 메타가 있으면 루틴을 그룹 헤더 아래 묶는다', async () => {
    const { getByText, queryByText } = await render(
      <FriendRoomScreen
        friendName="민지"
        routines={[
          { id: '1', title: '아침 기상', kind: 'routine', completed: true, category: '3' },
          { id: '2', title: '비밀 루틴', kind: 'routine', completed: false, category: '99' },
        ]}
        categories={[
          { id: '3', name: '건강', icon: 'dumbbell', color: '#FF8800', visibility: 'neighbor' },
        ]}
      />,
    );
    expect(getByText('건강')).toBeTruthy();
    expect(getByText('1/1')).toBeTruthy(); // 건강 그룹 완료 카운트
    expect(getByText('미분류')).toBeTruthy(); // 메타 없는 categoryId 99
    expect(queryByText('없어요')).toBeNull();
  });

  it('카테고리 메타가 없으면 기존 플랫 목록 그대로다', async () => {
    const { getByText, queryByText } = await render(
      <FriendRoomScreen
        friendName="민지"
        routines={[{ id: '1', title: '아침 기상', kind: 'routine', completed: false }]}
      />,
    );
    expect(getByText('아침 기상')).toBeTruthy();
    expect(queryByText('미분류')).toBeNull();
  });
});

describe('FriendRoomScreen — 멤버 순회 플링 (#644)', () => {
  const fling = (translationX: number) =>
    fireGestureHandler(getByGestureTestId('friend-room-fling'), [
      { state: State.BEGAN },
      { state: State.ACTIVE, translationX: 0 },
      { state: State.ACTIVE, translationX },
      { state: State.END, translationX },
    ]);

  it('방 캔버스 좌우 플링이 방향과 함께 onSwipeFriend를 부른다', async () => {
    const onSwipeFriend = jest.fn();
    await render(<FriendRoomScreen friendName="철수" onSwipeFriend={onSwipeFriend} />);
    fling(-80);
    expect(onSwipeFriend).toHaveBeenCalledWith('left');
    fling(80);
    expect(onSwipeFriend).toHaveBeenCalledWith('right');
    // 임계 미만은 무시.
    onSwipeFriend.mockClear();
    fling(-20);
    expect(onSwipeFriend).not.toHaveBeenCalled();
  });
});
