import AsyncStorage from '@react-native-async-storage/async-storage';

import { loadOnboardingHouseStep, saveOnboardingHouseStep } from '@/lib/onboarding-house-store';

/**
 * 온보딩 집 선택 단계 (#1407) — 계정별 키. 기기 단위 키는 새 계정이 온보딩을 건너뛰게
 * 만들었다(#1298). 계정 A의 진행 상태가 B에게 보이면 안 된다.
 */
const A = 31;
const B = 32;

afterEach(() => jest.restoreAllMocks());

describe('onboarding-house-store', () => {
  it('저장한 단계를 같은 계정으로 다시 읽는다', async () => {
    await saveOnboardingHouseStep(A, 'pending');
    await expect(loadOnboardingHouseStep(A)).resolves.toBe('pending');
    await saveOnboardingHouseStep(A, 'done');
    await expect(loadOnboardingHouseStep(A)).resolves.toBe('done');
  });

  it('계정 A의 단계는 계정 B에게 보이지 않는다', async () => {
    await saveOnboardingHouseStep(A, 'done');
    await expect(loadOnboardingHouseStep(B)).resolves.toBeNull();
  });

  it('userId가 없으면 읽지도 쓰지도 않는다', async () => {
    const setItem = jest.spyOn(AsyncStorage, 'setItem');
    const getItem = jest.spyOn(AsyncStorage, 'getItem');
    await saveOnboardingHouseStep(undefined, 'pending');
    await expect(loadOnboardingHouseStep(undefined)).resolves.toBeNull();
    expect(setItem).not.toHaveBeenCalled();
    expect(getItem).not.toHaveBeenCalled();
    await expect(AsyncStorage.getAllKeys()).resolves.toEqual([]);
  });

  it('userId 0도 유효한 계정으로 다룬다 (falsy 가드가 아니다)', async () => {
    await saveOnboardingHouseStep(0, 'pending');
    await expect(loadOnboardingHouseStep(0)).resolves.toBe('pending');
  });

  it('알 수 없는 저장값은 null로 폴백한다', async () => {
    await AsyncStorage.setItem(`rougether.onboarding-house.v1.${A}`, 'PENDING');
    await expect(loadOnboardingHouseStep(A)).resolves.toBeNull();
  });

  it('저장소 읽기·쓰기 실패를 던지지 않는다', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('disk'));
    await expect(loadOnboardingHouseStep(A)).resolves.toBeNull();
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('full'));
    await expect(saveOnboardingHouseStep(A, 'done')).resolves.toBeUndefined();
  });
});
