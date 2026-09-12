/* global describe, it, expect, jest, __dirname */
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const {
  REQUIRED_CHECKS,
  validateConfiguration,
  validateChecks,
  nextBuildNumber,
  sanitizeBuild,
  validateHistory,
  execute,
} = require('../check-testflight-build');

const sha = 'a'.repeat(40);
const fingerprint = 'b'.repeat(40);
const env = {
  BUILD_MODE: 'testflight-build-only',
  BUILD_ACTION: 'inspect',
  BUILD_PLATFORM: 'ios',
  BUILD_SUBMIT: 'false',
  EXPECTED_SOURCE_SHA: sha,
  GITHUB_SHA: sha,
  GITHUB_REPOSITORY: 'TripleS-soma/rougether-mobile',
};
// 이 레인은 iOS 1.5.0 (115) 후보 전용으로 얼어 있다 — 스크립트의 `'1.5.0'` 가드가 그 계약이다.
// 살아 있는 app.json을 그대로 읽으면 버전 범프(1.5.1, #1310)마다 여기가 깨지므로,
// 실제 설정을 복제하되 버전만 후보 값으로 고정한다.
const app = JSON.parse(JSON.stringify(require('../../app.json')));
app.expo.version = '1.5.0';
const eas = require('../../eas.json');
const checks = () => [
  {
    check_runs: REQUIRED_CHECKS.map((name, id) => ({
      name,
      id,
      head_sha: sha,
      app: { slug: 'github-actions' },
      status: 'completed',
      conclusion: 'success',
    })),
  },
];
const build = (overrides = {}) => ({
  id: 'a95c3db8-b3d8-43f1-98b5-b8ee10a6b624',
  status: 'FINISHED',
  platform: 'IOS',
  distribution: 'STORE',
  appVersion: '1.5.0',
  appBuildVersion: '116',
  gitCommitHash: sha,
  runtime: { version: fingerprint },
  buildProfile: 'testflight',
  channel: 'dev',
  ...overrides,
});

function fakeRun(overrides = {}) {
  return jest.fn((file, args) => {
    const key = file === 'git' ? 'git' : file === 'npx' ? 'fingerprint:generate' : args[0];
    let value;
    if (key in overrides) value = overrides[key](args);
    else if (key === 'git') return sha;
    else if (key === 'api') value = checks();
    else if (key === 'build:version:get') value = { buildNumber: '115' };
    else if (key === 'fingerprint:generate') value = { hash: fingerprint };
    else if (key === 'build:list') value = [];
    else if (key === 'build') value = [build({ status: 'IN_QUEUE' })];
    else if (key === 'build:view') value = build();
    else if (file === 'sleep') return '';
    else throw new Error('Unexpected command in test');
    return JSON.stringify(value);
  });
}

