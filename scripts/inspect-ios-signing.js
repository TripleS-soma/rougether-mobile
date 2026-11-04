#!/usr/bin/env node
// Read-only Apple signing inspection. No credentials or API response bodies are logged.
const { createPrivateKey, sign } = require('node:crypto');
const IDENTIFIERS = ['com.triples.rougether', 'com.triples.rougether.widget'];

async function inspect(env = process.env, request = fetch, report = console.log) {
  const key = createPrivateKey(env.ASC_API_KEY_P8 || '');
  if (key.asymmetricKeyType !== 'ec') throw new Error('Expected the existing EC ASC key.');
  const enc = (v) => Buffer.from(JSON.stringify(v)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const data = `${enc({ alg: 'ES256', kid: '6G2698ZUCN', typ: 'JWT' })}.${enc({ iss: '371e21a1-aa0c-4582-938e-005de68485b5', iat: now - 30, exp: now + 540, aud: 'appstoreconnect-v1' })}`;
  const token = `${data}.${sign('sha256', Buffer.from(data), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
  async function get(path) {
    const response = await request(`https://api.appstoreconnect.apple.com/v1/${path}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) {
      report(JSON.stringify({ appleSigningHttpStatus: response.status }));
      throw new Error('Apple signing read-only query failed; inspect account access.');
    }
    const result = await response.json();
    if (!Array.isArray(result.data)) throw new Error('Apple signing response is incomplete.');
    return result.data;
  }
  for (const identifier of IDENTIFIERS) {
    const bundles = await get(
      `bundleIds?filter[identifier]=${identifier}&fields[bundleIds]=identifier`,
    );
    const exact = bundles.filter((bundle) => bundle.attributes?.identifier === identifier);
    if (exact.length !== 1 || !/^[a-z0-9]+$/i.test(exact[0].id)) {
      report(JSON.stringify({ identifier, registered: false }));
      continue;
    }
    const profiles = await get(
      `bundleIds/${exact[0].id}/profiles?fields[profiles]=profileState,profileType,expirationDate&limit=200`,
    );
    report(
      JSON.stringify({
        identifier,
        registered: true,
        profiles: profiles.map(({ attributes: a }) => ({
          state: ['ACTIVE', 'INVALID'].includes(a?.profileState) ? a.profileState : 'UNKNOWN',
          type: /^[A-Z_]+$/.test(a?.profileType || '') ? a.profileType : 'UNKNOWN',
          unexpired: Date.parse(a?.expirationDate) > Date.now(),
        })),
      }),
    );
  }
}
if (require.main === module)
  inspect().catch(() => {
    console.error(
      'Read-only Apple signing inspection could not finish. No build, registration or signing mutation was requested.',
    );
    process.exitCode = 1;
  });
module.exports = { inspect };
