import { render } from '@testing-library/react-native';

import { WeeklyReportScreen } from '@/components/screens/weekly-report-screen';
import type { WeeklyReportDetailResponse } from '@/api/types';

const REPORT: WeeklyReportDetailResponse = {
  reportId: 2,
  weekStartDate: '2026-08-09',
  weekEndDate: '2026-08-15',
  status: 'GENERATED',
  completionRate: 0.36,
  completedCount: 14,
  scheduledCount: 39,
  summary: '주중은 잘 지켰고 주말에 흐름이 끊겼어요.',
  highlights: ['월~수 아침 스트레칭 3일 연속'],
  failurePatterns: ['주말 루틴을 대부분 놓쳤어요'],
  suggestions: ['주말 루틴 개수를 줄여보세요'],
  stats: {
    // 일부러 일요일이 아닌 요일부터, 순서를 섞어서 준다 — 화면이 서버 순서를
    // 따라가면 안 된다.
    byWeekday: [
      { dayOfWeek: 'WEDNESDAY', completed: 4, failed: 1 },
      { dayOfWeek: 'SUNDAY', completed: 0, failed: 7 },
      { dayOfWeek: 'MONDAY', completed: 4, failed: 1 },
    ],
    byRoutine: [
      { lineageId: 1, title: '독서 30분', categoryName: '자기계발', completed: 2, failed: 5 },
      { lineageId: 2, title: '아침 스트레칭', categoryName: '건강', completed: 6, failed: 1 },
    ],
    streak: { currentCount: 3, longestCount: 6 },
  },
};

describe('WeeklyReportScreen', () => {
  it('완료율을 퍼센트 한 줄로 앞세우고 기간·연속일수를 함께 보여준다', async () => {
    const { getByText } = await render(<WeeklyReportScreen report={REPORT} />);
    expect(getByText('36%')).toBeTruthy();
    expect(getByText('8월 9일 ~ 8월 15일')).toBeTruthy();
    expect(getByText(/예정 39개 중 14개 완료/)).toBeTruthy();
    expect(getByText(/연속 3일 · 최장 6일/)).toBeTruthy();
  });

  /**
   * 막대는 채움색 대비가 3:1 미만이라 색만으로 값을 읽을 수 없다 — 칸마다
   * `완료/전체` 숫자가 **반드시** 함께 있어야 한다. 라벨을 지우는 회귀를 막는다.
   */
  it('요일 막대마다 완료/전체 숫자를 눈에 보이게 붙인다', async () => {
    const { getByText, getAllByText, getByLabelText } = await render(
      <WeeklyReportScreen report={REPORT} />,
    );
    // 눈에 보이는 숫자 — 이게 없으면 값은 색으로만 남는다(대비 3:1 미만).
    expect(getByText('0/7')).toBeTruthy();
    // 월·수 둘 다 4/1이라 같은 값이 두 칸에 나온다.
    expect(getAllByText('4/5')).toHaveLength(2);
    // 서버가 안 준 요일(화·목·금·토)은 0/0이 아니라 '—'.
    expect(getAllByText('—')).toHaveLength(4);
    // 스크린리더에도 같은 값이 간다.
    expect(getByLabelText('일요일 7개 중 0개 완료')).toBeTruthy();
    expect(getByLabelText('토요일 예정 없음')).toBeTruthy();
  });

  it('요일을 서버 배열 순서가 아니라 일~토 순으로 세운다', async () => {
    const { getAllByText } = await render(<WeeklyReportScreen report={REPORT} />);
    // 서버는 수·일·월 3개만 섞어서 줬다 — 화면은 7칸을 일~토로 세워야 한다.
    const rendered = getAllByText(/^[일월화수목금토]$/).map((n) => n.children[0]);
    expect(rendered).toEqual(['일', '월', '화', '수', '목', '금', '토']);
  });

  it('루틴은 완료 많은 순으로 정렬한다', async () => {
    const { getByText, getAllByText } = await render(<WeeklyReportScreen report={REPORT} />);
    expect(getByText('아침 스트레칭')).toBeTruthy();
    expect(getByText('독서 30분')).toBeTruthy();
    expect(getAllByText('6/7')).toBeTruthy();
  });

  it('GENERATED면 LLM 본문 세 섹션을 보여준다', async () => {
    const { getByText } = await render(<WeeklyReportScreen report={REPORT} />);
    expect(getByText('잘한 점')).toBeTruthy();
    expect(getByText('아쉬운 점')).toBeTruthy();
    expect(getByText('다음 주 제안')).toBeTruthy();
    expect(getByText('주말 루틴을 대부분 놓쳤어요')).toBeTruthy();
  });

  /**
   * FALLBACK = LLM 생성 실패라 본문이 비어 온다. 빈 제목만 늘어놓지 말고
   * 접은 뒤 이유를 밝혀야 한다.
   */
  it('FALLBACK이면 본문 섹션을 접고 이유를 알린다', async () => {
    const { queryByText, getByText } = await render(
      <WeeklyReportScreen
        report={{ ...REPORT, status: 'FALLBACK', highlights: [], failurePatterns: [] }}
      />,
    );
    expect(queryByText('잘한 점')).toBeNull();
    expect(queryByText('다음 주 제안')).toBeNull();
    expect(getByText(/통계만 보여드려요/)).toBeTruthy();
    // 통계는 그대로 남아야 한다.
    expect(getByText('36%')).toBeTruthy();
  });

  it('아직 회고가 없으면 통계 자리를 비워둔다', async () => {
    const { queryByText } = await render(<WeeklyReportScreen report={null} />);
    expect(queryByText('요일별')).toBeNull();
  });
});
