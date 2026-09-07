#!/usr/bin/env node
// A deliberately separate build-only lane. No submit, OTA, credential repair, or retry.
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { checkTrain } = require('./check-version-train');

const PROJECT_ID = '430c1f3b-4035-47c8-9864-8e07687d628c';
const REPOSITORY = 'TripleS-soma/rougether-mobile';
const REQUIRED_CHECKS = ['check', 'prebuild', 'ios-plist', 'android-manifest', 'release-smoke'];
const SHA = /^[a-f0-9]{40}$/;

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function validateConfiguration(env, checkoutSha, app, eas) {
  requireCondition(env.BUILD_MODE === 'testflight-build-only', 'Expected build-only mode.');
  requireCondition(['inspect', 'build'].includes(env.BUILD_ACTION), 'Invalid build-only action.');
  requireCondition(env.BUILD_PLATFORM === 'ios', 'Build-only mode supports iOS only.');
  requireCondition(env.BUILD_SUBMIT === 'false', 'Build-only mode requires submit=false.');
  requireCondition(
    SHA.test(env.EXPECTED_SOURCE_SHA || '') &&
      env.EXPECTED_SOURCE_SHA === env.GITHUB_SHA &&
      checkoutSha === env.EXPECTED_SOURCE_SHA,
    'Expected source SHA must match both GITHUB_SHA and checkout HEAD.',
  );
  requireCondition(env.GITHUB_REPOSITORY === REPOSITORY, 'Unexpected GitHub repository.');
  const profile = eas.build?.testflight;
  requireCondition(
    app.expo?.version === '1.5.0' &&
      app.expo?.extra?.eas?.projectId === PROJECT_ID &&
      app.expo?.runtimeVersion?.policy === 'fingerprint' &&
      eas.cli?.appVersionSource === 'remote' &&
      profile?.channel === 'dev' &&
      profile?.environment === 'preview' &&
      profile?.ios?.distribution === 'store' &&
      profile?.autoIncrement === true &&
      (profile.ios.autoIncrement === undefined || profile.ios.autoIncrement === true) &&
      !profile.extends &&
      !profile.developmentClient &&
      !profile.ios.simulator,
    'Expected app 1.5.0, designated project, fingerprint runtime, and remote-incremented testflight/dev/preview/store profile.',
  );
}

function validateChecks(pages, sha) {
  requireCondition(
    Array.isArray(pages) && pages.every((page) => Array.isArray(page.check_runs)),
    'GitHub check response is incomplete.',
  );
  const checks = pages.flatMap((page) => page.check_runs);
  for (const name of REQUIRED_CHECKS) {
    const latest = checks
      .filter(
        (check) =>
          check.name === name && check.head_sha === sha && check.app?.slug === 'github-actions',
      )
      .sort((a, b) => b.id - a.id)[0];
    requireCondition(
      latest?.status === 'completed' && latest.conclusion === 'success',
      `Latest exact-source CI check is missing or not successful: ${name}.`,
    );
  }
}

function nextBuildNumber(remote, expected = '') {
  const current = Number(remote?.buildNumber);
  requireCondition(
    /^\d+$/.test(String(remote?.buildNumber)) && Number.isSafeInteger(current) && current > 0,
    'Remote iOS build number is unavailable or invalid; do not reset it.',
  );
  const next = current + 1;
  requireCondition(
    Number.isSafeInteger(next) && (!expected || String(next) === expected),
    'Next iOS build number differs from the explicit expectation.',
  );
  return next;
}

function runtime(build) {
  return build.runtime?.version || build.fingerprint?.hash || build.runtimeVersion || null;
}

// Only scalar, bounded fields: never forward EAS artifacts, log URLs, actors, errors, or keys.
function sanitizeBuild(build) {
  const scalar = (value) =>
    typeof value === 'string' && /^[a-zA-Z0-9._-]{1,120}$/.test(value) ? value : null;
  return {
    id: scalar(build.id),
    status: scalar(build.status),
    appVersion: scalar(build.appVersion),
    appBuildVersion: scalar(build.appBuildVersion),
    gitCommitHash: scalar(build.gitCommitHash),
    runtime: scalar(runtime(build)),
    profile: scalar(build.buildProfile),
    channel: scalar(build.channel || build.updateChannel?.name),
  };
}

function validateHistory(builds, fingerprint) {
  requireCondition(Array.isArray(builds), 'EAS build history is unavailable.');
  requireCondition(
    builds.length < 50,
    'Matching history is truncated; inspect it before building.',
  );
  for (const build of builds) {
    requireCondition(
      runtime(build) === fingerprint || build.fingerprint?.hash === fingerprint,
      'EAS matching-history query returned an unexpected runtime.',
    );
    requireCondition(
      build.status === 'CANCELED',
      'A matching iOS build already exists or has an unresolved attempt. Use the existing build or investigate; no automatic retry.',
    );
  }
}

function command(file, args, timeout = 5 * 60 * 1000) {
  try {
    return execFileSync(file, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 16 * 1024 * 1024,
      timeout,
    }).trim();
  } catch {
    // Child stderr can contain URLs or environment values; never dump the Error object.
    throw new Error(
      `${file} ${args[0]} failed. No automatic retry; inspect service status separately.`,
    );
  }
}

