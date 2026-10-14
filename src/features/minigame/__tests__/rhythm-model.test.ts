import chart from '@/features/minigame/rhythm-chart.json';
import {
  audibleContextTime,
  createRhythmJudge,
  type RhythmChart,
} from '@/features/minigame/rhythm-model';
import { parseRhythmMessage } from '@/features/minigame/rhythm-bridge';

const stage = chart as RhythmChart;
test('four phases increase density, cue speed and hidden cues without changing music BPM', () => {
  const phases = [1, 2, 3, 4].map((level) => stage.notes.filter((note) => note.level === level));
  expect(phases.map((notes) => notes.length)).toEqual([4, 4, 8, 16]);
  expect(phases.map((notes) => notes[0].speed)).toEqual([1, 1, 2, 4]);
  expect(phases.map((notes) => notes[0].hidden.length)).toEqual([0, 1, 2, 3]);
  expect(phases.map((notes) => notes[0].perfectWindow)).toEqual([0.08, 0.07, 0.06, 0.05]);
  const gaps = phases.map(
    (notes) =>
      notes.slice(1).reduce((sum, note, i) => sum + note.target - notes[i].target, 0) /
      (notes.length - 1),
  );
  expect(gaps[2]).toBeLessThan(gaps[1] * 0.55);
  expect(gaps[3]).toBeLessThan(gaps[2] * 0.55);
});
test('every seventh beat and held release uses the measured audio timestamp', () => {
  for (const note of stage.notes) {
    expect(note.target).toBe(note.beats[6]);
    expect(note.start).toBe(note.beats[0]);
    expect(note.beats.every((t, i, beats) => i === 0 || t > beats[i - 1])).toBe(true);
    if (note.hold) expect(note.target + note.hold).toBeCloseTo(note.beats[7], 6);
  }
});
test('audible output clock handles delayed hardware without double compensation', () => {
  expect(
    audibleContextTime(10, { contextTime: 9.8, performanceTime: 1000 }, 1040, 0.2, 0.02),
  ).toBeCloseTo(9.84);
  expect(audibleContextTime(10, undefined, 1040, 0.1, 0.02)).toBeCloseTo(9.88);
  expect(audibleContextTime(0, { contextTime: 0, performanceTime: 0 }, 0, 0.2, 0.02)).toBe(0);
  expect(
    audibleContextTime(10, { contextTime: 3, performanceTime: 1000 }, 5000, 0.1, 0.02),
  ).toBeCloseTo(9.88);
});
test('perfect full stage includes every hold; key repeat cannot double score', () => {
  const judge = createRhythmJudge(stage);
  for (const note of stage.notes) {
    judge.press(note.target);
    expect(judge.press(note.target)).toBeNull();
    judge.release(note.target + note.hold);
  }
  expect(judge.result()).toMatchObject({ score: 32000, perfect: 32, good: 0, miss: 0 });
  expect(
    parseRhythmMessage({ channelId: 'test', type: 'finish', result: judge.result() }, 'test'),
  ).not.toBeNull();
});
test('held pause is reacquired without a new attempt; early release fails once', () => {
  const note = stage.notes.find((n) => n.hold)!;
  const judge = createRhythmJudge({ ...stage, notes: [{ ...note, id: 0 }] });
  judge.press(note.target);
  judge.suspend();
  expect(judge.press(note.target + 0.1)?.grade).toBe('resume');
  judge.release(note.target + 0.2);
  judge.update(note.target + note.hold + 1);
  expect(judge.result().miss).toBe(1);
  expect(judge.result().actions.filter((a) => a.kind === 'press')).toHaveLength(1);
});
test('malformed/stale finish and fabricated scores cannot cross the practice bridge', () => {
  const judge = createRhythmJudge(stage);
  judge.update(stage.duration);
  const message = { channelId: 'test', type: 'finish', result: judge.result() };
  expect(parseRhythmMessage(message, 'other')).toBeNull();
  expect(
    parseRhythmMessage({ ...message, result: { ...message.result, score: 32000 } }, 'test'),
  ).toBeNull();
  expect(parseRhythmMessage('{', 'test')).toBeNull();
});
