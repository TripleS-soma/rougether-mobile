/**
 * Records the requests the REAL app code builds at each spec date-boundary instant and asserts
 * they carry the Asia/Seoul date. With DATE_BOUNDARY_OUT set, the captured requests are written
 * to that file so the server's contract test can replay them against a fixed clock
 * (rougether-server DateBoundaryContractTest). Driven by scripts/run-date-boundary.js.
 */
import { fireEvent, render } from '@testing-library/react-native';
import fs from 'node:fs';
import path from 'node:path';

import fixture from '../../../contracts/date-boundary-cases.json';
import { toRoutineCreate } from '@/api/adapters';
import { completeRoutine, createRoutine } from '@/api/routines';
import { AddRoutineScreen } from '@/components/screens/add-routine-screen';
import type { NewRoutine } from '@/constants/routines';
import { todayIso } from '@/utils/datetime';

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

type Captured = { method: string; path: string; body: unknown };
type RecordedRequest = { name: string } & Captured;
type CaseRecord = {
  caseId: string;
  instant: string;
  expectedDate: string;
  deviceTimeZone: string;
  requests: RecordedRequest[];
};

const records: CaseRecord[] = [];
const realFetch = global.fetch;

function captureFetch(sink: Captured[]) {
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    sink.push({
      method: init?.method ?? 'GET',
      // Record the path relative to the `/api/v1` prefix so the server test can replay it.
      path: url.replace(/^.*?\/api\/v1(?=\/)/, ''),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    return { ok: true, status: 201, text: async () => JSON.stringify({ id: 1 }) };
  }) as unknown as typeof fetch;
}

/** Drive the real add-routine screen to its submit and return what it hands to `onAdd`. */
async function routineFromAddScreen(): Promise<NewRoutine> {
  const onAdd = jest.fn();
  const { getByText, unmount } = await render(<AddRoutineScreen onAdd={onAdd} />);
  await fireEvent.press(getByText('추천 루틴')); // unfold the preset accordion
  await fireEvent.press(getByText('독서 30분'));
  await fireEvent.press(getByText('루틴 추가하기'));
  unmount();
  expect(onAdd).toHaveBeenCalledTimes(1);
  return onAdd.mock.calls[0][0] as NewRoutine;
}

afterEach(() => {
  global.fetch = realFetch;
  jest.useRealTimers();
});

afterAll(() => {
  const out = process.env.DATE_BOUNDARY_OUT;
  if (!out) return;
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(
    out,
    JSON.stringify(
      { tz: process.env.TZ ?? null, fixtureSchemaVersion: fixture.schemaVersion, records },
      null,
      2,
    ) + '\n',
  );
});

describe('real request builders at spec date-boundary instants', () => {
  test.each(fixture.cases)('$id — $description', async (c) => {
    jest.useFakeTimers({ ...DATE_ONLY, now: new Date(c.instant) });
    const sink: Captured[] = [];
    captureFetch(sink);

    // 1) Routine completion: the 방 tab passes `todayIso()` as the completion date.
    await completeRoutine(1, todayIso());
    // 2) Routine creation: the add-routine screen's default start date → adapter → request.
    const draft = await routineFromAddScreen();
    await createRoutine(toRoutineCreate(draft));

    const [complete, create] = sink;
    expect(complete).toMatchObject({ method: 'POST', path: '/routines/1/logs' });
    expect((complete.body as { routineDate: string }).routineDate).toBe(c.expectedDate);
    expect(create).toMatchObject({ method: 'POST', path: '/routines' });
    expect((create.body as { startsOn: string }).startsOn).toBe(c.expectedDate);

    records.push({
      caseId: c.id,
      instant: c.instant,
      expectedDate: c.expectedDate,
      deviceTimeZone: process.env.TZ ?? 'unset',
      requests: [
        { name: 'routine-complete', ...complete },
        { name: 'routine-create', ...create },
      ],
    });
  });
});
