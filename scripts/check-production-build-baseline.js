/* eslint-disable */
const { spawnSync } = require('child_process');
const baseline = require('../.eas/production-fingerprints.json');

function listProductionBuilds(platform) {
  const command = process.platform === 'win32' ? 'eas.cmd' : 'eas';
  const result = spawnSync(
    command,
    [
      'build:list',
      '--platform',
      platform,
      '--status',
      'finished',
      '--distribution',
      'store',
      '--app-version',
      baseline.runtimeVersion,
      '--limit',
      '50',
      '--json',
      '--non-interactive',
    ],
    { encoding: 'utf8', env: process.env },
  );

  if (result.status !== 0) {
    throw new Error(`Failed to list ${platform} production builds:\n${result.stderr}`);
  }

  return JSON.parse(result.stdout);
}

function verifyPlatformBuild(platform) {
  const expectedFingerprint = baseline.fingerprints[platform];
  const builds = listProductionBuilds(platform);
  const matchingBuild = builds.find(
    (build) =>
      build.fingerprint?.hash === expectedFingerprint &&
      build.runtimeVersion === baseline.runtimeVersion &&
      build.gitCommitHash === baseline.sourceCommit &&
      build.channel === 'production',
  );

  if (!matchingBuild) {
    const available = builds.map((build) => ({
      id: build.id,
      fingerprint: build.fingerprint?.hash ?? null,
      runtimeVersion: build.runtimeVersion,
      gitCommitHash: build.gitCommitHash,
      buildProfile: build.buildProfile,
      channel: build.channel,
      createdAt: build.createdAt,
    }));
    throw new Error(
      `No finished ${platform} production build matches source ${baseline.sourceCommit}, ` +
        `runtime ${baseline.runtimeVersion}, and fingerprint ${expectedFingerprint}. ` +
        `Available builds: ${JSON.stringify(available)}`,
    );
  }

  console.log(
    `${platform} production build ${matchingBuild.id} confirms fingerprint ${expectedFingerprint}.`,
  );
}

try {
  const failures = [];
  for (const platform of ['android', 'ios']) {
    try {
      verifyPlatformBuild(platform);
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join('\n'));
  }
  console.log(`Production build baseline is confirmed for runtime ${baseline.runtimeVersion}.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
