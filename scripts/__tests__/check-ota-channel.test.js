/* global describe, it, expect, jest, __dirname */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const vm = require('node:vm');
const yaml = require('js-yaml');
const { validateChannelMapping, execute } = require('../check-ota-channel');

const response = (name = 'dev', overrides = {}) => ({
  currentPage: {
    name,
    isPaused: false,
    branchMapping: JSON.stringify({
      version: 0,
      data: [{ branchId: 'branch-id', branchMappingLogic: 'true' }],
    }),
    updateBranches: [{ id: 'branch-id', name, updateGroups: ['private-metadata'] }],
    ...overrides,
  },
});

describe('OTA channel mapping guard', () => {
  it.each(['dev', 'production'])(
    'accepts the active %s channel pointing only at itself',
    (name) => {
      expect(validateChannelMapping(response(name), name)).toBe(true);
    },
  );

  it.each([undefined, '', 'preview', 'dev; echo private'])(
    'rejects unsupported target %s',
    (name) => {
      const run = jest.fn();
      expect(() => execute(name, run)).toThrow('OTA channel mapping verification failed.');
      expect(run).not.toHaveBeenCalled();
      expect(validateChannelMapping(response(name), name)).toBe(false);
    },
  );

  it.each([null, {}, [], { currentPage: null }, { currentPage: [] }])(
    'rejects malformed channel responses: %j',
    (value) => expect(validateChannelMapping(value, 'dev')).toBe(false),
  );

  it.each([
    ['wrong channel', { name: 'production' }],
    ['paused channel', { isPaused: true }],
    ['unknown pause state', { isPaused: undefined }],
    ['missing mapping', { branchMapping: undefined }],
    ['malformed mapping', { branchMapping: 'private invalid json' }],
    ['null mapping', { branchMapping: 'null' }],
    ['missing mapping data', { branchMapping: '{"version":0}' }],
    ['missing branches', { updateBranches: undefined }],
    ['empty branches', { updateBranches: [] }],
    ['null branch', { updateBranches: [null] }],
    ['wrong branch', { updateBranches: [{ id: 'branch-id', name: 'production' }] }],
    ['mismatched branch id', { updateBranches: [{ id: 'another-id', name: 'dev' }] }],
    ['missing branch id', { updateBranches: [{ name: 'dev' }] }],
    ['empty branch id', { updateBranches: [{ id: '', name: 'dev' }] }],
    ['duplicate branches', { updateBranches: Array(2).fill({ id: 'branch-id', name: 'dev' }) }],
  ])('rejects %s', (_, overrides) => {
    expect(validateChannelMapping(response('dev', overrides), 'dev')).toBe(false);
  });

  it.each([
    { version: 1, data: [{ branchId: 'branch-id', branchMappingLogic: 'true' }] },
    { version: 0, data: [] },
    { version: 0, data: [null] },
    { version: 0, data: [{ branchId: 'branch-id', branchMappingLogic: true }] },
    { version: 0, data: [{ branchId: 'branch-id', branchMappingLogic: ['or', 'true'] }] },
    { version: 0, data: Array(2).fill({ branchId: 'branch-id', branchMappingLogic: 'true' }) },
  ])('rejects non-standard or rollout mapping: %j', (mapping) => {
    expect(
      validateChannelMapping(response('dev', { branchMapping: JSON.stringify(mapping) }), 'dev'),
    ).toBe(false);
  });

  it('makes one read-only query with captured output and returns only the allowlisted name', () => {
    const run = jest.fn(() => ({ status: 0, stdout: JSON.stringify(response()), stderr: '' }));
    expect(execute('dev', run)).toBe('dev');
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith(
      'eas',
      ['channel:view', 'dev', '--json', '--non-interactive'],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 60000,
        maxBuffer: 4 * 1024 * 1024,
      },
    );
  });

  it.each([
    { status: 1, stdout: 'private response', stderr: 'private error' },
    { status: null, error: new Error('private timeout') },
    { status: 0, stdout: 'private invalid json' },
    { status: 0, stdout: JSON.stringify(response('production')) },
  ])('fails closed without exposing failed CLI output: %j', (result) => {
    expect(() => execute('dev', () => result)).toThrow('OTA channel mapping verification failed.');
  });

  it('sanitizes an exception from the CLI runner', () => {
    expect(() =>
      execute('dev', () => {
        throw new Error('private runner failure');
      }),
    ).toThrow('OTA channel mapping verification failed.');
  });

  it('the real CLI wrapper fails before querying EAS when the target is missing', () => {
    const result = spawnSync(process.execPath, [path.join(__dirname, '../check-ota-channel.js')], {
      encoding: 'utf8',
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('OTA channel mapping verification failed.\n');
  });

  it.each([true, false])('the CLI wrapper only emits sanitized output (success=%s)', (success) => {
    const entry = { exports: {} };
    const run = jest.fn(() => ({
      status: success ? 0 : 1,
      stdout: JSON.stringify(response()),
      stderr: 'private CLI error',
    }));
    const requireMock = Object.assign(() => ({ spawnSync: run }), { main: entry });
    const output = { log: jest.fn(), error: jest.fn() };
    const runtime = { argv: ['node', 'guard', 'dev'], exitCode: 0 };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../check-ota-channel.js'), 'utf8'), {
      require: requireMock,
      module: entry,
      console: output,
      process: runtime,
    });
    expect(runtime.exitCode).toBe(success ? 0 : 1);
    expect(output.log.mock.calls).toEqual(success ? [['channelMappingVerified=dev']] : []);
    expect(output.error.mock.calls).toEqual(
      success ? [] : [['OTA channel mapping verification failed.']],
    );
  });
});

