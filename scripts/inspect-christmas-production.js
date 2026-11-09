#!/usr/bin/env node
// Existing build metadata and released App Store versions only. No mutations or credentials logged.
const { createPrivateKey, sign } = require('node:crypto');
const { Buffer } = require('node:buffer');
const { writeFileSync } = require('node:fs');

const safe = (value, pattern) => (typeof value === 'string' && pattern.test(value) ? value : null);
const word = /^[a-zA-Z0-9_.-]+$/;
const sha = /^[a-f0-9]{40}$/;
const uuid = /^[a-f0-9-]{36}$/;

async function inspect(env = process.env, request = fetch) {
  const fields = `id status platform appVersion appBuildVersion gitCommitHash buildProfile
    runtime { version } fingerprint { hash } updateChannel { name }`;
  const query = `query ProductionStatus($appId: String!) {
    app { byId(appId: $appId) {
      android: builds(offset: 0, limit: 100, filter: {platform: ANDROID}) { ${fields} }
      ios: builds(offset: 0, limit: 100, filter: {platform: IOS}) { ${fields} }
    } }
  }`;
  const response = await request('https://api.expo.dev/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.EXPO_TOKEN}` },
    body: JSON.stringify({ query, variables: { appId: '430c1f3b-4035-47c8-9864-8e07687d628c' } }),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`EAS status HTTP ${response.status}`);
  const eas = await response.json();
  if (
    eas.errors ||
    !Array.isArray(eas.data?.app?.byId?.android) ||
    !Array.isArray(eas.data?.app?.byId?.ios)
  ) {
    throw new Error('EAS status response incomplete.');
  }
  const builds = [...eas.data.app.byId.android, ...eas.data.app.byId.ios].map((b) => ({
    id: safe(b.id, uuid),
    platform: safe(b.platform, word),
    status: safe(b.status, word),
    version: safe(b.appVersion, word),
    build: safe(b.appBuildVersion, word),
    source: safe(b.gitCommitHash, sha),
    profile: safe(b.buildProfile, word),
    channel: safe(b.updateChannel?.name, word),
    runtime: safe(b.runtime?.version || b.fingerprint?.hash, sha),
  }));
  const key = createPrivateKey(env.ASC_API_KEY_P8 || '');
  if (key.asymmetricKeyType !== 'ec') throw new Error('Expected existing EC ASC key.');
  const enc = (v) => Buffer.from(JSON.stringify(v)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const data = `${enc({ alg: 'ES256', kid: '6G2698ZUCN', typ: 'JWT' })}.${enc({ iss: '371e21a1-aa0c-4582-938e-005de68485b5', iat: now - 30, exp: now + 540, aud: 'appstoreconnect-v1' })}`;
  const token = `${data}.${sign('sha256', Buffer.from(data), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
  const apple = await request(
    'https://api.appstoreconnect.apple.com/v1/apps/6793513720/appStoreVersions?filter[platform]=IOS&limit=50&include=build',
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30000),
    },
  );
  if (!apple.ok) throw new Error(`ASC status HTTP ${apple.status}`);
  const body = await apple.json();
  if (!Array.isArray(body.data)) throw new Error('ASC status response incomplete.');
  const versions = body.data.map((v) => {
    const build = body.included?.find(
      (b) => b.type === 'builds' && b.id === v.relationships?.build?.data?.id,
    );
    return {
      version: safe(v.attributes?.versionString, word),
      state: safe(v.attributes?.appStoreState, word),
      build: safe(build?.attributes?.version, word),
      processingState: safe(build?.attributes?.processingState, word),
      expired: typeof build?.attributes?.expired === 'boolean' ? build.attributes.expired : null,
    };
  });
  return { observedAt: new Date().toISOString(), easBuilds: builds, appStoreVersions: versions };
}

if (require.main === module) {
  inspect()
    .then((result) => {
      writeFileSync('production-readonly-status.json', JSON.stringify(result, null, 2));
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      // Errors are fixed strings and HTTP status codes; never print API payloads or request headers.
      console.error(
        error.message?.match(/^(EAS|ASC|Expected) /)
          ? error.message
          : 'Read-only status query failed.',
      );
      process.exitCode = 1;
    });
}

module.exports = { inspect };
