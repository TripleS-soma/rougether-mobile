#!/usr/bin/env node
// Submit one already-built, explicitly approved candidate. Never build or publish an OTA.
const fs = require('node:fs');
const { createPrivateKey } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { validateChecks, sanitizeBuild } = require('./check-testflight-build');

const CANDIDATE = Object.freeze({
  id: '3e9beb68-454f-44fd-883e-3b7a4408e184',
  appVersion: '1.5.0',
  appBuildVersion: '115',
  gitCommitHash: '8496faddd40093b92f58da7fea91274fff219bea',
  runtime: '563af203e28f9da8a5fafd3be8c36b00b6e60b52',
  projectId: '430c1f3b-4035-47c8-9864-8e07687d628c',
  ascAppId: '6793513720',
});
const KEY_PATH = 'asc-api-key.p8';
const REPOSITORY = 'TripleS-soma/rougether-mobile';

function guard(condition, message) {
  if (!condition) throw new Error(message);
}

function validateInputs(env, checkoutSha, app, eas) {
  guard(env.GITHUB_ACTIONS === 'true', 'Submission is allowed only inside GitHub Actions.');
  guard(env.GITHUB_REPOSITORY === REPOSITORY, 'Unexpected repository.');
  guard(env.SUBMIT_MODE === 'testflight-submit-only', 'Expected submit-only mode.');
  guard(['inspect', 'submit'].includes(env.SUBMIT_ACTION), 'Invalid submit-only action.');
  guard(env.SUBMIT_PLATFORM === 'ios', 'Submit-only supports iOS only.');
  guard(
    env.SUBMIT_ACTION === 'inspect' || env.SUBMIT_AUTHORIZED === 'true',
    'Submitting requires explicit submit=true.',
  );
  guard(
    env.SUBMIT_ACTION === 'inspect' || env.GITHUB_RUN_ATTEMPT === '1',
    'Do not rerun a submission attempt; inspect its existing status instead.',
  );
  guard(
    env.EXISTING_BUILD_ID === CANDIDATE.id &&
      env.EXPECTED_SOURCE_SHA === CANDIDATE.gitCommitHash &&
      env.EXPECTED_IOS_BUILD === CANDIDATE.appBuildVersion,
    'Only the approved existing 1.5.0 (115) candidate may be submitted.',
  );
  guard(
    /^[a-f0-9]{40}$/.test(env.EXPECTED_TOOLING_SHA || '') &&
      env.EXPECTED_TOOLING_SHA === env.GITHUB_SHA &&
      checkoutSha === env.EXPECTED_TOOLING_SHA,
    'Tooling SHA must match GITHUB_SHA and checkout; it is not the app source SHA.',
  );
  const profile = eas.submit?.testflight;
  guard(
    app.expo?.extra?.eas?.projectId === CANDIDATE.projectId &&
      app.expo?.version === CANDIDATE.appVersion &&
      !profile?.extends &&
      profile?.ios?.ascAppId === CANDIDATE.ascAppId &&
      profile?.ios?.ascApiKeyId === '6G2698ZUCN' &&
      profile?.ios?.ascApiKeyIssuerId === '371e21a1-aa0c-4582-938e-005de68485b5' &&
      profile?.ios?.ascApiKeyPath === `./${KEY_PATH}`,
    'The designated EAS project and TestFlight submission profile must be unchanged.',
  );
}

function validateCandidate(build) {
  guard(
    build?.id === CANDIDATE.id &&
      build.status === 'FINISHED' &&
      build.platform === 'IOS' &&
      build.distribution === 'STORE' &&
      build.app?.id === CANDIDATE.projectId &&
      build.appVersion === CANDIDATE.appVersion &&
      String(build.appBuildVersion) === CANDIDATE.appBuildVersion &&
      build.gitCommitHash === CANDIDATE.gitCommitHash &&
      build.runtime?.version === CANDIDATE.runtime &&
      build.buildProfile === 'testflight' &&
      (build.channel || build.updateChannel?.name) === 'dev',
    'Remote build does not exactly match the approved finished candidate.',
  );
}

function matchingSubmissions(submissions) {
  return submissions.filter(
    ({ submittedBuild: build }) =>
      build?.id === CANDIDATE.id ||
      (build?.appVersion === CANDIDATE.appVersion &&
        String(build.appBuildVersion) === CANDIDATE.appBuildVersion),
  );
}

const scalar = (value) =>
  typeof value === 'string' && /^[a-zA-Z0-9._-]{1,120}$/.test(value) ? value : null;

function submissionMetadata(submission) {
  return {
    id: scalar(submission.id),
    status: scalar(submission.status),
    buildId: scalar(submission.submittedBuild?.id),
  };
}

function appleCandidate(response) {
  guard(
    response?.ios?.ascAppIdentifier === CANDIDATE.ascAppId &&
      Array.isArray(response.ios.testFlightBuilds),
    'App Store Connect status is unavailable or belongs to another app.',
  );
  const build = response.ios.testFlightBuilds.find(
    (entry) =>
      entry.appVersion === CANDIDATE.appVersion &&
      String(entry.buildNumber) === CANDIDATE.appBuildVersion,
  );
  if (!build) return null;
  return {
    appVersion: CANDIDATE.appVersion,
    buildNumber: CANDIDATE.appBuildVersion,
    processingState: scalar(build.processingState),
    internalState: scalar(build.internalState),
    externalState: scalar(build.externalState),
    expired: typeof build.expired === 'boolean' ? build.expired : null,
    easBuildId: scalar(build.easBuildId),
    easSubmissionId: scalar(build.easSubmissionId),
  };
}