describe('testflight build-only guards', () => {
  it('accepts the designated app/profile without changing production config', () => {
    expect(() => validateConfiguration(env, sha, app, eas)).not.toThrow();
  });

  it.each([
    ['BUILD_MODE', 'production'],
    ['BUILD_ACTION', 'submit'],
    ['BUILD_PLATFORM', 'all'],
    ['BUILD_SUBMIT', 'true'],
    ['EXPECTED_SOURCE_SHA', 'bad-sha'],
    ['GITHUB_SHA', 'c'.repeat(40)],
    ['GITHUB_REPOSITORY', 'other/repo'],
  ])('rejects invalid %s before any service request', (key, value) => {
    const run = fakeRun();
    expect(() => execute({ ...env, [key]: value }, app, eas, run)).toThrow();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('rejects a checkout that differs from the explicitly dispatched SHA', () => {
    expect(() => validateConfiguration(env, 'c'.repeat(40), app, eas)).toThrow('checkout HEAD');
  });

  it.each(['version', 'project', 'runtime', 'channel', 'environment', 'increment', 'distribution'])(
    'rejects drift in %s',
    (field) => {
      const changedApp = JSON.parse(JSON.stringify(app));
      const changedEas = JSON.parse(JSON.stringify(eas));
      if (field === 'version') changedApp.expo.version = '1.6.0';
      if (field === 'project') changedApp.expo.extra.eas.projectId = 'other';
      if (field === 'runtime') changedApp.expo.runtimeVersion.policy = 'appVersion';
      if (field === 'channel') changedEas.build.testflight.channel = 'production';
      if (field === 'environment') changedEas.build.testflight.environment = 'production';
      if (field === 'increment') changedEas.build.testflight.autoIncrement = false;
      if (field === 'distribution') changedEas.build.testflight.ios.distribution = 'internal';
      expect(() => validateConfiguration(env, sha, changedApp, changedEas)).toThrow();
    },
  );

  it.each(['missing', 'pending', 'failure', 'wrong-sha', 'wrong-app', 'newer-pending'])(
    'fails closed on %s CI evidence',
    (problem) => {
      const pages = checks();
      const first = pages[0].check_runs[0];
      if (problem === 'missing') pages[0].check_runs.shift();
      if (problem === 'pending') first.status = 'in_progress';
      if (problem === 'failure') first.conclusion = 'failure';
      if (problem === 'wrong-sha') first.head_sha = 'c'.repeat(40);
      if (problem === 'wrong-app') first.app.slug = 'external-service';
      if (problem === 'newer-pending') {
        pages.push({ check_runs: [{ ...first, id: 99, status: 'in_progress' }] });
      }
      expect(() => validateChecks(pages, sha)).toThrow();
    },
  );

  it('uses the remote counter without resetting or pinning a number', () => {
    expect(nextBuildNumber({ buildNumber: '115' })).toBe(116);
    expect(() => nextBuildNumber({ buildNumber: '115' }, '115')).toThrow();
    expect(() => nextBuildNumber({ buildNumber: null })).toThrow();
    expect(() => nextBuildNumber({ buildNumber: 'NaN' })).toThrow();
  });

  it.each(['FINISHED', 'ERRORED', 'IN_QUEUE', 'IN_PROGRESS', 'NEW', 'PENDING', 'UNKNOWN'])(
    'refuses a matching %s build instead of consuming another build',
    (status) => {
      expect(() => validateHistory([build({ status })], fingerprint)).toThrow();
    },
  );

  it('allows a confirmed cancellation but rejects truncated or malformed history', () => {
    expect(() => validateHistory([build({ status: 'CANCELED' })], fingerprint)).not.toThrow();
    expect(() => validateHistory(null, fingerprint)).toThrow();
    expect(() =>
      validateHistory(Array(50).fill(build({ status: 'CANCELED' })), fingerprint),
    ).toThrow();
  });

  it('drops URLs, errors, actors, keys and non-scalar values from metadata', () => {
    const output = JSON.stringify(
      sanitizeBuild(
        build({
          artifacts: { buildUrl: 'https://private-artifact.example/secret' },
          error: { message: 'secret' },
          initiatingActor: { displayName: 'private-user' },
          privateKey: 'secret',
          channel: 'https://private.example/secret',
        }),
      ),
    );
    expect(output).not.toMatch(/https|secret|private-user|artifacts|privateKey|error/);
  });

  it('inspect works with pending CI and makes no remote mutation', () => {
    const run = fakeRun({
      api: () => {
        throw new Error('CI must not be queried');
      },
    });
    const report = jest.fn();
    execute(env, app, eas, run, report);
    expect(run.mock.calls.filter(([file]) => file === 'eas').map(([, args]) => args[0])).toEqual([
      'build:list',
      'build:version:get',
    ]);
    expect(run).toHaveBeenCalledWith(
      'npx',
      expect.arrayContaining(['--no-install', 'expo-updates']),
      undefined,
    );
    expect(JSON.parse(report.mock.calls[0][0])).toMatchObject({
      currentIosBuild: 115,
      expectedNextIosBuild: 116,
      fingerprintSource: 'local',
    });
  });

  it('builds once, reports queued ID immediately, and waits for finished metadata', () => {
    const run = fakeRun();
    const report = jest.fn();
    execute({ ...env, BUILD_ACTION: 'build' }, app, eas, run, report);
    const creation = run.mock.calls.filter(([file, args]) => file === 'eas' && args[0] === 'build');
    expect(creation).toHaveLength(1);
    expect(creation[0][1]).toEqual(
      expect.arrayContaining(['--profile', 'testflight', '--no-wait', '--freeze-credentials']),
    );
    const commands = JSON.stringify(run.mock.calls);
    expect(commands).not.toMatch(/auto-submit|build:submit|build:version:set|update/);
    expect(run.mock.calls.some(([, args]) => args[0] === 'credentials')).toBe(false);
    const candidates = report.mock.calls
      .map(([text]) => text)
      .filter((text) => text.includes('candidateIos'));
    expect(candidates).toHaveLength(2);
    expect(JSON.parse(candidates[0]).candidateIos.status).toBe('IN_QUEUE');
    expect(JSON.parse(candidates[1]).candidateIos.status).toBe('FINISHED');
  });

  it.each(['ci', 'history', 'train', 'old-counter', 'counter-drift'])(
    'never creates a build when %s guard fails',
    (problem) => {
      let counterQueries = 0;
      const run = fakeRun({
        api: () => (problem === 'ci' ? [] : checks()),
        'build:version:get': () => ({
          buildNumber:
            problem === 'old-counter'
              ? '113'
              : problem === 'counter-drift' && counterQueries++ > 0
                ? '116'
                : '115',
        }),
        'build:list': (args) => {
          if (problem === 'history' && args.includes('--fingerprint-hash')) return [build()];
          if (problem === 'train' && args.includes('production')) return [build()];
          return [];
        },
      });
      expect(() => execute({ ...env, BUILD_ACTION: 'build' }, app, eas, run, jest.fn())).toThrow();
      expect(run.mock.calls.some(([, args]) => args[0] === 'build')).toBe(false);
    },
  );

  it('does not mark an errored candidate as success or automatically retry it', () => {
    const run = fakeRun({ 'build:view': () => build({ status: 'ERRORED' }) });
    expect(() => execute({ ...env, BUILD_ACTION: 'build' }, app, eas, run, jest.fn())).toThrow(
      'do not retry',
    );
    expect(run.mock.calls.filter(([, args]) => args[0] === 'build')).toHaveLength(1);
  });
});

describe('store-build workflow boundaries', () => {
  const workflow = yaml.load(
    fs.readFileSync(path.join(__dirname, '../../.github/workflows/store-build.yml'), 'utf8'),
  );
  it('preserves default production routing, main guard, and explicit submission behavior', () => {
    expect(workflow.on.workflow_dispatch.inputs.mode.default).toBe('production');
    expect(workflow.on.workflow_dispatch.inputs.submit.default).toBe(false);
    const production = workflow.jobs.build;
    expect(production.if).toBe("inputs.mode == 'production' || inputs.mode == ''");
    expect(production.steps[0].if).toBe("github.ref != 'refs/heads/main'");
    expect(JSON.stringify(production)).toContain('--auto-submit-with-profile production');
    expect(JSON.stringify(production)).not.toContain('testflight');
  });

  it('uses read-only permissions, shared dev lock, and no ASC credentials for the separate lane', () => {
    const lane = workflow.jobs['testflight-build-only'];
    expect(workflow.on.workflow_dispatch.inputs.action.default).toBe('inspect');
    expect(lane.permissions).toEqual({ contents: 'read', actions: 'read', checks: 'read' });
    expect(lane.concurrency).toEqual({ group: 'eas-deploy-dev', 'cancel-in-progress': false });
    expect(lane['timeout-minutes']).toBe(90);
    expect(JSON.stringify(lane)).not.toMatch(/ASC_API_KEY|asc-api-key|eas update|auto-submit/);
  });

  it('tests and builds the exact candidate head instead of a moving PR merge ref', () => {
    const smoke = yaml.load(
      fs.readFileSync(
        path.join(__dirname, '../../.github/workflows/ios-release-smoke.yml'),
        'utf8',
      ),
    ).jobs['release-smoke'];
    const head = '${{ github.event.pull_request.head.sha }}';
    expect(smoke.steps[0].with.ref).toBe(head);
    expect(smoke.env.CANDIDATE_SOURCE_SHA).toBe(head);
    const verificationIndex = smoke.steps.findIndex(
      (step) => step.name === 'Verify and test candidate source',
    );
    const prepareIndex = smoke.steps.findIndex(
      (step) => step.name === 'Prepare Release native project',
    );
    expect(verificationIndex).toBeGreaterThan(0);
    expect(verificationIndex).toBeLessThan(prepareIndex);
    const verification = smoke.steps[verificationIndex];
    expect(verification['timeout-minutes']).toBe(5);
    expect(verification.run).toContain('source-sha.txt');
    expect(verification.run).toContain('= "$CANDIDATE_SOURCE_SHA"');
    expect(verification.run).toContain('npm run typecheck');
    expect(verification.run).toContain('npm test -- --ci');
    expect(verification.run).toContain('--forceExit');
    expect(verification['continue-on-error']).toBeUndefined();
  });
});
