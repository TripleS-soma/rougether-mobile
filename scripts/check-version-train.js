#!/usr/bin/env node
/**
 * iOS 버전 트레인 가드 — 스토어에 나간 버전과 같은 `app.json` version으로는
 * TestFlight 빌드를 만들지 않는다.
 *
 * ## 왜
 *
 * 2026-09-03, 1.3.0이 App Store에 출시된 상태에서 RNFB 26(#1052)을 머지했다.
 * EAS testflight 빌드는 성공했지만 ASC 업로드가 거부됐다:
 *   "Invalid Pre-Release Train. The train version '1.3.0' is closed for new
 *    build submissions" / "CFBundleShortVersionString [1.3.0] must contain a
 *    higher version than that of the previously approved version [1.3.0]"
 * 빌드 쿼터 1회를 태우고 아무 데도 못 올라갔다. Apple은 **승인된 버전과 같은
 * CFBundleShortVersionString의 새 빌드를 받지 않는다** — 빌드 번호를 올려도
 * 소용없다. 출시 뒤 첫 네이티브 윈도우는 반드시 버전 범프부터.
 *
 * ## 무엇을 보나
 *
 * `eas build:list --platform ios --build-profile production --status finished
 * --json`의 결과(stdin)에서 스토어에 나간(distribution STORE) 빌드의 최고
 * appVersion을 찾고, `app.json`의 version이 그보다 **높지 않으면** 실패한다.
 * production 빌드가 곧 승인은 아니지만(심사 중일 수 있음) 그 사이 같은 버전의
 * TestFlight 빌드도 의미가 없으므로 보수적으로 막는다.
 *
 * 조회 결과가 비어 있거나 파싱이 안 되면 통과시킨다 — 가드가 배포를 막는
 * 장치가 되면 안 된다(#1034의 원칙과 같다).
 *
 * 사용법:
 *   eas build:list --platform ios --build-profile production --status finished \
 *     --limit 10 --json --non-interactive | node scripts/check-version-train.js
 *   옵션: --app-version 1.4.0 (app.json 대신 명시)
 */
const fs = require('node:fs');
const path = require('node:path');

/** 느슨한 semver 비교 — `1.10.0 > 1.9.1`. 숫자가 아닌 조각은 0으로 본다. */
function compareVersions(a, b) {
  const pa = String(a)
    .split('.')
    .map((x) => parseInt(x, 10) || 0);
  const pb = String(b)
    .split('.')
    .map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

/** 스토어에 나간 빌드 중 최고 버전. 없으면 null. */
function findShippedVersion(builds) {
  if (!Array.isArray(builds)) return null;
  let best = null;
  for (const b of builds) {
    if (!b || typeof b.appVersion !== 'string') continue;
    if (b.status && b.status !== 'FINISHED') continue;
    // 스토어 배포 빌드만 — 내부 배포(preview)는 트레인을 닫지 않는다.
    if (b.distribution && b.distribution !== 'STORE') continue;
    if (best === null || compareVersions(b.appVersion, best) > 0) best = b.appVersion;
  }
  return best;
}

/**
 * @returns {{ ok: boolean, shipped: string|null, message: string }}
 */
function checkTrain(appVersion, builds) {
  const shipped = findShippedVersion(builds);
  if (shipped === null) {
    return {
      ok: true,
      shipped,
      message: `스토어 빌드 정보 없음 — 버전 트레인 가드 통과 (app ${appVersion})`,
    };
  }
  if (compareVersions(appVersion, shipped) > 0) {
    return {
      ok: true,
      shipped,
      message: `app.json ${appVersion} > 스토어 ${shipped} — 버전 트레인 가드 통과`,
    };
  }
  return {
    ok: false,
    shipped,
    message:
      `app.json version ${appVersion}은 스토어에 나간 ${shipped}보다 높지 않습니다. ` +
      `Apple은 승인된 버전과 같은 CFBundleShortVersionString의 새 빌드를 받지 않아 ` +
      `TestFlight 업로드가 거부됩니다(빌드 쿼터만 소모). 네이티브 빌드 전에 app.json version을 올리세요.`,
  };
}

function readAppVersion() {
  const p = path.join(__dirname, '..', 'app.json');
  return JSON.parse(fs.readFileSync(p, 'utf8')).expo.version;
}

function main() {
  const argv = process.argv.slice(2);
  const i = argv.indexOf('--app-version');
  const appVersion = i >= 0 ? argv[i + 1] : readAppVersion();
  let builds = [];
  try {
    const raw = fs.readFileSync(0, 'utf8');
    builds = raw.trim() ? JSON.parse(raw) : [];
  } catch {
    builds = [];
  }
  const result = checkTrain(appVersion, builds);
  console.log(result.message);
  process.exit(result.ok ? 0 : 1);
}

if (require.main === module) main();

module.exports = { compareVersions, findShippedVersion, checkTrain };