function execute(env, app, eas, run = command, report = console.log, validateOnly = false) {
  validateConfiguration(env, run('git', ['rev-parse', 'HEAD']), app, eas);
  if (validateOnly) return;
  const json = (file, args, timeout) => {
    const raw = run(file, args, timeout);
    try {
      return JSON.parse(raw);
    } catch {
      throw new Error(`${file} ${args[0]} returned invalid JSON. No build or retry is permitted.`);
    }
  };
  if (env.BUILD_ACTION === 'build') {
    validateChecks(
      json('gh', [
        'api',
        '--paginate',
        '--slurp',
        `repos/${REPOSITORY}/commits/${env.EXPECTED_SOURCE_SHA}/check-runs?filter=all&per_page=100`,
      ]),
      env.EXPECTED_SOURCE_SHA,
    );
  }
  const common = ['--platform', 'ios', '--json', '--non-interactive'];
  const recent = json('eas', ['build:list', ...common, '--limit', '20']);
  requireCondition(Array.isArray(recent), 'EAS recent builds response is invalid.');
  const versionArgs = ['build:version:get', ...common, '--profile', 'testflight'];
  const next = nextBuildNumber(json('eas', versionArgs), env.EXPECTED_IOS_BUILD);
  // EAS fingerprint:generate registers a remote fingerprint; inspect must remain read-only.
  const fingerprint =
    env.BUILD_ACTION === 'inspect'
      ? json('npx', ['--no-install', 'expo-updates', 'fingerprint:generate', '--platform', 'ios'])
          .hash
      : json('eas', ['fingerprint:generate', ...common, '--build-profile', 'testflight']).hash;
  requireCondition(SHA.test(fingerprint || ''), 'A valid testflight fingerprint is required.');
  report(
    JSON.stringify({
      action: env.BUILD_ACTION,
      source: env.EXPECTED_SOURCE_SHA,
      currentIosBuild: next - 1,
      expectedNextIosBuild: next,
      fingerprint,
      fingerprintSource: env.BUILD_ACTION === 'inspect' ? 'local' : 'testflight-profile',
      recentIosBuilds: recent.map(sanitizeBuild),
    }),
  );
  if (env.BUILD_ACTION === 'inspect') return;

  // Query all profiles, including older records outside the recent-build window.
  for (const filter of ['--fingerprint-hash', '--runtime-version']) {
    const matching = json('eas', ['build:list', ...common, filter, fingerprint, '--limit', '50']);
    requireCondition(Array.isArray(matching), 'EAS matching history is unavailable.');
    report(JSON.stringify({ matchingIosBuilds: matching.map(sanitizeBuild) }));
    validateHistory(matching, fingerprint);
  }
  const production = json('eas', [
    'build:list',
    ...common,
    '--build-profile',
    'production',
    '--status',
    'finished',
    '--limit',
    '50',
  ]);
  requireCondition(
    Array.isArray(production) &&
      production.length < 50 &&
      production.every(
        (build) =>
          build.status === 'FINISHED' &&
          build.distribution === 'STORE' &&
          /^\d+\.\d+\.\d+$/.test(build.appVersion || ''),
      ),
    'Production version-train history is incomplete.',
  );
  requireCondition(checkTrain('1.5.0', production).ok, 'App 1.5.0 version train is not open.');
  requireCondition(next > 114, 'The new iOS build number must be greater than 114.');
  // Another actor may consume the remote counter even while Actions is serialized.
  requireCondition(
    nextBuildNumber(json('eas', versionArgs)) === next,
    'Remote iOS build number changed during preflight; stop and inspect again.',
  );
  report('Starting one iOS testflight build; no submission, OTA, or automatic retry.');
  const result = json('eas', [
    'build',
    ...common,
    '--profile',
    'testflight',
    '--no-wait',
    '--freeze-credentials',
  ]);
  requireCondition(Array.isArray(result) && result.length === 1, 'Unexpected EAS build result.');
  let build = result[0];
  requireCondition(
    /^[a-f0-9-]{36}$/.test(build.id || ''),
    'Build returned no valid ID. Inspect EAS before taking another action.',
  );
  const buildId = build.id;
  const deadline = Date.now() + 80 * 60 * 1000;
  for (let poll = 0; ; poll += 1) {
    report(JSON.stringify({ candidateIos: sanitizeBuild(build) }));
    if (build.status === 'FINISHED') break;
    requireCondition(
      ['NEW', 'IN_QUEUE', 'IN_PROGRESS', 'PENDING'].includes(build.status),
      'Candidate did not finish successfully. Inspect the recorded build ID; do not retry.',
    );
    requireCondition(
      poll < 160 && Date.now() < deadline,
      'Candidate is still running after the wait limit. Inspect the recorded ID; do not retry.',
    );
    run('sleep', ['30']);
    build = json('eas', ['build:view', buildId, '--json']);
    requireCondition(build.id === buildId, 'EAS returned a different candidate ID.');
  }
  requireCondition(
    build.status === 'FINISHED' &&
      build.platform === 'IOS' &&
      build.appVersion === '1.5.0' &&
      String(build.appBuildVersion) === String(next) &&
      build.gitCommitHash === env.EXPECTED_SOURCE_SHA &&
      runtime(build) === fingerprint &&
      build.buildProfile === 'testflight' &&
      (build.channel || build.updateChannel?.name) === 'dev' &&
      build.distribution === 'STORE',
    'Build result does not match the authorized candidate. Do not submit or retry.',
  );
}

if (require.main === module) {
  try {
    execute(
      process.env,
      JSON.parse(fs.readFileSync('app.json', 'utf8')),
      JSON.parse(fs.readFileSync('eas.json', 'utf8')),
      command,
      console.log,
      process.argv[2] === 'validate',
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  REQUIRED_CHECKS,
  validateConfiguration,
  validateChecks,
  nextBuildNumber,
  sanitizeBuild,
  validateHistory,
  execute,
};
