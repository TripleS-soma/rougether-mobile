/* global describe, it, expect, jest, __dirname */
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { execute, candidateFromInputs, validateBuild } = require('../submit-current-testflight');
const { REQUIRED_CHECKS } = require('../check-testflight-build');
const app = require('../../app.json');
const eas = require('../../eas.json');
const source = 'a'.repeat(40);
const tooling = 'b'.repeat(40);
const runtime = 'c'.repeat(40);
const id = '11111111-2222-4333-8444-555555555555';
const env = {
  GITHUB_ACTIONS: 'true',
  GITHUB_REPOSITORY: 'TripleS-soma/rougether-mobile',
  GITHUB_RUN_ATTEMPT: '1',
  GITHUB_SHA: tooling,
  EXPECTED_TOOLING_SHA: tooling,
  SUBMIT_MODE: 'testflight-current-submit',
  SUBMIT_ACTION: 'submit',
  SUBMIT_PLATFORM: 'ios',
  SUBMIT_AUTHORIZED: 'true',
  EXISTING_BUILD_ID: id,
  EXPECTED_SOURCE_SHA: source,
  EXPECTED_APP_VERSION: app.expo.version,
  EXPECTED_IOS_BUILD: '130',
  EXPECTED_IOS_RUNTIME: runtime,
  ASC_API_KEY_P8: 'injected-test-key',
};
const build = {
  id,
  status: 'FINISHED',
  platform: 'IOS',
  distribution: 'STORE',
  app: { id: app.expo.extra.eas.projectId },
  appVersion: app.expo.version,
  appBuildVersion: '130',
  gitCommitHash: source,
  runtime: { version: runtime },
  buildProfile: 'testflight',
  channel: 'internal',
};
const apple = (present = false, processingState = 'VALID') => ({
  ios: {
    ascAppIdentifier: eas.submit.testflight.ios.ascAppId,
    testFlightBuilds: present
      ? [
          {
            appVersion: app.expo.version,
            buildNumber: '130',
            processingState,
            internalState: 'IN_BETA_TESTING',
            externalState: 'READY_FOR_BETA_SUBMISSION',
            expired: false,
          },
        ]
      : [],
  },
});
function setup({
  existing = [],
  appleBefore = false,
  uploadThrows = false,
  pending = false,
  wrongBuild = {},
  appleProcessingState = 'VALID',
} = {}) {
  let submitted = false;
  const run = jest.fn((file, args) => {
    if (file === 'git') return tooling;
    if (file === 'sleep') return '';
    if (file === 'gh')
      return JSON.stringify([
        {
          check_runs: REQUIRED_CHECKS.map((name, i) => ({
            name,
            id: i,
            head_sha: source,
            app: { slug: 'github-actions' },
            status: 'completed',
            conclusion: 'success',
          })),
        },
      ]);
    if (args[0] === 'build:view') return JSON.stringify({ ...build, ...wrongBuild });
    if (args[0] === 'submit:list')
      return JSON.stringify(
        submitted
          ? [
              {
                id: 'submission-id',
                status: pending ? 'IN_PROGRESS' : 'FINISHED',
                submittedBuild: build,
              },
            ]
          : existing,
      );
    if (args[0] === 'submit:status')
      return JSON.stringify(apple(appleBefore || submitted, appleProcessingState));
    if (args[0] === 'submit') {
      submitted = true;
      if (uploadThrows) throw new Error('PRIVATE SERVICE DETAIL');
      return 'PRIVATE SERVICE DETAIL';
    }
    throw new Error('Unexpected command');
  });
  const report = jest.fn();
  const useKey = jest.fn((_key, action) => action());
  return {
    run,
    report,
    useKey,
    execute: (override = {}) => execute({ ...env, ...override }, app, eas, run, report, useKey),
  };
}
function submitCalls(run) {
  return run.mock.calls.filter(([file, args]) => file === 'eas' && args[0] === 'submit');
}

