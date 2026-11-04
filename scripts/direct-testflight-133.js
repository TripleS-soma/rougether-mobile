#!/usr/bin/env node
// Only the already-built 133 candidate. Never build, re-sign, retry or submit for review.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createHash, createPrivateKey, sign } = require('node:crypto');
const { candidateFromInputs, validateBuild } = require('./submit-current-testflight');
const { validateChecks, safeFailureDetail } = require('./check-testflight-build');
const PIN = {
  id: '7b79063e-7636-4682-a0f1-f658ff80d169',
  source: '67bf04683eb189b61039b4d6b349d269dbc6ab46',
  version: '1.5.5',
  number: '133',
  runtime: 'ce2fb29c8c3172506fd519fbce4139148ddd2773',
};
const SUBMISSION = 'f4abe01f-06f9-4b45-844e-49e51c22b957';
const APP = '6793513720';
const KEY_ID = '6G2698ZUCN';
const ISSUER = '371e21a1-aa0c-4582-938e-005de68485b5';
function guard(ok, message) {
  if (!ok) throw new Error(message);
}
function validateInputs(env, head, app, eas) {
  guard(
    ['inspect', 'upload'].includes(env.DIRECT_ACTION),
    'Expected direct inspect or upload action.',
  );
  const c = candidateFromInputs(
    {
      ...env,
      SUBMIT_MODE: 'testflight-current-submit',
      SUBMIT_ACTION: env.DIRECT_ACTION === 'upload' ? 'submit' : 'inspect',
    },
    head,
    app,
    eas,
  );
  guard(
    Object.keys(PIN).every((k) => c[k] === PIN[k]) && env.EXPECTED_SUBMISSION_ID === SUBMISSION,
    'Only the exact approved 133 binary and queued submission are supported.',
  );
  return c;
}
function validateSubmission(s, allowed) {
  guard(
    s?.id === SUBMISSION &&
      s.submittedBuild?.id === PIN.id &&
      s.platform === 'IOS' &&
      s.iosConfig?.ascAppIdentifier === APP &&
      allowed.includes(s.status),
    'Existing submission identity or state changed; do not cancel or upload.',
  );
}
function validateIpa(info) {
  guard(
    info?.bundle === 'com.triples.rougether' &&
      info.version === PIN.version &&
      info.number === PIN.number &&
      info.widgetBundle === 'com.triples.rougether.widget' &&
      info.widgetVersion === PIN.version &&
      info.widgetNumber === PIN.number,
    'IPA app or widget metadata does not match approved 1.5.5 (133).',
  );
}
function appleBuild(result) {
  guard(Array.isArray(result?.data), 'Apple build response is unavailable.');
  const matches = result.data.filter(
    (b) =>
      b.attributes?.version === PIN.number &&
      (result.included || []).some(
        (v) =>
          v.type === 'preReleaseVersions' &&
          v.id === b.relationships?.preReleaseVersion?.data?.id &&
          v.attributes?.version === PIN.version,
      ),
  );
  guard(
    matches.length <= 1 && result.data.length < 200 && !result.links?.next,
    'Apple returned ambiguous or incomplete build metadata.',
  );
  guard(
    matches.length || !result.data.some((b) => b.attributes?.version === PIN.number),
    'Apple returned 133 without the expected version-train proof.',
  );
  if (!matches.length) return null;
  const b = matches[0];
  guard(/^[a-f0-9-]{36}$/.test(b.id || ''), 'Apple returned an invalid build identifier.');
  const details = (result.included || []).find(
    (v) => v.type === 'buildBetaDetails' && v.id === b.relationships?.buildBetaDetail?.data?.id,
  )?.attributes;
  const safe = (v) => (typeof v === 'string' && /^[A-Z_]{1,60}$/.test(v) ? v : null);
  return {
    version: PIN.version,
    number: PIN.number,
    id: b.id,
    processingState: safe(b.attributes.processingState),
    internalState: safe(details?.internalBuildState),
    externalState: safe(details?.externalBuildState),
    expired: b.attributes.expired === true,
  };
}
function command(file, args, timeout = 5 * 60 * 1000, extraEnv = {}) {
  const env = { ...process.env, ...extraEnv };
  delete env.ASC_API_KEY_P8;
  try {
    return execFileSync(file, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env,
      maxBuffer: 16 * 1024 * 1024,
      timeout,
    }).trim();
  } catch (e) {
    throw new Error(`${file} command failed; do not retry. ${safeFailureDetail(e)}`);
  }
}
async function queryApple(env, request = fetch) {
  const key = createPrivateKey(env.ASC_API_KEY_P8 || '');
  guard(key.asymmetricKeyType === 'ec', 'Expected the existing EC ASC key.');
  const enc = (x) => Buffer.from(JSON.stringify(x)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const data = `${enc({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' })}.${enc({ iss: ISSUER, iat: now - 30, exp: now + 540, aud: 'appstoreconnect-v1' })}`;
  const jwt = `${data}.${sign('sha256', Buffer.from(data), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
  const response = await request(
    `https://api.appstoreconnect.apple.com/v1/builds?filter[app]=${APP}&filter[version]=133&include=preReleaseVersion,buildBetaDetail&limit=200`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${jwt}` },
      signal: AbortSignal.timeout(30000),
    },
  );
  guard(response.ok, `Apple read-only build lookup failed: HTTP ${response.status}.`);
  return appleBuild(await response.json());
}
function directory(env) {
  guard(
    path.isAbsolute(env.RUNNER_TEMP || '') && env.RUNNER_TEMP !== '/',
    'Expected isolated runner temp directory.',
  );
  return path.join(env.RUNNER_TEMP, 'rougether-direct-133');
}
function cleanup(env = process.env) {
  fs.rmSync(directory(env), { recursive: true, force: true });
}
async function execute(
  env,
  app,
  eas,
  run = command,
  report = console.log,
  apple = queryApple,
  request = fetch,
) {
  const c = validateInputs(env, run('git', ['rev-parse', 'HEAD']), app, eas);
  const json = (file, args) => {
    const raw = run(file, args);
    try {
      return JSON.parse(raw);
    } catch {
      throw new Error(`${file} returned invalid JSON; do not proceed.`);
    }
  };
  const build = json('eas', ['build:view', PIN.id, '--json']);
  validateBuild(build, c);
  const existing = () => json('eas', ['submit:view', SUBMISSION, '--json']);
  let submission = existing();
  validateSubmission(submission, ['IN_QUEUE', 'IN_PROGRESS', 'FINISHED', 'CANCELED', 'ERRORED']);
  report(
    JSON.stringify({
      existingSubmission: { id: submission.id, status: submission.status, buildId: PIN.id },
    }),
  );
  let state = await apple(env);
  report(JSON.stringify({ apple133: state }));
  const help = run('xcrun', ['altool', '--help']);
  guard(
    ['--upload-app', '--apiKey', '--apiIssuer', '--p8-file-path'].every((flag) =>
      help.includes(flag),
    ),
    'Installed Apple upload tool lacks the required direct key-file flags.',
  );
  const url = new URL(build.artifacts?.buildUrl || '');
  guard(
    url.protocol === 'https:' && /(^|\.)expo\.(dev|io)$/.test(url.hostname),
    'Unexpected EAS artifact origin.',
  );
  report(JSON.stringify({ appleUploadToolReady: true, artifactHost: url.hostname }));
  if (env.DIRECT_ACTION === 'inspect') return;
  validateChecks(
    json('gh', [
      'api',
      '--paginate',
      '--slurp',
      `repos/TripleS-soma/rougether-mobile/commits/${PIN.source}/check-runs?filter=all&per_page=100`,
    ]),
    PIN.source,
  );
  if (state) {
    report('Apple already has 133; no cancellation or upload.');
    return;
  }
  validateSubmission(submission, ['IN_QUEUE']);
  const dir = directory(env);
  fs.mkdirSync(dir, { mode: 0o700 });
  try {
    const response = await request(url, { signal: AbortSignal.timeout(5 * 60 * 1000) });
    const finalUrl = new URL(response.url);
    guard(
      response.ok &&
        finalUrl.protocol === 'https:' &&
        /(^|\.)(expo\.dev|expo\.io|googleapis\.com|amazonaws\.com|cloudfront\.net)$/.test(
          finalUrl.hostname,
        ),
      'EAS artifact download failed or redirected to an unexpected origin.',
    );
    const bytes = Buffer.from(await response.arrayBuffer());
    guard(bytes.length > 10000 && bytes.length < 1024 * 1024 * 1024, 'Unexpected IPA size.');
    const ipa = path.join(dir, 'build-133.ipa');
    fs.writeFileSync(ipa, bytes, { flag: 'wx', mode: 0o600 });
    const hash = createHash('sha256').update(bytes).digest('hex');
    const inspect = `import zipfile,plistlib,re,json,sys\nz=zipfile.ZipFile(sys.argv[1])\na=[x for x in z.namelist() if re.fullmatch(r'Payload/[^/]+\\.app/Info.plist',x)]\nw=[x for x in z.namelist() if re.fullmatch(r'Payload/[^/]+\\.app/PlugIns/[^/]+\\.appex/Info.plist',x)]\nassert len(a)==1\np=plistlib.loads(z.read(a[0]))\nws=[plistlib.loads(z.read(x)) for x in w]\nw=next(x for x in ws if x.get('CFBundleIdentifier')=='com.triples.rougether.widget')\nprint(json.dumps(dict(bundle=p['CFBundleIdentifier'],version=p['CFBundleShortVersionString'],number=p['CFBundleVersion'],widgetBundle=w['CFBundleIdentifier'],widgetVersion=w['CFBundleShortVersionString'],widgetNumber=w['CFBundleVersion'])))`;
    validateIpa(json('python3', ['-c', inspect, ipa]));
    report(
      JSON.stringify({
        validatedIpaSha256: hash,
        bytes: bytes.length,
        version: PIN.version,
        number: PIN.number,
      }),
    );
    // Re-check immediately before cancellation. Only a confirmed queue item may be replaced.
    validateSubmission(existing(), ['IN_QUEUE']);
    guard(
      !(await apple(env)),
      'Apple133 appeared during preflight; stop without cancellation or upload.',
    );
    run('eas', ['submit:cancel', SUBMISSION, '--non-interactive']);
    submission = existing();
    validateSubmission(submission, ['CANCELED']);
    report(JSON.stringify({ canceledQueuedSubmission: submission.id, status: submission.status }));
    guard(!(await apple(env)), 'Apple133 appeared after cancellation; do not upload again.');
    const key = path.join(dir, `AuthKey_${KEY_ID}.p8`);
    createPrivateKey(env.ASC_API_KEY_P8);
    fs.writeFileSync(key, env.ASC_API_KEY_P8, { flag: 'wx', mode: 0o600 });
    let uploaded = false;
    try {
      run(
        'xcrun',
        [
          'altool',
          '--upload-app',
          '--type',
          'ios',
          '--file',
          ipa,
          '--apiKey',
          KEY_ID,
          '--apiIssuer',
          ISSUER,
          '--p8-file-path',
          key,
          '--output-format',
          'json',
        ],
        35 * 60 * 1000,
      );
      uploaded = true;
    } catch {
      report(
        'Apple upload command outcome is uncertain; read status only and never repeat the upload.',
      );
    }
    guard(
      createHash('sha256').update(fs.readFileSync(ipa)).digest('hex') === hash,
      'IPA changed during upload.',
    );
    report(JSON.stringify({ directUploadCommandSucceeded: uploaded, binarySha256: hash }));
    for (let i = 0; i < 40; i++) {
      state = await apple(env);
      report(JSON.stringify({ apple133: state }));
      if (state && state.processingState !== 'PROCESSING') {
        guard(
          state.processingState === 'VALID' && !state.expired,
          'Apple did not accept 133 as a valid unexpired TestFlight build.',
        );
        return;
      }
      run('sleep', ['30']);
    }
    throw new Error(
      'Apple processing is pending; inspect the existing 133 build, never upload again.',
    );
  } finally {
    cleanup(env);
  }
}
if (require.main === module) {
  if (process.argv[2] === 'cleanup') cleanup();
  else
    execute(
      process.env,
      JSON.parse(fs.readFileSync('app.json', 'utf8')),
      JSON.parse(fs.readFileSync('eas.json', 'utf8')),
    ).catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
module.exports = {
  PIN,
  SUBMISSION,
  validateInputs,
  validateSubmission,
  validateIpa,
  appleBuild,
  queryApple,
  execute,
};
