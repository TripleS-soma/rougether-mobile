import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 온보딩 집 선택 단계의 진행 상태 (#1407) — 계정별 키. `pending`은 "첫 온보딩을 마쳤고 집
 * 선택 화면을 아직 안 지났다"는 뜻이라, 중도 종료해도 다음 실행에 같은 계정이면 재개한다.
 * 기존 사용자(온보딩을 이미 마친 계정)는 이 키가 없어 단계를 보지 않는다. 서버의 선택 결과
 * 자체는 `GET /onboarding/house`가 진실이고, 이 키는 "화면을 보여줄지"만 정한다.
 */
export type OnboardingHouseStep = 'pending' | 'done';

const key = (userId: number) => `rougether.onboarding-house.v1.${userId}`;

export async function loadOnboardingHouseStep(
  userId: number | undefined,
): Promise<OnboardingHouseStep | null> {
  if (userId == null) return null;
  try {
    const raw = await AsyncStorage.getItem(key(userId));
    return raw === 'pending' || raw === 'done' ? raw : null;
  } catch {
    return null;
  }
}

export async function saveOnboardingHouseStep(
  userId: number | undefined,
  step: OnboardingHouseStep,
): Promise<void> {
  if (userId == null) return;
  try {
    await AsyncStorage.setItem(key(userId), step);
  } catch {
    // 저장 실패가 앱 진입을 막지 않는다.
  }
}
