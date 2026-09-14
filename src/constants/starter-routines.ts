import type { OnboardingGoal } from '@/components/screens/onboarding-screen';
import { i18n } from '@/i18n';

export type StarterRoutine = {
  id: string;
  title: string;
  goalLabel: string;
  category: string;
};

/**
 * 관심사별 첫 루틴 카탈로그. `label`은 옛 설문 캐시(한국어 라벨로 저장된 선택)와 대조하는
 * **매칭 키**라 한국어 원문을 유지하고, `category`는 서버 카테고리 이름과 대조하는 키라
 * 번역하지 않는다. 화면에 보이는 제목·목표 라벨은 `i18n.t()`로 호출 시점에 읽는다 (#893).
 */
const GOAL_ROUTINES = {
  exercise: { label: '운동', category: '건강' },
  study: { label: '공부', category: '공부' },
  sleep: { label: '수면', category: '건강' },
  reading: { label: '독서', category: '취미' },
  organizing: { label: '정리', category: '일정' },
  career: { label: '취업 준비', category: '공부' },
  habit: { label: '생활 습관', category: '건강' },
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
        title: i18n.t(`member.starterRoutine.goals.${code}.titles.${rank}`),
        category: group.category,
        goalLabel: matched
          ? i18n.t(`member.starterRoutine.goals.${code}.label`)
          : i18n.t('member.starterRoutine.lightStart'),
      });
      if (result.length === 3) return result;
    }
  }
  return result;
}
