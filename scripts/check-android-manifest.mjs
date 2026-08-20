#!/usr/bin/env node
/**
 * Android 매니페스트 권한 검증 (#921 후속).
 *
 * ## 왜 필요한가
 *
 * `native-prebuild-check.yml`은 `:app:processReleaseMainManifest`를 **돌리기만**
 * 했다 — 병합이 실패하는지는 봤지만 **어떤 권한이 살아남았는지는 아무도 단언하지
 * 않았다.** #915가 iOS Info.plist에 세운 "산출물을 검증한다, 입력이 아니라"
 * 그물이 Android에는 없었다.
 *
 * ## 두 겹으로 보는 이유
 *
 * `--source` 는 prebuild 산출물(`android/app/src/main/AndroidManifest.xml`),
 * `--merged` 는 Gradle이 라이브러리 매니페스트까지 합친 최종본을 본다. 둘은
 * 잡는 사고가 다르다:
 *
 * - **소스에서만 잡히는 것**: `blockedPermissions`(#752) 설정이 사라지는 것.
 *   설정이 지워지면 CAMERA·RECORD_AUDIO가 소스에서 **아예 안 보이게** 되고
 *   (원래 그 항목은 `tools:node="remove"`를 붙이려고 Expo가 넣어준 것이다),
 *   병합 단계에서 라이브러리 매니페스트로부터 조용히 되살아난다. 그래서
 *   소스 모드는 "없는지"가 아니라 **"제거 지시자가 붙어 있는지"** 를 본다.
 * - **병합에서만 잡히는 것**: 실제 최종 결과. `POST_NOTIFICATIONS`처럼
 *   라이브러리(expo-notifications)가 주는 권한은 소스에 없고 병합본에만 있다.
 *
 * 사용법:
 *   npx expo prebuild --platform android --no-install && node scripts/check-android-manifest.mjs --source
 *   (cd android && ./gradlew :app:processReleaseMainManifest) && node scripts/check-android-manifest.mjs --merged
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE_MANIFEST = 'android/app/src/main/AndroidManifest.xml';
const INTERMEDIATES = 'android/app/build/intermediates';

/**
 * 최종 매니페스트에 절대 남으면 안 되는 권한.
 *
 * 앞의 둘은 #752가 `blockedPermissions`로 걷어낸 것이다 — 되살아나면 스토어
 * 목록에 '카메라'·'마이크'로 노출되고 Play 데이터 안전 설문의 답과 어긋난다.
 * 나머지는 **지금 어떤 의존성도 선언하지 않는다**(2026-08-20 node_modules 실측).
 * 새 라이브러리가 끌고 오면 스토어가 아니라 여기서 먼저 걸리라고 둔다.
 */
const FORBIDDEN = [
  ['CAMERA', '#752에서 차단 — expo-image-picker는 앨범 선택만 쓴다.'],
  ['RECORD_AUDIO', '#752에서 차단 — 오디오 녹음 기능이 없다. 스토어에 "마이크"로 뜬다.'],
  ['ACCESS_FINE_LOCATION', '위치를 쓰는 기능이 없다.'],
  ['ACCESS_COARSE_LOCATION', '위치를 쓰는 기능이 없다.'],
  ['ACCESS_BACKGROUND_LOCATION', '위치를 쓰는 기능이 없다.'],
  ['READ_CONTACTS', '연락처를 읽는 기능이 없다. 초대는 코드·딥링크로 한다.'],
  ['READ_SMS', 'SMS를 쓰는 기능이 없다.'],
  ['RECEIVE_SMS', 'SMS를 쓰는 기능이 없다.'],
  ['READ_PHONE_STATE', '기기 식별자 접근으로 읽힌다 — 쓰는 기능이 없다.'],
];

/** 소스 매니페스트에 반드시 있어야 하는 것 (앱이 직접 선언). */
const REQUIRED_SOURCE = [
  ['INTERNET', '서버 통신.'],
  ['READ_CALENDAR', '기기 캘린더 가져오기 (#844).'],
  ['READ_MEDIA_IMAGES', '버그 제보 스크린샷 첨부 · 앨범 선택.'],
  ['VIBRATE', '햅틱 피드백.'],
];

/** 병합본에 반드시 있어야 하는 것 — 라이브러리가 주는 것까지 포함. */
const REQUIRED_MERGED = [
  ...REQUIRED_SOURCE,
  [
    'POST_NOTIFICATIONS',
    'expo-notifications가 자기 매니페스트로 넣는다. 없으면 Android 13+에서 푸시 권한을 요청조차 못 한다 (#405).',
  ],
];

