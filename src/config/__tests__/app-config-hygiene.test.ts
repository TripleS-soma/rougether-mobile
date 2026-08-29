/**
 * @jest-environment node
 *
 * app.json 위생 — 네이티브 설정은 **빌드해야 드러나는 실수**가 많아, 여기서
 * 미리 막는다.
 *
 * ## 왜 이 파일이 생겼나 (#913)
 *
 * "안 쓰는 권한은 선언하지 말자"며 `expo-calendar`가 넣는 미리알림 권한 문구와
 * 안드로이드 `WRITE_CALENDAR`를 걷어내는 config plugin을 만들었다. 의도는
 * 맞았지만 **라이브러리가 그 존재를 전제로 동작한다**:
 *
 * - **iOS**: 모듈의 `OnCreate`(앱 시작)가 `initializePermittedEntities()`를
 *   부르고, 그게 미리알림 권한을 조회한다. 키가 없으면
 *   `RCTFatal(MissingCalendarPListValueException)` — **스플래시에서 앱이 죽는다.**
 *   1.2.0 빌드 47이 실제로 그랬다.
 * - **Android**: `checkPermissions()`가 `READ_CALENDAR`와 `WRITE_CALENDAR`를
 *   **둘 다** 요구한다. WRITE를 빼면 권한이 영영 안 떨어져 기능이 죽는다.
 *
 * **이 파일은 입력(app.json)만 본다.** 산출물(Info.plist)은
 * `scripts/check-ios-plist.mjs`가 본다 (#915) — config plugin이 prebuild 때
 * 키를 지우는 경우는 여기서 못 잡기 때문이다. 둘 다 있어야 그물이 닫힌다.
 *
 * 그래서 이 키들은 "안 써도 선언해야 하는" 것이다. 실제로 쓰지 않는다는 사실은
 * 권한 문구·스토어 설명·개인정보처리방침이 말한다(코드가 아니라 문서의 몫).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import appJson from '../../../app.json';

type PluginEntry = string | [string, Record<string, unknown>?];

const plugins = appJson.expo.plugins as PluginEntry[];
const entryFor = (name: string) =>
  plugins.find((p) => (Array.isArray(p) ? p[0] === name : p === name)) as
    [string, Record<string, unknown>] | undefined;

describe('app.json 네이티브 설정 위생 (#913)', () => {
  const calendar = entryFor('expo-calendar');

  it('expo-calendar가 등록돼 있다', () => {
    expect(calendar).toBeDefined();
  });

  /**
   * 미리알림 문구를 지우면 iOS가 시작하자마자 죽는다 — 안 쓰는 권한이라도
   * 키는 있어야 한다.
   */
  it('미리알림 권한 문구를 반드시 채운다 — 지우면 앱이 시작에서 죽는다', () => {
    const opts = calendar?.[1] ?? {};
    expect(typeof opts.remindersPermission).toBe('string');
    expect(String(opts.remindersPermission).length).toBeGreaterThan(0);
  });

  it('캘린더 권한 문구도 한국어로 채운다', () => {
    const opts = calendar?.[1] ?? {};
    expect(typeof opts.calendarPermission).toBe('string');
    expect(String(opts.calendarPermission)).toMatch(/[가-힣]/);
  });

  /**
   * 권한을 걷어내는 플러그인이 다시 생기면 같은 사고가 반복된다.
   * 필요해지면 이 테스트부터 고치면서 위 주석을 읽게 된다.
   */
  it('캘린더 권한을 걷어내는 플러그인을 두지 않는다', () => {
    const names = plugins.map((p) => (Array.isArray(p) ? p[0] : p));
    expect(names.filter((n) => /calendar-readonly/.test(n))).toEqual([]);
  });
});

/**
 * 네이티브 설정 키가 **app.json과 JS 양쪽에** 적혀 있는 것들 (#1015).
 *
 * 소스를 텍스트로 읽는 이유: 그 모듈들은 네이티브 SDK를 import해서 jest에서
 * 못 불러온다. `font-hygiene.test.ts`와 같은 방식이다.
 *
 * ## 왜 이 검사가 필요한가
 *
 * 같은 값이 두 곳에 있는 것 자체보다, **두 곳의 배포 경로가 다른 게** 문제다.
 * `app.json`은 네이티브 지문 입력이라 바꾸면 새 빌드가 필요하고, JS는 OTA로
 * 나간다. 한쪽만 고치면:
 *
 * - JS만 → OTA는 나가는데 **네이티브 SDK는 옛 키로 초기화**된다
 * - app.json만 → 새 빌드가 깔리기 전까지 **JS는 옛 키**를 쓴다
 *
 * 어느 쪽이든 빌드는 성공하고 테스트도 통과하는데 사용자만 로그인이 안 된다.
 * 2026-08-22 안드로이드 로그인 전건 실패(#960·#962)가 정확히 "설정이 두 군데
 * 있고 한쪽만 맞았다"였다.
 *
 * 근본 수정은 `app.config.js` 전환(JS 상수를 양쪽이 읽게)인데 그건 app config
 * 형식 변경이라 지문을 바꾼다 — 그때까지 이 테스트가 어긋남을 잡는다.
 */
describe('app.json ↔ JS 키 일치 (#1015)', () => {
  const srcOf = (rel: string) => readFileSync(join(__dirname, '..', '..', rel), 'utf8');
  const literalOf = (source: string, name: string) => {
    const m = new RegExp(`${name}\\s*=\\s*\n?\\s*'([^']+)'`).exec(source);
    if (!m) throw new Error(`${name} 리터럴을 못 찾았다 — 상수 이름이 바뀌었는지 확인할 것`);
    return m[1];
  };

  it('카카오 네이티브 앱 키가 app.json과 kakao-auth.ts에서 같다', () => {
    const fromConfig = entryFor('@react-native-kakao/core')?.[1]?.nativeAppKey;
    const fromSource = literalOf(srcOf('lib/kakao-auth.ts'), 'KAKAO_NATIVE_APP_KEY');
    expect(fromConfig).toBeDefined();
    expect(fromSource).toBe(fromConfig);
  });

  /**
   * iOS URL 스킴은 클라이언트 id의 **역도메인 형태**다 —
   * `com.googleusercontent.apps.{id}` (뒤의 `.apps.googleusercontent.com` 제외).
   * 이게 어긋나면 구글 로그인이 콜백에서 앱으로 못 돌아온다.
   */
  it('구글 iOS 클라이언트 id가 app.json 스킴과 google-auth.ts에서 같다', () => {
    const scheme = entryFor('@react-native-google-signin/google-signin')?.[1]?.iosUrlScheme;
    const clientId = literalOf(srcOf('lib/google-auth.ts'), 'GOOGLE_IOS_CLIENT_ID');
    expect(scheme).toBeDefined();
    expect(scheme).toBe(
      `com.googleusercontent.apps.${clientId.replace('.apps.googleusercontent.com', '')}`,
    );
  });
});
