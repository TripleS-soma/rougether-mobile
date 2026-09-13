/**
 * Date-boundary contract (spec contracts/date-boundary-cases.json, vendored under contracts/).
 * Each case freezes the clock at an instant and checks that the app's date helpers produce the
 * Asia/Seoul calendar date the server expects — and that the naive patterns really diverge there.
 * Run under several device time zones: `npm run test:date-boundary` (TZ matrix).
 */
import fixture from '../../../contracts/date-boundary-cases.json';
import { toKstDate, todayIso } from '@/utils/datetime';

// Fake only `Date`; leave timers/microtasks real so async code keeps running.
const DATE_ONLY: Parameters<typeof jest.useFakeTimers>[0] = {
  doNotFake: [
    'setTimeout',
    'clearTimeout',
    'setInterval',
    'clearInterval',
    'setImmediate',
    'clearImmediate',
    'nextTick',
    'queueMicrotask',
    'hrtime',
    'performance',
    'requestAnimationFrame',
    'cancelAnimationFrame',
    'requestIdleCallback',
    'cancelIdleCallback',
  ],
};

const pad2 = (n: number) => String(n).padStart(2, '0');
const deviceLocalDate = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const processTz = process.env.TZ;

describe('todayIso / toKstDate — spec date-boundary contract', () => {
  afterEach(() => jest.useRealTimers());

  test.each(fixture.cases)('$id — $description', (c) => {
    jest.useFakeTimers({ ...DATE_ONLY, now: new Date(c.instant) });

    expect(todayIso()).toBe(c.expectedDate);
    expect(toKstDate(new Date(c.instant))).toBe(c.expectedDate);

    // The UTC-truncation pattern yields exactly what the fixture says it does at this instant.
    expect(new Date().toISOString().slice(0, 10)).toBe(c.naive.utcTruncated.date);

    // Device-local date can only be checked when this process runs in the case's time zone.
    if (processTz === c.deviceTimeZone) {
      expect(deviceLocalDate(new Date())).toBe(c.naive.deviceLocal.date);
    }
  });

  it('the fixture actually crosses the boundary (has teeth)', () => {
    const verdicts = fixture.cases.map((c) => c.naive);
    expect(verdicts.some((n) => n.utcTruncated.verdict === 'PAST')).toBe(true);
    expect(verdicts.some((n) => n.deviceLocal.verdict === 'PAST')).toBe(true);
    expect(verdicts.some((n) => n.deviceLocal.verdict === 'FUTURE')).toBe(true);
  });

  it('when TZ is set, the fixture covers that device time zone', () => {
    if (!processTz) return;
    expect(fixture.cases.map((c) => c.deviceTimeZone)).toContain(processTz);
  });
});
