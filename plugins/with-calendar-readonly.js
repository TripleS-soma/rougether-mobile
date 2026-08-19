const { withInfoPlist } = require('expo/config-plugins');

/**
 * expo-calendar 플러그인이 넣는 **쓰기·미리알림 권한을 걷어낸다** (#844).
 *
 * 이 앱은 기기 캘린더를 **읽기만** 한다 — 일정을 투두로 가져올 뿐 캘린더에
 * 쓰지 않고 미리알림은 손대지도 않는다. 그런데 플러그인 기본값이:
 *
 *   Android  READ_CALENDAR + **WRITE_CALENDAR**
 *   iOS      NSCalendars* + **NSReminders***("Allow $(PRODUCT_NAME) to access
 *            your reminders" — 한국어 앱에 영문 기본값 그대로)
 *
 * 안 쓰는 권한을 선언하면 심사에서 용도를 묻고(가이드 5.1.1), 사용자에게도
 * 필요 이상을 요구하는 것으로 보인다. 실제로 쓰는 것만 남긴다.
 *
 * ## 왜 app.json에 두 번 들어가는가 (실측)
 *
 * 두 플랫폼의 요구가 정반대다:
 *
 * - **iOS**: `NSReminders*`는 expo-calendar의 **mod**가 넣는다. mod는
 *   **나중에 등록할수록 먼저** 실행되므로, 우리 mod가 뒤에 돌게 하려면
 *   플러그인을 expo-calendar **앞**에 둬야 한다. 뒤에 두면 아직 없는 키를
 *   지우게 돼 아무 일도 일어나지 않는다.
 * - **Android**: `WRITE_CALENDAR`는 매니페스트가 아니라
 *   `config.android.permissions` **배열**에서 나온다(매니페스트 mod로 지우면
 *   이후 단계가 배열을 보고 다시 넣는다). 플러그인 **함수**는 배열 순서대로
 *   도니 expo-calendar **뒤**에 둬야 이미 추가된 항목을 거를 수 있다.
 *
 * 그래서 `mode: 'ios'`를 앞에, `mode: 'android'`를 뒤에 각각 건다.
 *
 * 쓰기가 필요해지면 이 플러그인을 지우는 게 아니라 **여기서 명시적으로
 * 허용**할 것 — 그래야 권한이 늘어난 사실이 diff에 남는다.
 */
const DROP_ANDROID = ['android.permission.WRITE_CALENDAR'];
const DROP_IOS = [
  'NSRemindersUsageDescription',
  'NSRemindersFullAccessUsageDescription',
  'NSRemindersWriteOnlyAccessUsageDescription',
];

module.exports = function withCalendarReadOnly(config, { mode } = {}) {
  if (mode === 'android') {
    const permissions = config.android?.permissions;
    if (Array.isArray(permissions)) {
      config.android.permissions = permissions.filter((p) => !DROP_ANDROID.includes(p));
    }
    return config;
  }
  return withInfoPlist(config, (cfg) => {
    for (const key of DROP_IOS) delete cfg.modResults[key];
    return cfg;
  });
};
