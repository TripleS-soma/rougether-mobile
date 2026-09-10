import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 로그인 전 소개를 이 기기에서 봤는지 (#1282).
 *
 * 로그인 전이라 사용자별 키가 아니라 기기 단위다. 로그아웃은 로컬 데이터를
 * 지우지 않으므로 다시 로그인 화면에 와도 소개가 또 뜨지 않는다. 탈퇴는
 * `wipeLocalAppData`가 `rougether.` 접두를 쓸어 담아 이 기록도 지우므로,
 * 새 계정의 첫 진입처럼 소개부터 다시 본다.
 */
const KEY = 'rougether.intro-seen.v1';

export async function loadIntroSeen(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    // 저장소를 못 읽으면 소개를 한 번 더 보여 주는 편이 낫다 — 소개에는 로그인으로
    // 가는 출구가 늘 있어서 사용자를 가두지 않는다.
    return false;
  }
}

export async function markIntroSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, '1');
  } catch {
    // best-effort — 못 쓰면 다음 진입에 소개가 한 번 더 뜰 뿐이다.
  }
}
