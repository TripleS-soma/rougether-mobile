const { spawnSync } = require('node:child_process');

const CHANNELS = ['dev', 'production'];
const FAILURE = 'OTA channel mapping verification failed.';

function validateChannelMapping(response, expected) {
  try {
    const channel = response?.currentPage;
    const mapping = JSON.parse(channel?.branchMapping);
    const branches = channel?.updateBranches;
    return (
      CHANNELS.includes(expected) &&
      channel.name === expected &&
      channel.isPaused === false &&
      mapping.version === 0 &&
      Array.isArray(mapping.data) &&
      mapping.data.length === 1 &&
      mapping.data[0]?.branchMappingLogic === 'true' &&
      Array.isArray(branches) &&
      branches.length === 1 &&
      branches[0]?.name === expected &&
      typeof branches[0].id === 'string' &&
      branches[0].id.length > 0 &&
      mapping.data[0].branchId === branches[0].id
    );
  } catch {
    return false;
  }
}

function execute(expected, run = spawnSync) {
  try {
    if (!CHANNELS.includes(expected)) throw new Error(FAILURE);
    // Capture CLI output: channel metadata can contain private update URLs and errors.
    const result = run('eas', ['channel:view', expected, '--json', '--non-interactive'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60000,
      maxBuffer: 4 * 1024 * 1024,
    });
    if (
      result.error ||
      result.status !== 0 ||
      !validateChannelMapping(JSON.parse(result.stdout), expected)
    ) {
      throw new Error(FAILURE);
    }
    return expected;
  } catch {
    throw new Error(FAILURE);
  }
}

if (require.main === module) {
  try {
    console.log(`channelMappingVerified=${execute(process.argv[2])}`);
  } catch {
    console.error(FAILURE);
    process.exitCode = 1;
  }
}

module.exports = { validateChannelMapping, execute };
