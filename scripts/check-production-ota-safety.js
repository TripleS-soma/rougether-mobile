/* eslint-disable */
const { spawnSync } = require('child_process');
const baseline = require('../.eas/production-fingerprints.json');

const expectedEndpoints = {
  EXPO_PUBLIC_API_URL: 'https://dkfiwkal2ezg9.cloudfront.net/api/v1',
  EXPO_PUBLIC_ASSET_URL: 'https://d1eazfl0tw7r0v.cloudfront.net',
};

function normalizeUrl(value) {
  return value.replace(/\/+$/, '');
}

function validateEndpointEnvironment() {
  for (const [name, expected] of Object.entries(expectedEndpoints)) {
    const configured = process.env[name];
    if (!configured) {
      console.log(`${name} is not configured; the verified shared fallback will be used.`);
      continue;
    }
    if (normalizeUrl(configured) !== expected) {
      throw new Error(`${name} must be ${expected} for this production migration.`);
    }
    console.log(`${name} matches the verified shared endpoint.`);
  }
}

function generateFingerprint(platform) {
  const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const result = spawnSync(
    command,
    ['--no-install', 'expo-updates', 'fingerprint:generate', '--platform', platform],
    { encoding: 'utf8', env: process.env },
  );

  if (result.status !== 0) {
    throw new Error(
      `Failed to generate the ${platform} fingerprint:\n${result.stderr || result.stdout}`,
    );
  }

  return JSON.parse(result.stdout).hash;
}

function validateFingerprints() {
  for (const platform of ['android', 'ios']) {
    const expected = baseline.fingerprints[platform];
    const actual = generateFingerprint(platform);
    console.log(`${platform} fingerprint: ${actual}`);
    if (actual !== expected) {
      throw new Error(
        `${platform} native fingerprint differs from production runtime ${baseline.runtimeVersion} ` +
          `(source ${baseline.sourceCommit}). Publish a new store build and update the baseline ` +
          'instead of sending this commit by OTA.',
      );
    }
  }
}

try {
  validateEndpointEnvironment();
  validateFingerprints();
  console.log(`Production OTA safety check passed for runtime ${baseline.runtimeVersion}.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
