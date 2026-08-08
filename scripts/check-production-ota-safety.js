/* eslint-disable */
const { spawnSync } = require('child_process');
const app = require('../app.json');
const baseline = require('../.eas/production-fingerprints.json');
const sharedEndpoints = require('../src/config/shared-endpoints.json');

const expectedEndpoints = {
  EXPO_PUBLIC_API_URL: sharedEndpoints.apiBase,
  EXPO_PUBLIC_ASSET_URL: sharedEndpoints.assetBase,
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
  const deployedPlatforms = Object.keys(baseline.deployedBuilds ?? {});
  if (deployedPlatforms.length === 0) {
    throw new Error('No deployed store builds are recorded in the production baseline.');
  }
  for (const platform of deployedPlatforms) {
    const expected = baseline.fingerprints[platform];
    if (!expected) {
      throw new Error(`No ${platform} fingerprint exists in the production baseline.`);
    }
    const actual = generateFingerprint(platform);
    console.log(`${platform} fingerprint: ${actual}`);
    if (actual !== expected) {
      throw new Error(
        `${platform} native fingerprint differs from production runtime ${baseline.runtimeVersion} ` +
          `and deployed build ${baseline.deployedBuilds[platform].id}. Publish a new store build ` +
          'and update the baseline instead of sending this commit by OTA.',
      );
    }
  }
}

function validateRuntimeVersion() {
  const policy = app.expo.runtimeVersion?.policy;
  if (policy !== 'appVersion') {
    throw new Error(
      `Expected runtimeVersion.policy to be appVersion, but found ${policy ?? 'no policy'}. ` +
        'Update the production OTA safety model before publishing.',
    );
  }

  if (app.expo.version !== baseline.runtimeVersion) {
    throw new Error(
      `app.json version ${app.expo.version} differs from the production baseline runtime ` +
        `${baseline.runtimeVersion}. Publish a new store build and regenerate ` +
        '.eas/production-fingerprints.json before sending an OTA.',
    );
  }
}

try {
  validateRuntimeVersion();
  validateEndpointEnvironment();
  validateFingerprints();
  console.log(`Production OTA safety check passed for runtime ${app.expo.version}.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
