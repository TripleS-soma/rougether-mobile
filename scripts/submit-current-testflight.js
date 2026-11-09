#!/usr/bin/env node
// One explicitly selected current TestFlight candidate; the frozen 115 lane is unchanged.
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { validateChecks, sanitizeBuild } = require('./check-testflight-build');
const { withPrivateKey, cleanup } = require('./submit-testflight-build');

const PROJECT = '430c1f3b-4035-47c8-9864-8e07687d628c';
const APP = '6793513720';
const REPOSITORY = 'TripleS-soma/rougether-mobile';
const SHA = /^[a-f0-9]{40}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
function guard(ok, message) {
  if (!ok) throw new Error(message);
}
function candidateFromInputs(env, head, app, eas) {
  guard(
    env.GITHUB_ACTIONS === 'true' && env.GITHUB_REPOSITORY === REPOSITORY,
    'Unexpected execution environment.',
  );
  guard(
    env.SUBMIT_MODE === 'testflight-current-submit' &&
      ['inspect', 'submit'].includes(env.SUBMIT_ACTION),
    'Expected current-candidate inspect or submit mode.',
  );
  guard(env.SUBMIT_PLATFORM === 'ios', 'Only iOS is supported.');
  guard(
    env.SUBMIT_ACTION !== 'submit' ||
      (env.SUBMIT_AUTHORIZED === 'true' && env.GITHUB_RUN_ATTEMPT === '1'),
    'Submission needs explicit authorization and a first attempt. Never rerun a submission.',
  );
  guard(
    SHA.test(env.EXPECTED_TOOLING_SHA || '') &&
      head === env.EXPECTED_TOOLING_SHA &&
      head === env.GITHUB_SHA,
    'Tooling SHA does not match the checked-out workflow.',
  );
  guard(
    UUID.test(env.EXISTING_BUILD_ID || '') &&
      SHA.test(env.EXPECTED_SOURCE_SHA || '') &&
      SHA.test(env.EXPECTED_IOS_RUNTIME || ''),
    'Exact build ID, binary source SHA and runtime are required.',
  );
  guard(
    /^\d+\.\d+\.\d+$/.test(env.EXPECTED_APP_VERSION || '') &&
      /^\d+$/.test(env.EXPECTED_IOS_BUILD || '') &&
      Number.isSafeInteger(Number(env.EXPECTED_IOS_BUILD)) &&
      Number(env.EXPECTED_IOS_BUILD) > 115,
    'A current candidate version and build number are required.',
  );
  const profile = eas.submit?.testflight;
  guard(
    app.expo?.version === env.EXPECTED_APP_VERSION &&
      app.expo?.extra?.eas?.projectId === PROJECT &&
      !profile?.extends &&
      profile?.ios?.ascAppId === APP &&
      profile?.ios?.ascApiKeyId === '6G2698ZUCN' &&
      profile?.ios?.ascApiKeyIssuerId === '371e21a1-aa0c-4582-938e-005de68485b5' &&
      profile?.ios?.ascApiKeyPath === './asc-api-key.p8',
    'App version, destination or designated credential profile changed.',
  );
  return {
    id: env.EXISTING_BUILD_ID,
    source: env.EXPECTED_SOURCE_SHA,
    version: env.EXPECTED_APP_VERSION,
    number: env.EXPECTED_IOS_BUILD,
    runtime: env.EXPECTED_IOS_RUNTIME,
  };
}
function validateBuild(build, candidate) {
  guard(
    build?.id === candidate.id &&
      build.status === 'FINISHED' &&
      build.platform === 'IOS' &&
      build.distribution === 'STORE' &&
      build.app?.id === PROJECT &&
      build.appVersion === candidate.version &&
      String(build.appBuildVersion) === candidate.number &&
      build.gitCommitHash === candidate.source &&
      build.runtime?.version === candidate.runtime &&
      build.buildProfile === 'testflight' &&
      (build.channel || build.updateChannel?.name) === 'internal',
    'Build metadata does not exactly match the approved finished internal candidate.',
  );
}
function appleCandidate(response, candidate) {
  guard(
    response?.ios?.ascAppIdentifier === APP && Array.isArray(response.ios.testFlightBuilds),
    'Apple status is unavailable or belongs to another app.',
  );
  const b = response.ios.testFlightBuilds.find(
    (b) => b.appVersion === candidate.version && String(b.buildNumber) === candidate.number,
  );
  if (!b) return null;
  const scalar = (v) => (typeof v === 'string' && /^[a-zA-Z0-9._-]{1,120}$/.test(v) ? v : null);
  return {
    version: candidate.version,
    buildNumber: candidate.number,
    processingState: scalar(b.processingState),
    internalState: scalar(b.internalState),
    externalState: scalar(b.externalState),
    expired: b.expired === true,
    easBuildId: scalar(b.easBuildId),
    easSubmissionId: scalar(b.easSubmissionId),
  };
}
function command(file, args, timeout = 5 * 60 * 1000) {
  const env = { ...process.env };
  delete env.ASC_API_KEY_P8;
  try {
    return execFileSync(file, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env,
      maxBuffer: 16 * 1024 * 1024,
      timeout,
    }).trim();
  } catch {
    throw new Error(
      `${file} ${args[0]} failed; inspect existing state, never automatically retry.`,
    );
  }
}
function execute(env, app, eas, run = command, report = console.log, withKey = withPrivateKey) {
  const c = candidateFromInputs(env, run('git', ['rev-parse', 'HEAD']), app, eas);
  const json = (file, args) => {
    try {
      return JSON.parse(run(file, args));
    } catch {
      throw new Error(`${file} ${args[0]} could not be verified. No submission or retry.`);
    }
  };
  const build = json('eas', ['build:view', c.id, '--json']);
  validateBuild(build, c);
  report(JSON.stringify({ candidate: sanitizeBuild(build), toolingSha: env.EXPECTED_TOOLING_SHA }));
  const history = () => {
    const all = [];
    for (let offset = 0; offset < 1000; offset += 50) {
      const page = json('eas', [
        'submit:list',
        '--platform',
        'ios',
        '--json',
        '--non-interactive',
        '--limit',
        '50',
        '--offset',
        String(offset),
      ]);
      guard(Array.isArray(page) && page.length <= 50, 'Invalid submission history.');
      all.push(...page);
      if (page.length < 50)
        return all.filter(
          ({ submittedBuild: b }) =>
            b?.id === c.id ||
            (b?.appVersion === c.version && String(b.appBuildVersion) === c.number),
        );
    }
    throw new Error('Submission history is truncated. Do not submit.');
  };
  const metadata = (rows) =>
    rows.map((s) => ({ id: s.id, status: s.status, buildId: s.submittedBuild?.id }));
  return withKey(env.ASC_API_KEY_P8, () => {
    const apple = () =>
      appleCandidate(
        json('eas', [
          'submit:status',
          '--platform',
          'ios',
          '--profile',
          'testflight',
          '--json',
          '--non-interactive',
        ]),
        c,
      );
    const prior = history();
    report(JSON.stringify({ existingSubmissions: metadata(prior) }));
    const before = apple();
    report(JSON.stringify({ appleTestFlight: before }));
    if (env.SUBMIT_ACTION === 'inspect') return;
    guard(prior.length === 0, 'A submission already exists. Inspect it instead of resubmitting.');
    if (before) {
      report('Build is already on App Store Connect; no resubmission.');
      return;
    }
    validateChecks(
      json('gh', [
        'api',
        '--paginate',
        '--slurp',
        `repos/${REPOSITORY}/commits/${c.source}/check-runs?filter=all&per_page=100`,
      ]),
      c.source,
    );
    guard(history().length === 0, 'Another submission appeared during preflight.');
    report(
      'Submitting one exact existing internal build; no rebuild, OTA, group or credential changes.',
    );
    let confirmed = false;
    try {
      run(
        'eas',
        [
          'submit',
          '--platform',
          'ios',
          '--profile',
          'testflight',
          '--id',
          c.id,
          '--non-interactive',
          '--wait',
          '--no-auto-testflight-setup',
        ],
        35 * 60 * 1000,
      );
      confirmed = true;
    } catch {
      report('Submit command did not confirm success. Reading status only, no retry.');
    }
    const after = history();
    report(
      JSON.stringify({
        submitCommandSucceeded: confirmed,
        submissionsAfterAttempt: metadata(after),
      }),
    );
    guard(
      after.length === 1 && after[0].status === 'FINISHED' && after[0].submittedBuild?.id === c.id,
      'Upload is failed, pending or uncertain. Inspect status; never resubmit automatically.',
    );
    report('EAS upload finished. Waiting for Apple processing, not App Store review.');
    for (let poll = 0; poll < 30; poll++) {
      const state = apple();
      report(JSON.stringify({ appleTestFlight: state }));
      if (state && state.processingState !== 'PROCESSING') {
        guard(
          state.processingState === 'VALID' && !state.expired,
          'Apple processing did not yield a valid unexpired TestFlight build.',
        );
        return;
      }
      if (poll < 29) run('sleep', ['30']);
    }
    report('Upload finished; Apple processing is still pending.');
  });
}
if (require.main === module) {
  try {
    if (process.argv[2] === 'cleanup') cleanup();
    else {
      const app = JSON.parse(fs.readFileSync('app.json', 'utf8'));
      const eas = JSON.parse(fs.readFileSync('eas.json', 'utf8'));
      if (process.argv[2] === 'validate')
        candidateFromInputs(process.env, command('git', ['rev-parse', 'HEAD']), app, eas);
      else execute(process.env, app, eas);
    }
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
module.exports = { candidateFromInputs, validateBuild, appleCandidate, execute };
