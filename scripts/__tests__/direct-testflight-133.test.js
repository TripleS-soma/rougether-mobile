/* global it, expect, jest, __dirname */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const yaml = require('js-yaml');
const { generateKeyPairSync } = require('node:crypto');
const {
  PIN,
  SUBMISSION,
  validateInputs,
  validateSubmission,
  validateIpa,
  appleBuild,
  execute,
} = require('../direct-testflight-133');
const { REQUIRED_CHECKS } = require('../check-testflight-build');
const app = require('../../app.json');
const eas = require('../../eas.json');
const tooling = 'b'.repeat(40);
const key = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey.export({
  type: 'pkcs8',
  format: 'pem',
});
const env = {
  GITHUB_ACTIONS: 'true',
  GITHUB_REPOSITORY: 'TripleS-soma/rougether-mobile',
  GITHUB_SHA: tooling,
  EXPECTED_TOOLING_SHA: tooling,
  GITHUB_RUN_ATTEMPT: '1',
  DIRECT_ACTION: 'inspect',
  SUBMIT_PLATFORM: 'ios',
  SUBMIT_AUTHORIZED: 'false',
  EXISTING_BUILD_ID: PIN.id,
  EXPECTED_SOURCE_SHA: PIN.source,
  EXPECTED_APP_VERSION: PIN.version,
  EXPECTED_IOS_BUILD: PIN.number,
  EXPECTED_IOS_RUNTIME: PIN.runtime,
  EXPECTED_SUBMISSION_ID: SUBMISSION,
  ASC_API_KEY_P8: key,
};
const info = {
  bundle: 'com.triples.rougether',
  version: '1.5.5',
  number: '133',
  widgetBundle: 'com.triples.rougether.widget',
  widgetVersion: '1.5.5',
  widgetNumber: '133',
};
const submission = (status) => ({
  id: SUBMISSION,
  status,
  platform: 'IOS',
  submittedBuild: { id: PIN.id },
  iosConfig: { ascAppIdentifier: '6793513720' },
});
it('only accepts the original 133 source/runtime and explicit first-attempt delivery', () => {
  expect(validateInputs(env, tooling, app, eas)).toEqual(PIN);
  for (const patch of [
    { EXPECTED_IOS_BUILD: '134' },
    { EXPECTED_SOURCE_SHA: 'c'.repeat(40) },
    { EXPECTED_IOS_RUNTIME: 'c'.repeat(40) },
    { EXPECTED_SUBMISSION_ID: 'another-submission' },
    { DIRECT_ACTION: 'upload' },
  ])
    expect(() => validateInputs({ ...env, ...patch }, tooling, app, eas)).toThrow();
  expect(() =>
    validateInputs(
      { ...env, DIRECT_ACTION: 'upload', SUBMIT_AUTHORIZED: 'true', GITHUB_RUN_ATTEMPT: '2' },
      tooling,
      app,
      eas,
    ),
  ).toThrow();
});
it('refuses other submissions and non-queued states before cancellation', () => {
  expect(() => validateSubmission(submission('IN_QUEUE'), ['IN_QUEUE'])).not.toThrow();
  for (const status of ['IN_PROGRESS', 'FINISHED', 'ERRORED', 'CANCELED'])
    expect(() => validateSubmission(submission(status), ['IN_QUEUE'])).toThrow();
  expect(() =>
    validateSubmission({ ...submission('IN_QUEUE'), submittedBuild: { id: 'another-build' } }, [
      'IN_QUEUE',
    ]),
  ).toThrow();
});
it('validates the signed app and widget versions together', () => {
  expect(() => validateIpa(info)).not.toThrow();
  for (const field of Object.keys(info))
    expect(() => validateIpa({ ...info, [field]: 'changed' })).toThrow();
});
it('requires version-train proof and never mistakes a partial Apple response for absence', () => {
  expect(appleBuild({ data: [] })).toBeNull();
  expect(() => appleBuild({ data: [{ attributes: { version: '133' } }] })).toThrow();
  const result = {
    data: [
      {
        id: '11111111-2222-4333-8444-555555555555',
        attributes: { version: '133', processingState: 'VALID', expired: false },
        relationships: { preReleaseVersion: { data: { id: 'train' } } },
      },
    ],
    included: [{ type: 'preReleaseVersions', id: 'train', attributes: { version: '1.5.5' } }],
  };
  expect(appleBuild(result)).toMatchObject({
    number: '133',
    version: '1.5.5',
    processingState: 'VALID',
  });
  expect(() => appleBuild({ ...result, data: [...result.data, ...result.data] })).toThrow();
});
function setup({
  status = 'IN_QUEUE',
  appleAlready = false,
  cancelRace = false,
  uploadThrows = false,
  realPython = false,
  payload = Buffer.alloc(12000),
} = {}) {
  let canceled = false;
  let uploaded = false;
  const run = jest.fn((file, args) => {
    if (file === 'git') return tooling;
    if (file === 'gh')
      return JSON.stringify([
        {
          check_runs: REQUIRED_CHECKS.map((name, id) => ({
            name,
            id,
            head_sha: PIN.source,
            app: { slug: 'github-actions' },
            status: 'completed',
            conclusion: 'success',
          })),
        },
      ]);
    if (file === 'python3')
      return realPython ? execFileSync(file, args, { encoding: 'utf8' }) : JSON.stringify(info);
    if (file === 'eas' && args[0] === 'build:view')
      return JSON.stringify({
        id: PIN.id,
        status: 'FINISHED',
        platform: 'IOS',
        distribution: 'STORE',
        app: { id: app.expo.extra.eas.projectId },
        appVersion: PIN.version,
        appBuildVersion: PIN.number,
        gitCommitHash: PIN.source,
        runtime: { version: PIN.runtime },
        buildProfile: 'testflight',
        channel: 'internal',
        artifacts: { buildUrl: 'https://expo.dev/artifacts/test.ipa' },
      });
    if (file === 'eas' && args[0] === 'submit:view')
      return JSON.stringify(
        submission(canceled ? (cancelRace ? 'IN_PROGRESS' : 'CANCELED') : status),
      );
    if (file === 'eas' && args[0] === 'submit:cancel') {
      canceled = true;
      return '';
    }
    if (file === 'xcrun' && args.includes('--help'))
      return '--upload-app --apiKey --apiIssuer --p8-file-path';
    if (file === 'xcrun' && args.includes('--upload-app')) {
      expect(canceled).toBe(true);
      const filePath = args[args.indexOf('--p8-file-path') + 1];
      expect(fs.statSync(filePath).mode & 0o777).toBe(0o600);
      uploaded = true;
      if (uploadThrows) throw new Error('PRIVATE UPLOAD DETAIL');
      return '{}';
    }
    throw new Error('Unexpected test command');
  });
  const report = jest.fn();
  const apple = jest.fn(async () =>
    appleAlready || uploaded ? { processingState: 'VALID', expired: false } : null,
  );
  const request = jest.fn(async () => ({
    ok: true,
    url: 'https://storage.googleapis.com/example/test.ipa',
    arrayBuffer: async () => payload,
  }));
  return {
    run,
    report,
    apple,
    request,
    execute: (overrides) =>
      execute({ ...env, ...overrides }, app, eas, run, report, apple, request),
  };
}
it('inspect does not cancel, download, create a key file or upload', async () => {
  const f = setup();
  await f.execute();
  expect(f.request).not.toHaveBeenCalled();
  expect(
    f.run.mock.calls.some(
      ([, args]) => args.includes('submit:cancel') || args.includes('--upload-app'),
    ),
  ).toBe(false);
});
it('leaves an already progressing submission alone', async () => {
  const f = setup({ status: 'IN_PROGRESS' });
  await expect(f.execute({ DIRECT_ACTION: 'upload', SUBMIT_AUTHORIZED: 'true' })).rejects.toThrow();
  expect(f.request).not.toHaveBeenCalled();
  expect(f.run.mock.calls.some(([, args]) => args[0] === 'submit:cancel')).toBe(false);
});
it('does not cancel or upload if Apple already has 133', async () => {
  const f = setup({ appleAlready: true });
  await f.execute({ DIRECT_ACTION: 'upload', SUBMIT_AUTHORIZED: 'true' });
  expect(f.request).not.toHaveBeenCalled();
  expect(f.run.mock.calls.some(([, args]) => args[0] === 'submit:cancel')).toBe(false);
});
it.each([false, true])(
  'cancels the confirmed queue item before one direct upload, cleans files and reads uncertain results (throws=%s)',
  async (uploadThrows) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'test-direct133-'));
    try {
      const f = setup({ uploadThrows });
      await f.execute({ DIRECT_ACTION: 'upload', SUBMIT_AUTHORIZED: 'true', RUNNER_TEMP: root });
      expect(
        f.run.mock.calls.filter(([file, args]) => file === 'eas' && args[0] === 'submit:cancel'),
      ).toHaveLength(1);
      expect(
        f.run.mock.calls.filter(
          ([file, args]) => file === 'xcrun' && args.includes('--upload-app'),
        ),
      ).toHaveLength(1);
      expect(fs.existsSync(path.join(root, 'rougether-direct-133'))).toBe(false);
      expect(JSON.stringify(f.report.mock.calls)).not.toContain(key);
      expect(JSON.stringify(f.report.mock.calls)).not.toContain('PRIVATE UPLOAD DETAIL');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  },
);
it('never uploads after cancellation fails to confirm the terminal canceled state', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'test-direct133-'));
  try {
    const f = setup({ cancelRace: true });
    await expect(
      f.execute({ DIRECT_ACTION: 'upload', SUBMIT_AUTHORIZED: 'true', RUNNER_TEMP: root }),
    ).rejects.toThrow();
    expect(
      f.run.mock.calls.some(([file, args]) => file === 'xcrun' && args.includes('--upload-app')),
    ).toBe(false);
    expect(fs.existsSync(path.join(root, 'rougether-direct-133'))).toBe(false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

it('reads actual binary plists in the IPA before cancellation or upload', async () => {
  const payload = execFileSync('python3', [
    '-c',
    `import io,zipfile,plistlib,sys
b=io.BytesIO()
with zipfile.ZipFile(b,'w') as z:
 for name,bundle in [('Payload/Rougether.app/Info.plist','com.triples.rougether'),('Payload/Rougether.app/PlugIns/RougetherWidgets.appex/Info.plist','com.triples.rougether.widget')]:
  z.writestr(name,plistlib.dumps(dict(CFBundleIdentifier=bundle,CFBundleShortVersionString='1.5.5',CFBundleVersion='133'),fmt=plistlib.FMT_BINARY))
 z.writestr('padding',b'x'*15000)
sys.stdout.buffer.write(b.getvalue())`,
  ]);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'test-direct133-'));
  try {
    const f = setup({ realPython: true, payload });
    await f.execute({ DIRECT_ACTION: 'upload', SUBMIT_AUTHORIZED: 'true', RUNNER_TEMP: root });
    expect(
      f.run.mock.calls.filter(([file, args]) => file === 'xcrun' && args.includes('--upload-app')),
    ).toHaveLength(1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
it('keeps the direct workflow pinned, opt-in and read-only by default with unconditional cleanup', () => {
  const workflow = yaml.load(
    fs.readFileSync(path.join(__dirname, '../../.github/workflows/store-build.yml'), 'utf8'),
  );
  expect(workflow.on.workflow_dispatch.inputs.action.default).toBe('inspect');
  expect(workflow.on.workflow_dispatch.inputs.submit.default).toBe(false);
  const job = workflow.jobs['direct-133'];
  expect(job.if).toBe("inputs.mode == 'testflight-direct-133'");
  expect(job.env.EXPECTED_SUBMISSION_ID).toBe(SUBMISSION);
  expect(job.env.SUBMIT_PLATFORM).toBe('${{ inputs.platform }}');
  expect(job['runs-on']).toBe('macos-15');
  expect(job.permissions).toEqual({ contents: 'read', checks: 'read' });
  expect(job.concurrency['cancel-in-progress']).toBe(false);
  expect(job.steps.at(-1)).toMatchObject({
    if: 'always()',
    run: 'node scripts/direct-testflight-133.js cleanup',
  });
  expect(JSON.stringify(job)).not.toMatch(/eas build|eas update|auto-submit/);
});
