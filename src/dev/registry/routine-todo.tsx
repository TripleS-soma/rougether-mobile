import { useState } from 'react';
import { View } from 'react-native';
import { AddRoutineScreen } from '@/components/screens/add-routine-screen';
import { CategoryManageScreen } from '@/components/screens/category-manage-screen';
import { CalendarImportScreen } from '@/components/screens/calendar-import-screen';
import { RoutineManageScreen } from '@/components/screens/routine-manage-screen';
import { CalendarDepthPreview } from '@/dev/calendar-depth-preview';
import { TodoComposePreview } from '@/dev/todo-compose-preview';
import { RecommendationSection } from '@/components/screens/my-room/recommendation-section';
import { WeeklyReportPanel } from '@/components/screens/my-room/weekly-report-panel';
import { WeeklyReportScreen } from '@/components/screens/weekly-report-screen';
import type { Recommendation } from '@/api';
import { SAMPLE_ROUTINES } from '@/constants/routines';
import type { GalleryEntry } from '@/dev/registry/types';

/** 조정 추천 섹션 데모 (#1006) — 적용/무시로 카드가 실제로 빠지는 걸 본다. */
function RecommendationSectionDemo() {
  const [items, setItems] = useState<Recommendation[]>([
    {
      recommendationId: 1,
      type: 'ADJUST_DAYS',
      message:
        '『아침 러닝』 수요일 수행이 3주 연속 실패했어요. 수요일을 빼고 나머지 요일에 집중해 보면 어떨까요?',
      routineId: 42,
      originRoutineId: 42,
      routineTitle: '아침 러닝',
      proposal: { repeatType: 'WEEKLY', daysOfWeek: ['MON', 'FRI'] },
      expiresAt: '2026-09-05T00:00:00',
    },
    {
      recommendationId: 2,
      type: 'ADJUST_DAYS',
      message:
        '『독서 30분』이 2주째 완료율 40% 아래예요. 잘 지켜지는 요일 3개로 줄여보면 어떨까요?',
      routineId: 77,
      routineTitle: '독서 30분',
      proposal: { repeatType: 'WEEKLY', daysOfWeek: ['TUE', 'THU', 'SAT'] },
      expiresAt: '2026-08-31T00:00:00',
    },
  ]);
  const remove = (id: number) => setItems((prev) => prev.filter((r) => r.recommendationId !== id));
  return (
    <RecommendationSection
      items={items}
      onAccept={remove}
      onDismiss={remove}
      // 42는 월·수·금 루틴 — 카드가 '월 수 금 → 월 금'을 그린다.
      currentDaysById={{ 42: [1, 3, 5] }}
      now={new Date('2026-08-31T09:00:00')}
    />
  );
}

