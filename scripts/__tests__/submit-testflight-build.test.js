/* global describe, it, expect, jest, __dirname */
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const {
  CANDIDATE,
  validateInputs,
  validateCandidate,
  matchingSubmissions,
  appleCandidate,
  withPrivateKey,
  execute,
} = require('../submit-testflight-build');
const { REQUIRED_CHECKS } = require('../check-testflight-build');
// 이 레인은 iOS 1.5.0 (115) 후보 전용으로 얼어 있다 — 스크립트의 `'1.5.0'` 가드가 그 계약이다.
// 살아 있는 app.json을 그대로 읽으면 버전 범프(1.5.1, #1310)마다 여기가 깨지므로,
// 실제 설정을 복제하되 버전만 후보 값으로 고정한다.
const app = JSON.parse(JSON.stringify(require('../../app.json')));
app.expo.version = '1.5.0';
const eas = require('../../eas.json');
const toolingSha = 'd'.repeat(40);
const env = {
  GITHUB_ACTIONS: 'true',
  GITHUB_REPOSITORY: 'TripleS-soma/rougether-mobile',
  GITHUB_RUN_ATTEMPT: '1',
  GITHUB_SHA: toolingSha,
  SUBMIT_MODE: 'testflight-submit-only',
  SUBMIT_ACTION: 'submit',
  SUBMIT_PLATFORM: 'ios',
  SUBMIT_AUTHORIZED: 'true',
  EXISTING_BUILD_ID: CANDIDATE.id,
  EXPECTED_SOURCE_SHA: CANDIDATE.gitCommitHash,
  EXPECTED_IOS_BUILD: '115',
  EXPECTED_TOOLING_SHA: toolingSha,
  ASC_API_KEY_P8: 'fake-key-for-injected-test-only',
};
const build = (overrides = {}) => ({
  id: CANDIDATE.id,
  appVersion: '1.5.0',
  appBuildVersion: '115',
  gitCommitHash: CANDIDATE.gitCommitHash,
  runtime: { version: CANDIDATE.runtime },
  app: { id: CANDIDATE.projectId },
  status: 'FINISHED',
  platform: 'IOS',
  distribution: 'STORE',
  buildProfile: 'testflight',
  channel: 'dev',
  ...overrides,
});
const submission = (overrides = {}) => ({
  id: 'c1b97b19-ab12-498e-93c9-1b3ba1af39f6',
  status: 'FINISHED',
  submittedBuild: build(),
  ...overrides,
});
const apple = (entries = []) => ({
  ios: {
    ascAppIdentifier: CANDIDATE.ascAppId,
    testFlightBuilds: entries,
  },
});
const ready = {
  appVersion: '1.5.0',
  buildNumber: '115',
  processingState: 'VALID',
  internalState: 'IN_BETA_TESTING',
  externalState: 'READY_FOR_BETA_SUBMISSION',
  expired: false,
  easBuildId: CANDIDATE.id,
};
const useKey = (_key, work) => work();

function fakeRun(overrides = {}) {
  let submitted = false;
  return jest.fn((file, args) => {
    if (file === 'git') return toolingSha;
    if (file === 'sleep') return '';
    const key = args[0];
    if (key in overrides) return JSON.stringify(overrides[key](args, submitted));
    if (key === 'build:view') return JSON.stringify(build());
    if (key === 'submit:list') return JSON.stringify(submitted ? [submission()] : []);
    if (key === 'submit:status') return JSON.stringify(apple(submitted ? [ready] : []));
    if (key === 'api')
      return JSON.stringify([
        {
          check_runs: REQUIRED_CHECKS.map((name, id) => ({
            name,
            id,
            head_sha: CANDIDATE.gitCommitHash,
            app: { slug: 'github-actions' },
            status: 'completed',
            conclusion: 'success',
          })),
        },
      ]);
    if (key === 'submit') {
      submitted = true;
      return 'PRIVATE CLI OUTPUT';
    }
    throw new Error('Unexpected command');
  });
}

