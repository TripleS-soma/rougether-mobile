/* eslint-disable */
const baseline = require('../.eas/production-fingerprints.json');

function getTargets() {
  const builds = Object.entries(baseline.deployedBuilds ?? {});
  if (builds.length === 0) {
    throw new Error('No deployed store builds are recorded in the production baseline.');
  }

  return builds.map(([platform, build]) => {
    if (!['android', 'ios'].includes(platform)) {
      throw new Error(`Unsupported production OTA platform: ${platform}.`);
    }
    if (typeof build.channel !== 'string' || build.channel.length === 0) {
      throw new Error(`No OTA channel is recorded for the deployed ${platform} build.`);
    }
    return { platform, channel: build.channel };
  });
}

try {
  for (const { platform, channel } of getTargets()) {
    process.stdout.write(`${platform}\t${channel}\n`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
