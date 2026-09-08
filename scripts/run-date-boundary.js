#!/usr/bin/env node
/**
 * Runs the date-boundary contract tests once per device time zone named in the spec fixture
 * (TZ env var), collecting the requests the real app code produced into
 * output/contracts/date-boundary-requests.json — stamped with the mobile SHA and the spec
 * SHA the fixture copy came from. The server replays that file in DateBoundaryContractTest.
 */
const { spawnSync, execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const fixture = require(path.join(root, 'contracts', 'date-boundary-cases.json'));
const sources = require(path.join(root, 'contracts', 'sources.json'));

const TESTS = [
  'src/utils/__tests__/datetime.test.ts',
  'src/api/__tests__/date-boundary-requests.test.tsx',
];
const zones = [...new Set(fixture.cases.map((c) => c.deviceTimeZone))];
const runsDir = path.join(root, 'output', 'contracts', 'runs');
fs.mkdirSync(runsDir, { recursive: true });

const jestBin = require.resolve('jest/bin/jest');
const runs = [];
for (const tz of zones) {
  const out = path.join(runsDir, `${tz.replace(/[^A-Za-z0-9]+/g, '_')}.json`);
  console.log(`\n=== TZ=${tz} ===`);
  const result = spawnSync(process.execPath, [jestBin, '--ci', ...TESTS], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, TZ: tz, DATE_BOUNDARY_OUT: out },
  });
  if (result.status !== 0) {
    console.error(`date-boundary: TZ=${tz} failed`);
    process.exit(result.status ?? 1);
  }
  runs.push(JSON.parse(fs.readFileSync(out, 'utf8')));
}

const git = (args) => {
  try {
    return execSync(`git ${args}`, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return null;
  }
};

const merged = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  // git 을 먼저 본다 — 서버 저장소의 교차 워크플로가 이 스크립트를 mobile/ 하위 checkout 에서 돌릴 때
  // GITHUB_SHA 는 서버 커밋이라 모바일 SHA 로 쓰면 안 된다
  mobileSha: git('rev-parse HEAD') ?? process.env.GITHUB_SHA ?? null,
  mobileRef: git('rev-parse --abbrev-ref HEAD') ?? process.env.GITHUB_REF_NAME ?? null,
  spec: sources['date-boundary-cases.json'],
  fixtureSchemaVersion: fixture.schemaVersion,
  runs,
};
const target = path.join(root, 'output', 'contracts', 'date-boundary-requests.json');
fs.writeFileSync(target, `${JSON.stringify(merged, null, 2)}\n`);

const total = runs.reduce((n, r) => n + r.records.length, 0);
console.log(
  `\ndate-boundary: ${zones.length} time zones × ${fixture.cases.length} cases → ${total} records`,
);
console.log(
  `written ${path.relative(root, target)} (mobile ${merged.mobileSha}, spec ${merged.spec.sha})`,
);