describe('hotfix OTA workflow wiring', () => {
  const workflow = yaml.load(
    fs.readFileSync(path.join(__dirname, '../../.github/workflows/hotfix-ota.yml'), 'utf8'),
  );
  const { steps, env } = workflow.jobs.publish;
  const publishIndex = steps.findIndex((step) => step.run?.includes('eas update --branch'));
  const guardIndex = steps.findIndex((step) => step.run?.includes('scripts/check-ota-channel.js'));

  it('pins the verified CLI and chooses the native build environment for each target', () => {
    expect(
      steps.find((step) => step.uses === 'expo/expo-github-action@v8').with['eas-version'],
    ).toBe('23.2.0');
    expect(env.OTA_CHANNEL).toBe('${{ inputs.channel }}');
    expect(env.OTA_ENVIRONMENT).toBe("${{ inputs.channel == 'dev' && 'preview' || 'production' }}");
    expect(steps[publishIndex].run).toContain('--environment "$OTA_ENVIRONMENT"');
  });

  it('requires the authenticated channel guard before publishing without a failure bypass', () => {
    expect(guardIndex).toBeGreaterThan(-1);
    expect(guardIndex).toBeLessThan(publishIndex);
    expect(steps[guardIndex].env.EXPO_TOKEN).toBe('${{ secrets.EXPO_TOKEN }}');
    expect(steps[guardIndex].run).toBe('node scripts/check-ota-channel.js "$OTA_CHANNEL"');
    expect(steps[guardIndex]['continue-on-error']).toBeUndefined();
    expect(steps[guardIndex].if).toBeUndefined();
    expect(steps[publishIndex].if).toBeUndefined();
    expect(steps[publishIndex].run).toContain('--branch "$OTA_CHANNEL"');
  });

  it('passes the free-form runtime through the environment without shell interpolation', () => {
    const fingerprint = steps.find((step) => step.name === '지문 대조');
    expect(fingerprint.env.EXPECTED_RUNTIME).toBe('${{ inputs.expected_runtime }}');
    expect(fingerprint.run).toContain('expected="$EXPECTED_RUNTIME"');
    expect(fingerprint.run).not.toContain('${{ inputs.expected_runtime }}');
  });
});
