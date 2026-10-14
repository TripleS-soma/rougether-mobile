export type RhythmNote = {
  id: number;
  start: number;
  target: number;
  hold: number;
  kind: 'tap' | 'hold' | 'rush';
  level: number;
  speed: number;
  perfectWindow: number;
  hidden: number[];
  beats: number[];
};
export type RhythmChart = { bpm: number; beat: number; duration: number; notes: RhythmNote[] };
export type RhythmAction = { kind: 'press' | 'release'; timeMs: number };
export type RhythmResult = {
  chartVersion: 2;
  score: number;
  perfect: number;
  good: number;
  miss: number;
  maxCombo: number;
  actions: RhythmAction[];
};

type RhythmFeedback = { id: number; grade: string; errorMs: number };
export type RhythmJudge = {
  update: (time: number) => void;
  suspend: () => void;
  press: (time: number) => RhythmFeedback | null;
  release: (time: number) => RhythmFeedback | null;
  state: () => {
    status: string[];
    held: { id: number; grade: string } | null;
    score: number;
    perfect: number;
    good: number;
    miss: number;
    combo: number;
    maxCombo: number;
    feedback: RhythmFeedback | null;
  };
  result: () => RhythmResult;
};

/** Fixed bundled source: Hermes cannot serialize functions with Function.toString(). */
export const RHYTHM_ENGINE_SOURCE = String.raw`function createRhythmJudge(chart) {
    const status = chart.notes.map(() => 'pending');
    const actions = [];
    let held = null;
    let down = false;
    let score = 0, perfect = 0, good = 0, miss = 0, combo = 0, maxCombo = 0;
    let feedback = null;
    const finish = (id, grade, error) => {
        if (!['pending', 'holding'].includes(status[id]))
            return;
        status[id] = grade;
        if (grade === 'perfect') {
            perfect++;
            score += 1000;
            combo++;
        }
        else if (grade === 'good') {
            good++;
            score += 500;
            combo++;
        }
        else {
            miss++;
            combo = 0;
        }
        maxCombo = Math.max(maxCombo, combo);
        feedback = { id, grade, errorMs: Math.round(error * 1000) };
        if (held?.id === id)
            held = null;
        return feedback;
    };
    const update = (time) => {
        for (const note of chart.notes) {
            if (status[note.id] === 'pending' && time > note.target + 0.18)
                finish(note.id, 'miss', 0.18);
            if (status[note.id] === 'holding' && time > note.target + note.hold + 0.18)
                finish(note.id, 'miss', 0.18);
        }
    };
    return {
        update,
        suspend() { down = false; },
        press(time) {
            update(time);
            if (down || !Number.isFinite(time) || actions.length >= 1024)
                return null;
            down = true;
            if (held)
                return { id: held.id, grade: 'resume', errorMs: 0 };
            actions.push({ kind: 'press', timeMs: Math.round(time * 1000) });
            const note = chart.notes.find(n => status[n.id] === 'pending' && Math.abs(time - n.target) <= 0.3);
            if (!note)
                return null;
            const error = time - note.target;
            const grade = Math.abs(error) <= (note.perfectWindow || 0.08) + 1e-9 ? 'perfect' : Math.abs(error) <= 0.18 + 1e-9 ? 'good' : 'miss';
            if (note.hold && grade !== 'miss') {
                held = { id: note.id, grade };
                status[note.id] = 'holding';
                return { id: note.id, grade: 'hold', errorMs: Math.round(error * 1000) };
            }
            return finish(note.id, grade, error) ?? null;
        },
        release(time) {
            down = false;
            if (actions.length < 1024 && Number.isFinite(time))
                actions.push({ kind: 'release', timeMs: Math.round(time * 1000) });
            if (!held)
                return null;
            const note = chart.notes[held.id];
            const error = time - note.target - note.hold;
            return finish(note.id, Math.abs(error) <= 0.12 + 1e-9 ? held.grade : 'miss', error) ?? null;
        },
        state() { return { status: [...status], held: held ? { ...held } : null, score, perfect, good, miss, combo, maxCombo, feedback }; },
        result() { return { chartVersion: 2, score, perfect, good, miss, maxCombo, actions: actions.map(a => ({ ...a })) }; },
    };
}
/** Translate a DOM event's performance clock to the sample currently at the output. */
function audibleContextTime(currentTime, timestamp, performanceNow, outputLatency, baseLatency) {
    if (timestamp && timestamp.performanceTime > 0 && timestamp.contextTime > 0 &&
        Math.abs(performanceNow - timestamp.performanceTime) < 1000) {
        return Math.max(0, Math.min(currentTime, timestamp.contextTime + (performanceNow - timestamp.performanceTime) / 1000));
    }
    // outputLatency covers hardware output; baseLatency covers graph→host processing.
    const latency = Math.max(0, outputLatency || 0) + Math.max(0, baseLatency || 0);
    return Math.max(0, currentTime - Math.min(0.5, latency));
}
`;

const factory = new Function(
  RHYTHM_ENGINE_SOURCE + ';return {createRhythmJudge,audibleContextTime};',
)() as {
  createRhythmJudge: (chart: RhythmChart) => RhythmJudge;
  audibleContextTime: (
    currentTime: number,
    timestamp: { contextTime: number; performanceTime: number } | undefined,
    performanceNow: number,
    outputLatency: number,
    baseLatency: number,
  ) => number;
};
export const createRhythmJudge = factory.createRhythmJudge;
export const audibleContextTime = factory.audibleContextTime;
