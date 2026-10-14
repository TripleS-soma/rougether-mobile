import chart from '@/features/minigame/rhythm-chart.json';
import { createRhythmJudge, type RhythmChart } from '@/features/minigame/rhythm-model';
import { rhythmVisualState } from '@/features/minigame/rhythm-visual';

const stage = chart as RhythmChart;
const state = () => createRhythmJudge(stage).state();
test('only elapsed audible cues produce ECG spikes and cue response', () => {
  const note = stage.notes[0];
  expect(rhythmVisualState(stage, state(), note.start - 0.01).cueIndices).toEqual([]);
  expect(rhythmVisualState(stage, state(), note.beats[2] + 0.01).cueIndices).toEqual([0, 1, 2]);
  const seventh = rhythmVisualState(stage, state(), note.target);
  expect(seventh.cueIndices).toEqual([0, 1, 2, 3, 4, 5]);
  expect(seventh.cuePulse).toBe(0);
  expect(seventh.hitPulse).toBe(0);
});
test('hidden beats remain silent visually, while the X pattern stays legible', () => {
  const note = stage.notes.find((n) => n.hidden.length)!;
  const silent = rhythmVisualState(stage, state(), note.beats[3]);
  expect(silent.hidden).toContain(3);
  expect(silent.cueIndices).not.toContain(3);
  expect(silent.cuePulse).toBe(0);
});
test('a successful hit keeps its answer wave until the next phrase actually starts', () => {
  const note = stage.notes[0];
  const judge = createRhythmJudge(stage);
  judge.press(note.target);
  judge.release(note.target);
  const view = rhythmVisualState(stage, judge.state(), note.target + 0.03, {
    id: note.id,
    grade: 'perfect',
    time: note.target,
  });
  expect(view.noteId).toBe(note.id);
  expect(view.hitPulse).toBeGreaterThan(0);
  expect(rhythmVisualState(stage, judge.state(), stage.notes[1].start + 0.01).noteId).toBe(1);
});
test('rush shows its single emitted cue and holds expose the active charge', () => {
  const rush = stage.notes.find((n) => n.kind === 'rush')!;
  expect(rhythmVisualState(stage, state(), rush.beats[4]).cueIndices).toEqual([4]);
  const hold = stage.notes.find((n) => n.hold)!;
  const judge = createRhythmJudge(stage);
  judge.press(hold.target);
  expect(
    rhythmVisualState(stage, judge.state(), hold.target + hold.hold / 2).holdProgress,
  ).toBeCloseTo(0.5);
});
