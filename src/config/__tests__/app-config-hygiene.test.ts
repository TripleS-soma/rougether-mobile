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
