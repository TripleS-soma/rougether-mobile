import type { OnboardingGoal } from '@/components/screens/onboarding-screen';

export type StarterRoutine = {
  id: string;
  title: string;
  goalLabel: string;
  category: string;
};

const GOAL_ROUTINES = {
  exercise: {
    label: '운동',
    category: '건강',
    titles: ['스트레칭 3분', '가볍게 걷기 5분', '어깨 풀기 1분'],
  },
  study: {
    label: '공부',
    category: '공부',
    titles: ['공부한 내용 한 줄 정리하기', '영어 단어 3개 익히기', '책상에서 공부 5분'],
  },
  sleep: {
    label: '수면',
    category: '건강',
    titles: ['자기 전 휴대폰 내려놓기', '자기 전 조명 낮추기', '잠들기 전 천천히 숨 쉬기'],
  },
  reading: {
    label: '독서',
    category: '취미',
    titles: ['책 2쪽 읽기', '마음에 든 문장 하나 적기', '독서 5분'],
  },
  organizing: {
    label: '정리',
    category: '일정',
    titles: ['책상 위 물건 3개 정리하기', '입은 옷 제자리에 두기', '가방 속 물건 정리하기'],
  },
  career: {
    label: '취업 준비',
    category: '공부',
    titles: ['관심 공고 하나 살펴보기', '오늘 배운 것 한 줄 적기', '면접 질문 하나 생각해보기'],
  },
  habit: {
    label: '생활 습관',
    category: '건강',
    titles: ['물 한 잔 마시기', '창문 열어 환기하기', '오늘 좋았던 일 하나 적기'],
  },
} as const;

type GoalCode = keyof typeof GOAL_ROUTINES;

/** Match stable master codes; labels also support cached legacy survey choices. */
function goalCode(goal: OnboardingGoal): GoalCode | undefined {
  const code = (goal.code ?? goal.id).toLowerCase();
  if (Object.hasOwn(GOAL_ROUTINES, code)) return code as GoalCode;
  return (Object.keys(GOAL_ROUTINES) as GoalCode[]).find(
    (key) => GOAL_ROUTINES[key].label === goal.label,
  );
}

/** Round-robin prevents the first interest from occupying all three cards. */
export function recommendStarterRoutines(goals: OnboardingGoal[]): StarterRoutine[] {
  const codes = [...new Set(goals.map(goalCode).filter((code): code is GoalCode => !!code))];
  const matched = codes.length > 0;
  if (!matched) codes.push('habit');
  const result: StarterRoutine[] = [];
  for (let rank = 0; rank < 3; rank += 1) {
    for (const code of codes) {
      const group = GOAL_ROUTINES[code];
      result.push({
        id: `${code}-${rank + 1}`,
        title: group.titles[rank],
        category: group.category,
        goalLabel: matched ? group.label : '가볍게 시작하기',
      });
      if (result.length === 3) return result;
    }
  }
  return result;
}
