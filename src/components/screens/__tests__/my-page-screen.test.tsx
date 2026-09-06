import { fireEvent, render } from '@testing-library/react-native';

import { MyPageScreen } from '@/components/screens/my-page-screen';

// 마이페이지 탭 (#1088) — 프로필 카드·지표·행과 헤더 톱니(설정 진입).
describe('MyPageScreen', () => {
  it('프로필 카드에 닉네임·소개를 그리고, 소개가 없으면 안내 문구를 둔다', async () => {
    const { getByText, rerender } = await render(
      <MyPageScreen nickname="준서" bio="매일 조금씩" />,
    );
    expect(getByText('마이페이지')).toBeTruthy();
    expect(getByText('준서')).toBeTruthy();
    expect(getByText('매일 조금씩')).toBeTruthy();

    await rerender(<MyPageScreen nickname="준서" bio="" />);
    expect(getByText('한 줄 소개를 적어보세요')).toBeTruthy();
  });

  it('지표 한 줄 — 스트릭·코인·다이아를 천 단위 구분으로 읽어 준다', async () => {
    const { getByLabelText } = await render(
      <MyPageScreen streakDays={12} coinBalance={1240} diamondBalance={3} />,
    );
    expect(getByLabelText('연속 12일')).toBeTruthy();
    expect(getByLabelText('코인 1,240')).toBeTruthy();
    expect(getByLabelText('다이아 3')).toBeTruthy();
  });

  it('헤더 우측 톱니가 설정을 연다 — 설정은 목록 행이 아니다', async () => {
    const onOpenSettings = jest.fn();
    const { getByLabelText, queryByText } = await render(
      <MyPageScreen onOpenSettings={onOpenSettings} />,
    );
    // 설정 화면 고유 행이 마이페이지에 새어 나오지 않는다.
    expect(queryByText('다크 모드')).toBeNull();
    expect(queryByText('로그아웃')).toBeNull();
    await fireEvent.press(getByLabelText('설정'));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('프로필 편집·주간회고·친구 초대·도움말·버그 제보가 각자의 콜백을 부른다', async () => {
    const onEditProfile = jest.fn();
    const onOpenWeeklyReport = jest.fn();
    const onInviteFriends = jest.fn();
    const onOpenHelp = jest.fn();
    const onReportBug = jest.fn();
    const { getByText, getByLabelText } = await render(
      <MyPageScreen
        onEditProfile={onEditProfile}
        onOpenWeeklyReport={onOpenWeeklyReport}
        onInviteFriends={onInviteFriends}
        onOpenHelp={onOpenHelp}
        onReportBug={onReportBug}
      />,
    );
    await fireEvent.press(getByLabelText('프로필 편집'));
    await fireEvent.press(getByText('주간회고 다시 보기'));
    await fireEvent.press(getByText('친구 초대'));
    await fireEvent.press(getByText('도움말'));
    await fireEvent.press(getByText('버그 제보'));
    expect(onEditProfile).toHaveBeenCalledTimes(1);
    expect(onOpenWeeklyReport).toHaveBeenCalledTimes(1);
    expect(onInviteFriends).toHaveBeenCalledTimes(1);
    expect(onOpenHelp).toHaveBeenCalledTimes(1);
    expect(onReportBug).toHaveBeenCalledTimes(1);
  });
});