export const routineTodoEntries: GalleryEntry[] = [
  {
    name: 'CalendarImportScreen',
    description:
      '내 정보 → 캘린더 연동 (#844 → #1097): 캘린더 선택 → 미리보기 → 선택 임포트. 비슷한 루틴이 있는 항목은 기본 해제.',
    render: () => (
      <View style={{ alignSelf: 'stretch', height: 720 }}>
        <CalendarImportScreen
          calendars={[
            { id: 'c1', title: '개인', source: 'Google' },
            { id: 'c2', title: '대한민국 공휴일', source: 'Holidays' },
          ]}
          candidates={[
            {
              seriesId: 'e1',
              occurrenceId: 'e1:2026-08-20',
              title: '치과 예약',
              date: '2026-08-20',
              allDay: false,
              similar: [],
            },
            {
              seriesId: 'e2',
              occurrenceId: 'e2:2026-08-21',
              title: '영양제 먹기',
              date: '2026-08-21',
              allDay: false,
              similar: [
                { kind: 'ROUTINE', id: 21, title: '영양제 챙겨먹기', score: 0.86, matchType: 'EMBEDDING' }, // prettier-ignore
              ],
            },
            {
              seriesId: 'e3',
              occurrenceId: 'e3:2026-08-22',
              title: '팀 회식',
              date: '2026-08-22',
              allDay: false,
              similar: [],
            },
          ]}
          onBack={() => {}}
          onConnect={() => {}}
          onPreview={() => {}}
          onImport={() => {}}
        />
      </View>
    ),
  },
  {
    name: 'RoutineManageScreen',
    description: 'Ported from the prototype RoutineManageScreen (#6). Sample routines.',
    render: () => (
      <View style={{ height: 640, alignSelf: 'stretch' }}>
        <RoutineManageScreen routines={SAMPLE_ROUTINES} />
      </View>
    ),
  },
  {
    name: 'AddRoutineScreen',
    description: 'Ported from the prototype AddRoutineScreen (#5, add mode; sheets deferred).',
    render: () => (
      <View style={{ height: 760, alignSelf: 'stretch' }}>
        <AddRoutineScreen />
      </View>
    ),
  },
  {
    name: 'CategoryManageScreen',
    description: '카테고리 관리 독립 화면 (#394) — 목록(순서·수정·삭제) + 헤더 +로 생성 시트.',
    render: () => (
      <View style={{ height: 640, alignSelf: 'stretch' }}>
        <CategoryManageScreen onReorder={() => {}} />
      </View>
    ),
  },
  {
    name: 'WeeklyReportScreen · 주간회고 화면',
    description:
      '내 정보 > 주간회고 다시 보기 / 새 회고 배너 목적지 (#1056 → #1088). 나의 방 탭에서 빠진 패널을 헤더 달린 화면으로.',
    render: () => (
      <View style={{ height: 520 }}>
        <WeeklyReportScreen
          report={{
            reportId: 1,
            weekStartDate: '2026-08-24',
            weekEndDate: '2026-08-30',
            completionRate: 80,
            completedCount: 8,
            scheduledCount: 10,
            summary: '지난주엔 아침 루틴을 잘 지켰어요. 운동은 주중에 두 번 빠졌네요.',
          }}
          onBack={() => {}}
        />
      </View>
    ),
  },
  {
    name: 'WeeklyReportPanel',
    description:
      '나의 방 주간회고 탭 본문 — 완료율 + 요일별·루틴별 비율 막대 + LLM 본문 (#852·#856).',
    render: () => (
      <View style={{ alignSelf: 'stretch', height: 640 }}>
        <WeeklyReportPanel
          report={{
            reportId: 1,
            weekStartDate: '2026-08-09',
            weekEndDate: '2026-08-15',
            status: 'GENERATED',
            completionRate: 0.36,
            completedCount: 14,
            scheduledCount: 39,
            summary: '이번 주는 주중 아침 루틴이 잘 붙었고, 주말에 흐름이 끊겼어요.',
            highlights: [
              '월~수 아침 스트레칭을 3일 연속 지켰어요.',
              '독서는 목표의 80%를 채웠어요.',
            ],
            failurePatterns: ['주말(토·일)에 예정된 루틴을 대부분 놓쳤어요.'],
            suggestions: ['주말 루틴 개수를 절반으로 줄여보는 건 어때요?'],
            stats: {
              byWeekday: [
                { dayOfWeek: 'SUNDAY', completed: 0, failed: 7 },
                { dayOfWeek: 'MONDAY', completed: 4, failed: 1 },
                { dayOfWeek: 'TUESDAY', completed: 3, failed: 2 },
                { dayOfWeek: 'WEDNESDAY', completed: 4, failed: 1 },
                { dayOfWeek: 'THURSDAY', completed: 2, failed: 3 },
                { dayOfWeek: 'FRIDAY', completed: 1, failed: 4 },
                { dayOfWeek: 'SATURDAY', completed: 0, failed: 7 },
              ],
              byRoutine: [
                {
                  lineageId: 1,
                  title: '아침 스트레칭',
                  categoryName: '건강',
                  completed: 5,
                  failed: 2,
                },
                {
                  lineageId: 2,
                  title: '독서 30분',
                  categoryName: '자기계발',
                  completed: 4,
                  failed: 3,
                },
                {
                  lineageId: 3,
                  title: '물 2L 마시기',
                  categoryName: '건강',
                  completed: 5,
                  failed: 2,
                },
              ],
              streak: { currentCount: 3, longestCount: 6 },
            },
          }}
        />
      </View>
    ),
  },
  {
    name: 'RecommendationSection',
    description:
      'AI 조정 추천 카드 (#1006) — 주간회고 탭 하단. 적용하기는 확인 다이얼로그를 한 번 거친다.',
    render: () => <RecommendationSectionDemo />,
  },
  {
    name: 'CalendarDepth',
    description: '월·선택일 목록과 루틴/할 일 공통 작성을 확인한다 (#1279).',
    render: () => <CalendarDepthPreview />,
  },
  {
    name: 'RoutineTodoComposeSheet',
    description: '카테고리 이동 없이 제목부터 입력하는 투두 빠른 추가 (#1272).',
    render: () => <TodoComposePreview />,
  },
];
