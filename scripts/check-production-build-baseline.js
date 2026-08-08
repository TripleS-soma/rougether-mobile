/* eslint-disable */
const { spawnSync } = require('child_process');
const baseline = require('../.eas/production-fingerprints.json');

function getBuild(buildId) {
  const command = process.platform === 'win32' ? 'eas.cmd' : 'eas';
  const result = spawnSync(command, ['build:view', buildId, '--json'], {
    encoding: 'utf8',
    env: process.env,
  });

  if (result.status !== 0) {
    throw new Error(`Failed to read deployed build ${buildId}:\n${result.stderr}`);
  }

  return JSON.parse(result.stdout);
}

function verifyPlatformBuild(platform, expectedBuild) {
  const expectedFingerprint = baseline.fingerprints[platform];
  if (!expectedFingerprint) {
    throw new Error(`No ${platform} fingerprint exists in the production baseline.`);
  }

  const build = getBuild(expectedBuild.id);
  const actual = {
    id: build.id,
    platform: build.platform?.toLowerCase(),
    status: build.status?.toLowerCase(),
    distribution: build.distribution?.toLowerCase(),
    appVersion: build.appVersion,
    runtimeVersion: build.runtimeVersion,
    fingerprint: build.fingerprint?.hash ?? null,
    sourceCommit: build.gitCommitHash,
    buildProfile: build.buildProfile,
    channel: build.channel,
  };
  const expected = {
    id: expectedBuild.id,
    platform,
    status: 'finished',
    distribution: 'store',
    appVersion: baseline.runtimeVersion,
    runtimeVersion: baseline.runtimeVersion,
    fingerprint: expectedFingerprint,
    sourceCommit: expectedBuild.sourceCommit,
    buildProfile: expectedBuild.buildProfile,
    channel: expectedBuild.channel,
  };

  const mismatches = Object.keys(expected).filter((field) => actual[field] !== expected[field]);
  if (mismatches.length > 0) {
    throw new Error(
      `${platform} deployed build ${expectedBuild.id} differs from its checked-in baseline ` +
        `(${mismatches.join(', ')}). Expected ${JSON.stringify(expected)}; ` +
        `received ${JSON.stringify(actual)}.`,
    );
  }

  console.log(
    `${platform} deployed build ${build.id} (${build.createdAt}) confirms source, channel, ` +
      'runtime, and fingerprint.',
  );
}

try {
  const failures = [];
  const deployedBuilds = Object.entries(baseline.deployedBuilds ?? {});
  if (deployedBuilds.length === 0) {
    throw new Error('No deployed store builds are recorded in the production baseline.');
  }
  for (const [platform, expectedBuild] of deployedBuilds) {
    try {
      verifyPlatformBuild(platform, expectedBuild);
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
