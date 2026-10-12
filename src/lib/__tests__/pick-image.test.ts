import { pickLibraryImages } from '@/lib/pick-image';

/**
 * 사진 고르기 (#496·#1409). `expo-image-picker`를 **동적 import**로 불러오는데, jest(CommonJS)는
 * `--experimental-vm-modules` 없이는 소스 안의 `import()`를 실행하지 못한다(TypeError). 그래서
 * 피커까지 가는 경로는 지금 설정으로는 단위 테스트가 불가능하다 — 동적 import 앞에서 끝나는
 * 가드만 확인하고 나머지는 todo로 남긴다. 소스를 `require`로 바꾸거나 테스트 변환에
 * dynamic-import 플러그인을 넣으면 풀린다(동작 변경이라 이 테스트 PR 범위 밖).
 */
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

describe('pickLibraryImages', () => {
  it('limit이 0 이하면 피커 모듈을 불러오지도 않고 빈 배열', async () => {
    const picker = jest.requireMock<Record<string, jest.Mock>>('expo-image-picker');
    await expect(pickLibraryImages(0)).resolves.toEqual([]);
    await expect(pickLibraryImages(-1)).resolves.toEqual([]);
    expect(picker.requestMediaLibraryPermissionsAsync).not.toHaveBeenCalled();
  });

  it.todo('권한 거부·취소면 빈 배열 (동적 import 때문에 jest에서 실행 불가)');
  it.todo('플랫폼이 한도보다 많이 돌려줘도 limit장만 자르고, 기본 이름은 photo-N.jpg');
  it.todo('allowsMultipleSelection은 limit > 1일 때만');
});

describe('pickLibraryImage', () => {
  it.todo('권한 거부·취소면 null, 이름·형식이 없으면 screenshot.jpg / image/jpeg');
});