describe('existing TestFlight 115 submission', () => {
  it('keeps tooling SHA distinct from the immutable binary source SHA', () => {
    expect(toolingSha).not.toBe(CANDIDATE.gitCommitHash);
    expect(() => validateInputs(env, toolingSha, app, eas)).not.toThrow();
  });
  it.each([
    ['GITHUB_ACTIONS', 'false'],
    ['GITHUB_REPOSITORY', 'another/repo'],
    ['SUBMIT_MODE', 'production'],
    ['SUBMIT_ACTION', 'build'],
    ['SUBMIT_PLATFORM', 'all'],
    ['SUBMIT_AUTHORIZED', 'false'],
    ['GITHUB_RUN_ATTEMPT', '2'],
    ['EXISTING_BUILD_ID', 'other-build'],
    ['EXPECTED_SOURCE_SHA', toolingSha],
    ['EXPECTED_IOS_BUILD', '116'],
    ['EXPECTED_TOOLING_SHA', CANDIDATE.gitCommitHash],
  ])('rejects unexpected %s before external work', (key, value) => {
    const run = fakeRun();
    expect(() => execute({ ...env, [key]: value }, app, eas, run, jest.fn(), useKey)).toThrow();
    expect(run).toHaveBeenCalledTimes(1);
  });
  it('rejects altered App Store destination or credential profile', () => {
    const changed = JSON.parse(JSON.stringify(eas));
    changed.submit.testflight.ios.ascAppId = 'different-app';
    expect(() => validateInputs(env, toolingSha, app, changed)).toThrow();
  });
  it.each([
    ['id', 'wrong-id'],
    ['appVersion', '1.6.0'],
    ['appBuildVersion', '116'],
    ['gitCommitHash', toolingSha],
    ['runtime', { version: 'wrong-runtime' }],
    ['app', { id: 'other-project' }],
    ['status', 'IN_PROGRESS'],
    ['platform', 'ANDROID'],
    ['distribution', 'INTERNAL'],
    ['buildProfile', 'production'],
    ['channel', 'production'],
  ])('rejects wrong remote candidate %s', (key, value) => {
    expect(() => validateCandidate(build({ [key]: value }))).toThrow();
  });
  it('matches exact ID or version/number even if source/build ID differs', () => {
    const collision = submission({ submittedBuild: build({ id: 'another-id' }) });
    expect(matchingSubmissions([submission(), collision])).toHaveLength(2);
  });
  it.each(['FINISHED', 'ERRORED', 'IN_QUEUE', 'IN_PROGRESS', 'CANCELED'])(
    'never resubmits an existing %s submission',
    (status) => {
      const run = fakeRun({ 'submit:list': () => [submission({ status })] });
      expect(() => execute(env, app, eas, run, jest.fn(), useKey)).toThrow('do not resubmit');
      expect(run.mock.calls.some(([, args]) => args[0] === 'submit')).toBe(false);
    },
  );
  it('inspect rereads Apple state without creating submissions or querying CI', () => {
    const run = fakeRun({
      'submit:list': () => [submission()],
      'submit:status': () => apple([ready]),
    });
    const report = jest.fn();
    execute(
      { ...env, SUBMIT_ACTION: 'inspect', SUBMIT_AUTHORIZED: 'false', GITHUB_RUN_ATTEMPT: '2' },
      app,
      eas,
      run,
      report,
      useKey,
    );
    expect(run.mock.calls.map(([, args]) => args[0])).toEqual([
      'rev-parse',
      'build:view',
      'submit:list',
      'submit:status',
    ]);
    expect(JSON.parse(report.mock.calls.at(-1)[0])).toMatchObject({
      submitted: false,
      appleTestFlight: { processingState: 'VALID' },
    });
  });
  it('does not upload when Apple already has the same version and number', () => {
    const run = fakeRun({ 'submit:status': () => apple([ready]) });
    execute(env, app, eas, run, jest.fn(), useKey);
    expect(run.mock.calls.some(([, args]) => args[0] === 'submit')).toBe(false);
  });
  it('submits only the exact ID once, suppresses CLI output, and verifies upload/Apple separately', () => {
    const run = fakeRun();
    const report = jest.fn();
    execute(env, app, eas, run, report, useKey);
    const submits = run.mock.calls.filter(([, args]) => args[0] === 'submit');
    expect(submits).toHaveLength(1);
    expect(submits[0][1]).toEqual([
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
    ]);
    expect(JSON.stringify(report.mock.calls)).not.toContain('PRIVATE CLI OUTPUT');
    expect(
      run.mock.calls.some(([, args]) => ['build', 'update', 'submit:retry'].includes(args[0])),
    ).toBe(false);
  });
  it('does not retry uncertain submit outcomes', () => {
    const run = fakeRun({
      submit: () => {
        throw new Error('private-log-url-secret');
      },
    });
    const report = jest.fn();
    expect(() => execute(env, app, eas, run, report, useKey)).toThrow('uncertain');
    expect(run.mock.calls.filter(([, args]) => args[0] === 'submit')).toHaveLength(1);
    expect(JSON.stringify(report.mock.calls)).not.toContain('private-log-url-secret');
  });
  it('checks every submission page and fails closed at the history bound', () => {
    const unrelated = submission({
      submittedBuild: build({ id: 'other', appBuildVersion: '113' }),
    });
    const run = fakeRun({
      'submit:list': (args) => (args.at(-1) === '0' ? Array(50).fill(unrelated) : [submission()]),
    });
    expect(() => execute(env, app, eas, run, jest.fn(), useKey)).toThrow('do not resubmit');
    expect(run.mock.calls.filter(([, args]) => args[0] === 'submit:list')).toHaveLength(2);
    const truncated = fakeRun({ 'submit:list': () => Array(50).fill(unrelated) });
    expect(() => execute(env, app, eas, truncated, jest.fn(), useKey)).toThrow('truncated');
  });
  it('reports Apple processing still pending without uploading again', () => {
    const run = fakeRun({
      'submit:status': (_args, submitted) =>
        apple(submitted ? [{ ...ready, processingState: 'PROCESSING' }] : []),
    });
    const report = jest.fn();
    execute(env, app, eas, run, report, useKey);
    expect(run.mock.calls.filter(([, args]) => args[0] === 'submit')).toHaveLength(1);
    expect(run.mock.calls.filter(([file]) => file === 'sleep')).toHaveLength(29);
    expect(report.mock.calls.at(-1)[0]).toContain('still pending');
  });
  it('allowlists Apple response and rejects a different app', () => {
    expect(
      appleCandidate(apple([{ ...ready, privateKey: 'secret', logUrl: 'https://secret' }])),
    ).toEqual({
      ...ready,
      easSubmissionId: null,
    });
    expect(() =>
      appleCandidate({ ios: { ascAppIdentifier: 'wrong-app', testFlightBuilds: [] } }),
    ).toThrow();
  });
});

