import { fireEvent, render } from '@testing-library/react-native';

import { ActivityStrip } from '@/components/screens/house/activity-strip';
import { shiftIso } from '@/utils/datetime';

const TODAY = '2026-08-17';
const day = (offset: number, titles: string[]) => ({
  date: shiftIso(TODAY, offset),
  label: `${offset}일 전`,
  titles,
});

describe('ActivityStrip', () => {
  it('완료한 날 수를 14일 축 기준으로 센다', async () => {
    const { getByText } = await render(
      <ActivityStrip today={TODAY} days={[day(0, ['기상']), day(-6, ['독서'])]} />,
    );
    expect(getByText('2/14일')).toBeTruthy();
  });

  /**
   * 축 경계 — 13일 전은 안, 14일 전은 밖. 서버가 범위 밖 기록을 섞어 보내도
   * 분모·분자가 흔들리면 안 된다.
   */
  it('13일 전은 축 안, 14일 전은 축 밖이다', async () => {
    const inside = await render(<ActivityStrip today={TODAY} days={[day(-13, ['기상'])]} />);
    expect(inside.getByText('1/14일')).toBeTruthy();

    const outside = await render(<ActivityStrip today={TODAY} days={[day(-14, ['기상'])]} />);
    expect(outside.getByText('0/14일')).toBeTruthy();
  });

  /** 제목이 빈 날은 "완료한 날"이 아니다 — 채운 점으로 세면 거짓말이 된다. */
  it('제목이 빈 날은 세지 않는다', async () => {
    const { getByText } = await render(
      <ActivityStrip today={TODAY} days={[day(0, []), day(-1, ['기상'])]} />,
    );
    expect(getByText('1/14일')).toBeTruthy();
  });

  it('월 경계를 넘어가도 축이 어긋나지 않는다', async () => {
    // 9월 2일 기준 14일 축은 8월 20일까지 거슬러 간다.
    const { getByText } = await render(
      <ActivityStrip
        today="2026-09-02"
        days={[
          { date: '2026-08-20', label: '8월 20일', titles: ['기상'] },
          { date: '2026-08-19', label: '8월 19일', titles: ['기상'] },
        ]}
      />,
    );
    // 8월 20일은 축 안(13일 전), 19일은 밖(14일 전).
    expect(getByText('1/14일')).toBeTruthy();
  });

  it('접힘이 기본이고 펼치면 최신순으로 상세를 보여준다', async () => {
    const days = [day(-2, ['독서']), day(0, ['기상', '물'])];
    const collapsed = await render(<ActivityStrip today={TODAY} days={days} />);
    expect(collapsed.queryByText('기상 · 물')).toBeNull();

    const open = await render(<ActivityStrip today={TODAY} days={days} expanded />);
    const rows = open.getAllByText(/일 전$/).map((n) => n.children[0]);
    // 오늘(0일 전)이 먼저, 그다음 2일 전.
    expect(rows).toEqual(['0일 전', '-2일 전']);
  });

  /** onToggle 미전달이어도 눌러서 터지면 안 된다(읽기 전용 배치 대비). */
  it('onToggle이 없어도 눌렀을 때 터지지 않는다', async () => {
    const { getByLabelText } = await render(
      <ActivityStrip today={TODAY} days={[day(0, ['기상'])]} />,
    );
    expect(() => fireEvent.press(getByLabelText(/최근 14일 중 1일 완료/))).not.toThrow();
  });
});