/** `<uses-permission …/>` 를 이름 → 태그 원문으로. 이름은 접두사를 뗀다. */
function readPermissions(xml) {
  const found = new Map();
  for (const m of xml.matchAll(/<uses-permission\b[^>]*>/g)) {
    const tag = m[0];
    const name = tag.match(/android:name="android\.permission\.([A-Z_]+)"/)?.[1];
    if (name) found.set(name, tag);
  }
  return found;
}

/** Gradle 산출물 경로는 AGP 버전마다 달라 — intermediates 아래를 훑어 찾는다. */
function findMergedManifest(dir = INTERMEDIATES) {
  if (!existsSync(dir)) return null;
  const hits = [];
  const walk = (d) => {
    for (const entry of readdirSync(d)) {
      const p = join(d, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (entry === 'AndroidManifest.xml' && /merged_manifests?[\\/]release/.test(p))
        hits.push(p);
    }
  };
  walk(dir);
  // 같은 릴리스 산출물이 여러 벌이면 경로가 가장 짧은(가장 상위) 것을 쓴다.
  return hits.sort((a, b) => a.length - b.length)[0] ?? null;
}

const merged = process.argv.includes('--merged');
const mode = merged ? 'merged' : 'source';

let path;
if (merged) {
  path = findMergedManifest();
  if (!path) {
    console.error(`✖ 병합된 릴리스 매니페스트를 못 찾았습니다 (${INTERMEDIATES} 아래).`);
    console.error('  먼저 실행하세요: (cd android && ./gradlew :app:processReleaseMainManifest)');
    process.exit(1);
  }
} else {
  path = SOURCE_MANIFEST;
  if (!existsSync(path)) {
    console.error(`✖ ${path} 가 없습니다 — prebuild를 먼저 돌리세요.`);
    console.error('  npx expo prebuild --platform android --no-install');
    process.exit(1);
  }
}

const perms = readPermissions(readFileSync(path, 'utf8'));
const problems = [];

for (const [name, why] of FORBIDDEN) {
  const tag = perms.get(name);
  if (merged) {
    // 병합본에 남아 있으면 그대로 AAB에 실린다.
    if (tag) problems.push([`${name} 가 최종 매니페스트에 남아 있습니다`, why]);
  } else if (name === 'CAMERA' || name === 'RECORD_AUDIO') {
    // 소스 모드: "없음"은 안전 신호가 아니다 — blockedPermissions가 지워지면
    // 항목 자체가 사라지고 병합 때 라이브러리에서 되살아난다. 제거 지시자를 본다.
    if (!tag) {
      problems.push([
        `${name} 에 제거 지시자가 없습니다 (항목 자체가 없음)`,
        `${why}\n      app.json의 android.blockedPermissions에서 빠진 것으로 보입니다.`,
      ]);
    } else if (!/tools:node="remove"/.test(tag)) {
      problems.push([`${name} 이 tools:node="remove" 없이 선언돼 있습니다`, why]);
    }
  } else if (tag && !/tools:node="remove"/.test(tag)) {
    problems.push([`${name} 이 선언돼 있습니다`, why]);
  }
}

for (const [name, why] of merged ? REQUIRED_MERGED : REQUIRED_SOURCE) {
  const tag = perms.get(name);
  if (!tag || /tools:node="remove"/.test(tag)) {
    problems.push([`${name} 가 없습니다`, why]);
  }
}

const listed = [...perms.entries()]
  .map(([n, tag]) => `  ${/tools:node="remove"/.test(tag) ? '-' : '+'} ${n}`)
  .sort();
console.log(`매니페스트(${mode}): ${path}`);
console.log(`권한 ${perms.size}개 (+ = 실림, - = 제거 지시자):\n${listed.join('\n')}\n`);

if (problems.length > 0) {
  console.error(`✖ Android 매니페스트 권한 문제 ${problems.length}건:\n`);
  for (const [what, why] of problems) console.error(`  - ${what}\n      ${why}`);
  console.error('\n권한 목록은 스토어 페이지와 데이터 안전 설문에 그대로 드러납니다.');
  process.exit(1);
}

console.log(
  `✔ 금지 ${FORBIDDEN.length}종 없음 · 필수 ${(merged ? REQUIRED_MERGED : REQUIRED_SOURCE).length}종 존재`,
);