function command(file, args, timeout = 5 * 60 * 1000) {
  const childEnv = { ...process.env };
  delete childEnv.ASC_API_KEY_P8;
  try {
    return execFileSync(file, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: childEnv,
      maxBuffer: 16 * 1024 * 1024,
      timeout,
    });
  } catch {
    // Never forward CLI stdout/stderr or Error objects: these can contain keys or private URLs.
    throw new Error(`${file} ${args[0]} failed; outcome may be uncertain. Do not retry.`);
  }
}

function cleanup(io = fs) {
  io.rmSync(KEY_PATH, { force: true });
}

function withPrivateKey(key, work, io = fs, parseKey = createPrivateKey) {
  guard(typeof key === 'string' && key.length > 0, 'The designated ASC key is unavailable.');
  try {
    guard(parseKey(key).asymmetricKeyType === 'ec', 'Expected an EC ASC private key.');
  } catch {
    throw new Error('The designated ASC private key is invalid.');
  }
  let created = false;
  try {
    io.writeFileSync(KEY_PATH, key, { flag: 'wx', mode: 0o600 });
    created = true;
    return work();
  } finally {
    if (created) cleanup(io);
  }
}

function execute(env, app, eas, run = command, report = console.log, withKey = withPrivateKey) {
  validateInputs(env, run('git', ['rev-parse', 'HEAD']).trim(), app, eas);
  const json = (file, args) => {
    try {
      return JSON.parse(run(file, args));
    } catch {
      throw new Error(`${file} ${args[0]} could not be verified. Do not submit or retry.`);
    }
  };
  const build = json('eas', ['build:view', CANDIDATE.id, '--json']);
  validateCandidate(build);
  report(JSON.stringify({ toolingSha: env.EXPECTED_TOOLING_SHA, candidate: sanitizeBuild(build) }));
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
      if (page.length < 50) return matchingSubmissions(all);
    }
    throw new Error('Submission history is truncated. Do not submit or retry.');
  };
  const prior = history();
  report(JSON.stringify({ existingSubmissions: prior.map(submissionMetadata) }));
  const appleStatus = () =>
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
    );
  if (env.SUBMIT_ACTION === 'inspect') {
    return withKey(env.ASC_API_KEY_P8, () => {
      report(JSON.stringify({ appleTestFlight: appleStatus(), submitted: false }));
    });
  }
  guard(
    prior.length === 0,
    'This build or version/number already has a submission. Inspect its status; do not resubmit.',
  );
  validateChecks(
    json('gh', [
      'api',
      '--paginate',
      '--slurp',
      `repos/${REPOSITORY}/commits/${CANDIDATE.gitCommitHash}/check-runs?filter=all&per_page=100`,
    ]),
    CANDIDATE.gitCommitHash,
  );
  return withKey(env.ASC_API_KEY_P8, () => {
    const existingAppleBuild = appleStatus();
    if (existingAppleBuild) {
      report(JSON.stringify({ alreadyOnAppStoreConnect: existingAppleBuild, submitted: false }));
      return;
    }
    // Recheck EAS immediately before the only mutation; no retries even on ambiguous failure.
    guard(history().length === 0, 'A submission appeared during preflight. Do not resubmit.');
    report(
      'Submitting the verified existing 1.5.0 (115) build once; no rebuild, OTA, or group changes.',
    );
    let submitSucceeded = false;
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
          CANDIDATE.id,
          '--non-interactive',
          '--wait',
          '--no-auto-testflight-setup',
        ],
        35 * 60 * 1000,
      );
      submitSucceeded = true;
    } catch {
      report('Submission command did not confirm success. Reading status only; no retry.');
    }
    const after = history();
    report(
      JSON.stringify({
        submitCommandSucceeded: submitSucceeded,
        submissionsAfterAttempt: after.map(submissionMetadata),
      }),
    );
    guard(
      after.length === 1 &&
        after[0].status === 'FINISHED' &&
        after[0].submittedBuild?.id === CANDIDATE.id,
      'Submission is failed, pending, or uncertain. Inspect the recorded status; do not retry.',
    );
    // Apple processing may lag EAS upload completion; keep those outcomes separate.
    report(
      'EAS upload finished. Checking Apple processing; this is not App Store review submission.',
    );
    for (let poll = 0; poll < 30; poll += 1) {
      let apple;
      try {
        apple = appleStatus();
      } catch {
        report('Upload finished, but Apple processing could not be verified. No retry.');
        return;
      }
      report(JSON.stringify({ appleTestFlight: apple }));
      if (apple && apple.processingState !== 'PROCESSING') return;
      if (poll < 29) run('sleep', ['30']);
    }
    report(
      'Upload finished; Apple processing is still pending or outside the recent-build window.',
    );
  });
}

if (require.main === module) {
  try {
    if (process.argv[2] === 'cleanup') cleanup();
    else {
      const app = JSON.parse(fs.readFileSync('app.json', 'utf8'));
      const eas = JSON.parse(fs.readFileSync('eas.json', 'utf8'));
      if (process.argv[2] === 'validate') {
        validateInputs(process.env, command('git', ['rev-parse', 'HEAD']).trim(), app, eas);
      } else execute(process.env, app, eas);
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  CANDIDATE,
  validateInputs,
  validateCandidate,
  matchingSubmissions,
  appleCandidate,
  withPrivateKey,
  cleanup,
  execute,
};