describe('temporary ASC private key', () => {
  const parser = () => ({ asymmetricKeyType: 'ec' });
  it('uses exclusive 0600 creation and cleanup on success', () => {
    const io = { writeFileSync: jest.fn(), rmSync: jest.fn() };
    withPrivateKey('test-placeholder', () => {}, io, parser);
    expect(io.writeFileSync).toHaveBeenCalledWith('asc-api-key.p8', 'test-placeholder', {
      flag: 'wx',
      mode: 0o600,
    });
    expect(io.rmSync).toHaveBeenCalledWith('asc-api-key.p8', { force: true });
  });
  it('cleans up on submission failure and does not overwrite an existing key', () => {
    const io = { writeFileSync: jest.fn(), rmSync: jest.fn() };
    expect(() =>
      withPrivateKey(
        'test-placeholder',
        () => {
          throw new Error('failure');
        },
        io,
        parser,
      ),
    ).toThrow();
    expect(io.rmSync).toHaveBeenCalledTimes(1);
    io.writeFileSync.mockImplementation(() => {
      throw new Error('exists');
    });
    expect(() => withPrivateKey('test-placeholder', () => {}, io, parser)).toThrow('exists');
    expect(io.rmSync).toHaveBeenCalledTimes(1);
  });
  it('rejects invalid keys without writing or printing their contents', () => {
    const io = { writeFileSync: jest.fn(), rmSync: jest.fn() };
    expect(() =>
      withPrivateKey(
        'sensitive-placeholder',
        () => {},
        io,
        () => {
          throw new Error('sensitive-placeholder');
        },
      ),
    ).toThrow('private key is invalid');
    expect(io.writeFileSync).not.toHaveBeenCalled();
  });
});

describe('submit-only workflow boundary', () => {
  const workflow = yaml.load(
    fs.readFileSync(path.join(__dirname, '../../.github/workflows/store-build.yml'), 'utf8'),
  );
  it('keeps defaults safe and existing lanes separate', () => {
    expect(workflow.on.workflow_dispatch.inputs.mode.default).toBe('production');
    expect(workflow.on.workflow_dispatch.inputs.action.default).toBe('inspect');
    expect(workflow.on.workflow_dispatch.inputs.submit.default).toBe(false);
    expect(workflow.jobs.build.if).toBe("inputs.mode == 'production' || inputs.mode == ''");
    expect(workflow.jobs['testflight-build-only'].if).toBe(
      "inputs.mode == 'testflight-build-only'",
    );
  });
  it('pins the verified CLI, serializes the dev lane, and always removes the private key', () => {
    const lane = workflow.jobs['testflight-submit-only'];
    expect(lane.concurrency).toEqual({ group: 'eas-deploy-dev', 'cancel-in-progress': false });
    expect(
      lane.steps.find((step) => step.uses === 'expo/expo-github-action@v8').with['eas-version'],
    ).toBe('23.2.0');
    expect(lane.steps.at(-1)).toMatchObject({
      if: 'always()',
      run: 'node scripts/submit-testflight-build.js cleanup',
    });
    expect(JSON.stringify(lane)).not.toMatch(/upload-artifact|eas build |eas update /);
  });
});
