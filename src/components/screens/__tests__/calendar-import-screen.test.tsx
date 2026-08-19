import { fireEvent, render } from '@testing-library/react-native';

import { CalendarImportScreen } from '@/components/screens/calendar-import-screen';
import type { ImportCandidate } from '@/hooks/use-calendar-import';

const CALS = [
  { id: 'c1', title: '개인', source: 'Google' },
  { id: 'c2', title: '대한민국 공휴일', source: 'Holidays' },
];

const CANDIDATES: ImportCandidate[] = [
  { id: 'e1', title: '치과 예약', date: '2026-08-20', allDay: false, similar: [] },
  {
    id: 'e2',
    title: '영양제 먹기',
    date: '2026-08-21',
    allDay: false,
    similar: [
      { kind: 'ROUTINE', id: 21, title: '영양제 챙겨먹기', score: 0.86, matchType: 'EMBEDDING' },
    ],
  },
];

describe('CalendarImportScreen', () => {
  it('연결 전에는 연결 버튼만 보여준다', async () => {
    const onConnect = jest.fn();
    const { getByText } = await render(<CalendarImportScreen onConnect={onConnect} />);
    await fireEvent.press(getByText('캘린더 연결하기'));
    expect(onConnect).toHaveBeenCalled();
  });

  it('권한이 거부되면 기기 설정 안내를 보여준다', async () => {
    const { getByText } = await render(<CalendarImportScreen calendars={[]} denied />);
    expect(getByText(/기기 설정에서 루게더의 캘린더 권한을 켜주세요/)).toBeTruthy();
  });

  it('캘린더를 골라야 불러오기가 열린다', async () => {
    const onPreview = jest.fn();
    const { getByText, getByLabelText } = await render(
      <CalendarImportScreen calendars={CALS} onPreview={onPreview} />,
    );
    // 아무것도 안 고르면 눌러도 안 나간다.
    await fireEvent.press(getByText('일정 불러오기'));
    expect(onPreview).not.toHaveBeenCalled();

    await fireEvent.press(getByLabelText('캘린더 개인'));
    await fireEvent.press(getByText('일정 불러오기'));
    expect(onPreview).toHaveBeenCalledWith(['c1']);
  });

  /**
   * 캘린더엔 공휴일·회의가 섞여 있고 서버가 **지운 조합을 재등록해주지
   * 않으므로**, 비슷한 게 이미 있는 항목은 기본 해제해 실수로 가져오는 걸
   * 막는다 (#844).
   */
  it('비슷한 항목이 있으면 기본 해제하고 그 이유를 보여준다 (#844)', async () => {
    const onImport = jest.fn();
    const { getByText, getByLabelText } = await render(
      <CalendarImportScreen calendars={CALS} candidates={CANDIDATES} onImport={onImport} />,
    );
    // 2개 중 1개만 기본 선택.
    expect(getByText('가져올 일정 (1/2)')).toBeTruthy();
    expect(getByText(/비슷한 루틴이 있어요 · 영양제 챙겨먹기/)).toBeTruthy();
    expect(getByLabelText('영양제 먹기, 8월 21일, 비슷한 항목 있음')).toBeTruthy();

    await fireEvent.press(getByText('1개 가져오기'));
    expect(onImport).toHaveBeenCalledWith([expect.objectContaining({ id: 'e1' })]);
  });

  it('기본 해제된 항목도 눌러서 포함할 수 있다', async () => {
    const onImport = jest.fn();
    const { getByText, getByLabelText } = await render(
      <CalendarImportScreen calendars={CALS} candidates={CANDIDATES} onImport={onImport} />,
    );
    await fireEvent.press(getByLabelText('영양제 먹기, 8월 21일, 비슷한 항목 있음'));
    expect(getByText('가져올 일정 (2/2)')).toBeTruthy();
    await fireEvent.press(getByText('2개 가져오기'));
    expect(onImport.mock.calls[0][0]).toHaveLength(2);
  });

  it('가져올 일정이 없으면 그렇게 말한다', async () => {
    const { getByText } = await render(<CalendarImportScreen calendars={CALS} candidates={[]} />);
    expect(getByText(/앞으로 30일 안에 가져올 일정이 없어요/)).toBeTruthy();
  });

  /** 임베딩이 죽어도 임포트는 계속된다 — 힌트가 덜 똑똑해진 것만 밝힌다. */
  it('임베딩을 못 쓰면 겹침 판정이 제한적이라고 알린다', async () => {
    const { getByText } = await render(
      <CalendarImportScreen calendars={CALS} candidates={CANDIDATES} embeddingApplied={false} />,
    );
    expect(getByText(/제목이 똑같은 것만 겹침으로 표시돼요/)).toBeTruthy();
  });
});
