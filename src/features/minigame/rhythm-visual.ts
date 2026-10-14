import type { RhythmChart, RhythmJudge } from '@/features/minigame/rhythm-model';

export type RhythmVisual = {
  noteId: number;
  level: number;
  kind: string;
  cueIndices: number[];
  hidden: number[];
  cuePulse: number;
  rushProgress: number | null;
  holdProgress: number | null;
  hitPulse: number;
  hitGrade: string | null;
};

/** Visual beats follow emitted cues; the seventh beat never lights itself up. */
export const RHYTHM_VISUAL_SOURCE = String.raw`function rhythmVisualState(chart, state, time, feedback) {
  const started = chart.notes.filter(note => note.start <= time);
  const note = started[started.length - 1] || chart.notes[0];
  const audible = note.kind === 'rush' ? [4] : [0,1,2,3,4,5].filter(i => !note.hidden.includes(i));
  const cueIndices = audible.filter(i => note.beats[i] <= time);
  const last = cueIndices.length ? note.beats[cueIndices[cueIndices.length - 1]] : -100;
  const width = Math.min(.13, (note.target - note.beats[5]) * .55);
  const cuePulse = Math.max(0, 1 - (time - last) / width);
  const rushProgress = note.kind === 'rush' && time >= note.beats[4]
    ? Math.min(1, Math.max(0, (time - note.beats[4]) / (note.target - note.beats[4]))) : null;
  const held = state.held ? chart.notes.find(n => n.id === state.held.id) : null;
  const holdProgress = held ? Math.max(0, Math.min(1, (time - held.target) / held.hold)) : null;
  const hitAge = feedback ? time - feedback.time : 10;
  const hitPulse = feedback && feedback.id === note.id && hitAge >= 0 ? Math.max(0, 1 - hitAge / .35) : 0;
  return { noteId:note.id, level:note.level, kind:note.kind, cueIndices, hidden:[...note.hidden], cuePulse, rushProgress, holdProgress, hitPulse, hitGrade:hitPulse ? feedback.grade : null };
}`;

const factory = new Function(`${RHYTHM_VISUAL_SOURCE}; return rhythmVisualState;`)() as (
  chart: RhythmChart,
  state: ReturnType<RhythmJudge['state']>,
  time: number,
  feedback?: { id: number; grade: string; time: number },
) => RhythmVisual;

export const rhythmVisualState = factory;
