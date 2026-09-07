const { readFileSync } = require('node:fs');

/** Select the runtime shipped with the active SDK, never the first installed iOS version. */
function selectIosSimulator(devicesByRuntime, sdkVersion) {
  const version = /^(\d+)\.(\d+)(?:\.\d+)?$/.exec(sdkVersion);
  if (!version) throw new Error(`Invalid iOS simulator SDK version: ${sdkVersion}`);
  const runtimeId = `com.apple.CoreSimulator.SimRuntime.iOS-${version[1]}-${version[2]}`;
  const simulator = devicesByRuntime[runtimeId]?.find(
    (device) => device.name.startsWith('iPhone') && device.isAvailable !== false,
  );
  if (!simulator?.udid) {
    throw new Error(`No available iPhone simulator for SDK ${sdkVersion} (${runtimeId})`);
  }
  return { runtimeId, name: simulator.name, udid: simulator.udid };
}

module.exports = { selectIosSimulator };

if (require.main === module) {
  const [devicesPath, sdkVersion] = process.argv.slice(2);
  const { devices } = JSON.parse(readFileSync(devicesPath, 'utf8'));
  const selected = selectIosSimulator(devices, sdkVersion);
  console.error(`Selected ${selected.name} on ${selected.runtimeId}`);
  console.log(selected.udid);
}
