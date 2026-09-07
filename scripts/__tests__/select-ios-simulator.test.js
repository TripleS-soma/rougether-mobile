const { selectIosSimulator } = require('../select-ios-simulator');

const runtime = (version) => `com.apple.CoreSimulator.SimRuntime.iOS-${version}`;
const phone = (udid, extras = {}) => ({ name: 'iPhone 17 Pro', udid, ...extras });

describe('select-ios-simulator', () => {
  it('matches the active SDK instead of the first installed iOS runtime', () => {
    const devices = {
      [runtime('26-0')]: [phone('old-runtime')],
      [runtime('26-2')]: [phone('sdk-runtime')],
    };

    expect(selectIosSimulator(devices, '26.2')).toEqual({
      runtimeId: runtime('26-2'),
      name: 'iPhone 17 Pro',
      udid: 'sdk-runtime',
    });
  });

  it('matches a patch SDK to its major/minor simulator runtime', () => {
    expect(selectIosSimulator({ [runtime('26-2')]: [phone('match')] }, '26.2.1').udid).toBe(
      'match',
    );
  });

  it('does not silently fall back when the matching runtime is missing', () => {
    expect(() => selectIosSimulator({ [runtime('26-0')]: [phone('old')] }, '26.2')).toThrow(
      'No available iPhone simulator for SDK 26.2',
    );
  });

  it('skips tablets and unavailable phones', () => {
    const devices = {
      [runtime('26-2')]: [
        { name: 'iPad Pro', udid: 'tablet' },
        phone('unavailable', { isAvailable: false }),
        phone('available'),
      ],
    };
    expect(selectIosSimulator(devices, '26.2').udid).toBe('available');
  });

  it('fails clearly when the matching runtime has no phone', () => {
    expect(() => selectIosSimulator({ [runtime('26-2')]: [] }, '26.2')).toThrow(
      'No available iPhone simulator',
    );
  });

  it('rejects an unknown SDK version', () => {
    expect(() => selectIosSimulator({}, 'unknown')).toThrow('Invalid iOS simulator SDK');
  });
});