describe('current TestFlight candidate submission', () => {
  it.each([
    ['SUBMIT_AUTHORIZED', 'false'],
    ['GITHUB_RUN_ATTEMPT', '2'],
    ['EXPECTED_SOURCE_SHA', 'bad'],
    ['EXPECTED_TOOLING_SHA', source],
    ['EXPECTED_APP_VERSION', '1.5.0'],
    ['EXPECTED_IOS_RUNTIME', 'bad'],
    ['EXISTING_BUILD_ID', 'bad'],
    ['SUBMIT_PLATFORM', 'all'],
  ])('rejects mismatched %s before accessing submission credentials', (key, value) => {
    const f = setup();
    expect(() => f.execute({ [key]: value })).toThrow();
    expect(submitCalls(f.run)).toHaveLength(0);
    expect(f.useKey).not.toHaveBeenCalled();
  });
  it.each([
    { gitCommitHash: tooling },
    { runtime: { version: 'd'.repeat(40) } },
    { channel: 'production' },
    { status: 'IN_PROGRESS' },
    { appBuildVersion: '131' },
    { app: { id: 'another-app' } },
  ])('rejects a binary whose provenance differs from the exact candidate', (wrongBuild) => {
    const f = setup({ wrongBuild });
    expect(() => f.execute()).toThrow();
    expect(submitCalls(f.run)).toHaveLength(0);
    expect(f.useKey).not.toHaveBeenCalled();
  });
  it('uses the exact ID once and verifies Apple after upload without leaking private CLI output', () => {
    const f = setup();
    f.execute();
    expect(submitCalls(f.run)).toHaveLength(1);
    const args = submitCalls(f.run)[0][1];
    expect(args[args.indexOf('--id') + 1]).toBe(id);
    expect(args).toContain('--no-auto-testflight-setup');
    const reports = JSON.stringify(f.report.mock.calls);
    expect(reports).toContain('IN_BETA_TESTING');
    expect(reports).not.toContain('PRIVATE SERVICE DETAIL');
    expect(reports).not.toContain(env.ASC_API_KEY_P8);
  });
  it('does not resubmit when Apple already has the version and build', () => {
    const f = setup({ appleBefore: true });
    f.execute();
    expect(submitCalls(f.run)).toHaveLength(0);
  });
  it('refuses a pre-existing failed or pending submission rather than retrying', () => {
    const f = setup({ existing: [{ status: 'ERRORED', submittedBuild: build }] });
    expect(() => f.execute()).toThrow(/already exists/);
    expect(submitCalls(f.run)).toHaveLength(0);
  });
  it('inspects a current candidate without publishing', () => {
    const f = setup();
    f.execute({ SUBMIT_ACTION: 'inspect', SUBMIT_AUTHORIZED: 'false' });
    expect(submitCalls(f.run)).toHaveLength(0);
  });
  it('reads status after an uncertain CLI result and never calls submit twice', () => {
    const f = setup({ uploadThrows: true });
    f.execute();
    expect(submitCalls(f.run)).toHaveLength(1);
    expect(JSON.stringify(f.report.mock.calls)).toContain('appleTestFlight');
  });
  it('fails a pending uncertain upload without a second mutation', () => {
    const f = setup({ uploadThrows: true, pending: true });
    expect(() => f.execute()).toThrow(/uncertain/);
    expect(submitCalls(f.run)).toHaveLength(1);
  });
  it('does not report an Apple-rejected upload as ready', () => {
    const f = setup({ appleProcessingState: 'INVALID' });
    expect(() => f.execute()).toThrow(/did not yield a valid/);
    expect(submitCalls(f.run)).toHaveLength(1);
  });
  it('does not accept a submission profile targeting a different destination', () => {
    const changed = JSON.parse(JSON.stringify(eas));
    changed.submit.testflight.ios.ascAppId = 'other';
    expect(() => candidateFromInputs(env, tooling, app, changed)).toThrow();
    const candidate = candidateFromInputs(env, tooling, app, eas);
    expect(() => validateBuild({ ...build, channel: 'dev' }, candidate)).toThrow();
  });
});

it('keeps production and the frozen 115 lane separate from the opt-in current candidate job', () => {
  const w = yaml.load(
    fs.readFileSync(path.join(__dirname, '../../.github/workflows/store-build.yml'), 'utf8'),
  );
  expect(w.on.workflow_dispatch.inputs.mode.default).toBe('production');
  expect(w.on.workflow_dispatch.inputs.submit.default).toBe(false);
  expect(Object.keys(w.on.workflow_dispatch.inputs).length).toBeLessThanOrEqual(10);
  const lane = w.jobs['testflight-current-submit'];
  expect(lane.if).toBe("inputs.mode == 'testflight-current-submit'");
  expect(lane.concurrency.group).toBe('eas-deploy-dev');
  expect(lane.steps.at(-1)).toMatchObject({
    if: 'always()',
    run: 'node scripts/submit-current-testflight.js cleanup',
  });
  expect(
    w.jobs['testflight-submit-only'].steps.some(
      (s) => s.run === 'node scripts/submit-testflight-build.js',
    ),
  ).toBe(true);
});
