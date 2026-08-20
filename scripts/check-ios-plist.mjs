#!/usr/bin/env node
/**
 * prebuild 산출물의 Info.plist 검증 (#915).
 *
 * ## 왜 산출물을 보나
 *
 * `src/config/__tests__/app-config-hygiene.test.ts`(#913)는 **app.json(입력)**을
 * 본다. 그런데 1.2.0 빌드 47을 스플래시에서 죽인 건 **config plugin이 prebuild
 * 때 키를 지운 것**이었다 — 입력은 멀쩡했고 산출물만 망가졌다. 그래서 입력
 * 검사로는 그 사고를 못 잡는다. 이 스크립트가 그 구멍을 막는다.
 *
 * ## 왜 "안 쓰는 권한"도 필수인가
 *
 * expo-calendar의 iOS 모듈은 **앱 시작 시**(`OnCreate`) 미리알림 권한
 * 요청자를 무조건 만든다. 키가 없으면 `RCTFatal`로 앱이 즉사한다. 실제로
 * 쓰지 않는다는 사실은 권한 문구·스토어 설명·개인정보처리방침이 말한다.
 *
 * 사용법: `npx expo prebuild --platform ios --clean --no-install` 뒤에 실행.
 */
import { readFileSync, existsSync } from 'node:fs';
import plist from '@expo/plist';

const PLIST = 'ios/Rougether/Info.plist';

/** 없으면 앱이 죽거나 기능이 막히는 키 — 지울 때 여기서 먼저 막힌다. */
const REQUIRED = [
  ['NSCalendarsUsageDescription', '캘린더 가져오기(#844). 없으면 권한 요청 자체가 불가.'],
  ['NSCalendarsFullAccessUsageDescription', 'iOS 17+ 캘린더 전체 접근.'],
  [
    'NSRemindersUsageDescription',
    '**안 쓰지만 필수** — expo-calendar가 시작 시 조회한다. 지우면 스플래시에서 즉사(#913).',
  ],
  ['NSRemindersFullAccessUsageDescription', '위와 같은 이유(iOS 17+).'],
  ['NSPhotoLibraryAddUsageDescription', '방 사진 앨범 저장.'],
  ['NSPhotoLibraryUsageDescription', '버그 제보 스크린샷 첨부.'],
];

if (!existsSync(PLIST)) {
  console.error(`✖ ${PLIST} 가 없습니다 — prebuild를 먼저 돌리세요.`);
  process.exit(1);
}

const info = plist.default.parse(readFileSync(PLIST, 'utf8'));
const missing = [];
for (const [key, why] of REQUIRED) {
  const v = info[key];
  if (typeof v !== 'string' || v.trim().length === 0) missing.push([key, why]);
}

if (missing.length > 0) {
  console.error(`✖ Info.plist 필수 키 ${missing.length}개가 비었습니다:\n`);
  for (const [key, why] of missing) console.error(`  - ${key}\n      ${why}`);
  console.error('\n이 키들은 prebuild 산출물 기준입니다 — app.json이 멀쩡해도');
  console.error('config plugin이 지우면 여기서 걸립니다 (#913이 정확히 그랬습니다).');
  process.exit(1);
}

console.log(`✔ Info.plist 필수 권한 키 ${REQUIRED.length}개 모두 존재`);
