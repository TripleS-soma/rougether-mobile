import {
  toAppCategory,
  toAppRoutine,
  toAppTodo,
  toCalendarItems,
  toCategoryCreate,
  toRoutineCreate,
  toRoutineUpdate,
  toServerItemId,
  toTodoCreate,
  toTodoUpdate,
  todayCompletions,
} from '@/api/adapters/routine-todo';
import type { RoutineResponse, TodayResponse } from '@/api/types';
import type { NewRoutine } from '@/constants/routines';

describe('API adapters — routine / todo', () => {
  it('maps a weekly PHOTO routine to the app model', () => {
    const api: RoutineResponse = {
      id: 12,
      title: '운동',
      categoryId: 3,
      authType: 'PHOTO',
      status: 'ACTIVE',
      repeatType: 'WEEKLY',
      repeatDays: { daysOfWeek: ['MON', 'WED', 'SUN'] },
      scheduledTime: '07:30:00',
      startsOn: '2026-07-01',
    };
    const r = toAppRoutine(api);
    expect(r).toMatchObject({
      id: 'r12',
      title: '운동',
      category: '3',
      photoVerify: true,
      days: [1, 3, 0],
      time: '07:30',
      alarmEnabled: true,
      kind: 'routine',
    });
  });

  it('builds a create request: weekday numbers → codes, DAILY when no days', () => {
    const weekly: NewRoutine = {
      title: '독서',
      category: '5',
      days: [1, 5],
      startDate: '2026-07-02',
      alarmEnabled: true,
      time: '21:00',
    };
    expect(toRoutineCreate(weekly)).toMatchObject({
      title: '독서',
      categoryId: 5,
      authType: 'CHECK',
      repeatType: 'WEEKLY',
      repeatDays: { daysOfWeek: ['MON', 'FRI'] },
      scheduledTime: '21:00:00',
      startsOn: '2026-07-02',
    });

    const daily: NewRoutine = { ...weekly, days: [], alarmEnabled: false };
    const req = toRoutineCreate(daily);
    expect(req.repeatType).toBe('DAILY');
    expect(req.repeatDays).toBeUndefined();
    expect(req.scheduledTime).toBeUndefined();
  });

  it('round-trips 격주/매월/매년 repeats (#255)', () => {
    // BIWEEKLY: daysOfWeek travel like WEEKLY, kind is kept.
    const biweekly = toAppRoutine({
      id: 1,
      title: '분리수거',
      repeatType: 'BIWEEKLY',
      repeatDays: { daysOfWeek: ['TUE'] },
      startsOn: '2026-07-07',
    });
    expect(biweekly).toMatchObject({ repeat: 'biweekly', days: [2] });
    expect(
      toRoutineCreate({
        title: '분리수거', category: '1', repeat: 'biweekly', days: [2],
        startDate: '2026-07-07', alarmEnabled: false, time: '',
      }), // prettier-ignore
    ).toMatchObject({ repeatType: 'BIWEEKLY', repeatDays: { daysOfWeek: ['TUE'] } });

    // MONTHLY: dayOfMonth both ways.
    const monthly = toAppRoutine({
      id: 2,
      title: '월말 결산',
      repeatType: 'MONTHLY',
      repeatDays: { dayOfMonth: 31 },
    });
    expect(monthly).toMatchObject({ repeat: 'monthly', dayOfMonth: 31, days: undefined });
    expect(
      toRoutineCreate({
        title: '월말 결산', category: '1', repeat: 'monthly', days: [], dayOfMonth: 31,
        startDate: '2026-07-01', alarmEnabled: false, time: '',
      }), // prettier-ignore
    ).toMatchObject({ repeatType: 'MONTHLY', repeatDays: { dayOfMonth: 31 } });

    // YEARLY: the API's month/day fold into the app's month/dayOfMonth.
    const yearly = toAppRoutine({
      id: 3,
      title: '건강검진',
      repeatType: 'YEARLY',
      repeatDays: { month: 7, day: 12 },
    });
    expect(yearly).toMatchObject({ repeat: 'yearly', month: 7, dayOfMonth: 12 });
    expect(
      toRoutineCreate({
        title: '건강검진', category: '1', repeat: 'yearly', days: [], dayOfMonth: 12, month: 7,
        startDate: '2026-07-01', alarmEnabled: false, time: '',
      }), // prettier-ignore
    ).toMatchObject({ repeatType: 'YEARLY', repeatDays: { month: 7, day: 12 } });

    // Update keeps the cadence when an unrelated field changes.
    const req = toRoutineUpdate(monthly, { title: '결산' });
    expect(req).toMatchObject({ repeatType: 'MONTHLY', repeatDays: { dayOfMonth: 31 } });
  });

  it('maps todos and builds a todo create request', () => {
    expect(
      toAppTodo({
        id: 9,
        title: '장보기',
        categoryId: 2,
        dueDate: '2026-07-03',
        status: 'PENDING',
      }),
    ).toMatchObject({
      id: 't9',
      title: '장보기',
      category: '2',
      dueDate: '2026-07-03',
      kind: 'todo',
    });
    expect(toTodoCreate('2', '장보기', '2026-07-03')).toEqual({
      title: '장보기',
      categoryId: 2,
      dueDate: '2026-07-03',
    });
  });

  it('maps todo dueTime to the shared time slot and back (#325)', () => {
    // dueTime 있는 투두 → time/alarmEnabled, 없으면 알람 없음.
    const timed = toAppTodo({ id: 9, title: '장보기', dueDate: '2026-07-03', dueTime: '18:00:00' });
    expect(timed).toMatchObject({ time: '18:00', alarmEnabled: true });
    expect(toAppTodo({ id: 9, title: '장보기' })).toMatchObject({ alarmEnabled: false });
    // 업데이트: 시간이 켜져 있을 때만 dueTime 전송(HH:mm:ss) — 해제는 서버 미지원.
    expect(toTodoUpdate(timed, { alarmEnabled: true, time: '09:05' }).dueTime).toBe('09:05:00');
    expect(toTodoUpdate(toAppTodo({ id: 9, title: '장보기' })).dueTime).toBeUndefined();
  });

  it('keeps routine/todo app ids distinct when server ids collide', () => {
    // Routine and todo ids are separate server sequences — both can be 5.
    const r = toAppRoutine({ id: 5, title: '루틴' });
    const td = toAppTodo({ id: 5, title: '투두' });
    expect(r.id).not.toBe(td.id);
    expect(toServerItemId(r.id)).toBe(5);
    expect(toServerItemId(td.id)).toBe(5);
  });

  it('builds today completions from routine/todo status', () => {
    const today: TodayResponse = {
      date: '2026-07-02',
      categories: [
        {
          categoryId: 1,
          routines: [
            { id: 1, title: 'a', completed: true },
            { id: 2, title: 'b', completed: false },
          ],
          todos: [{ id: 3, title: 'c', status: 'COMPLETED' }],
        },
      ],
    };
    const map = todayCompletions(today, '2026-07-02');
    expect(map['r1']).toEqual(['2026-07-02']);
    expect(map['r2']).toBeUndefined();
    expect(map['t3']).toEqual(['2026-07-02']);
  });

  it('flattens a /calendar day into 달력 items with the record-time category', () => {
    const items = toCalendarItems({
      date: '2026-07-06',
      categories: [
        {
          categoryId: 7, // deleted server-side — still resolves by id
          routines: [{ id: 1, title: '아침 운동', scheduledTime: '07:00:00', completed: true }],
          todos: [{ id: 2, title: '장보기', status: 'PENDING' }],
        },
        { routines: [{ id: 3, title: '미분류 루틴', completed: false }], todos: [] },
      ],
    });
    expect(items).toEqual([
      { id: 'r1', kind: 'routine', title: '아침 운동', time: '07:00', completed: true, category: '7' }, // prettier-ignore
      { id: 't2', kind: 'todo', title: '장보기', completed: false, category: '7' },
      { id: 'r3', kind: 'routine', title: '미분류 루틴', time: undefined, completed: false, category: undefined }, // prettier-ignore
    ]);
  });

  it('keeps deleted categories flagged for historical lookup', () => {
    expect(toAppCategory({ id: 9, name: '옛것', deleted: true })).toMatchObject({
      id: '9',
      name: '옛것',
      deleted: true,
    });
    expect(toAppCategory({ id: 10, name: '현역' }).deleted).toBeUndefined();
  });

  it('maps category visibility both ways (lossless 4-level round-trip)', () => {
    // 1:1 — 공개↔PUBLIC, 이웃 공개↔HOUSE, 일부 공개↔FRIENDS, 비공개↔PRIVATE.
    expect(toAppCategory({ id: 4, name: '취미', visibility: 'PUBLIC' }).visibility).toBe('public');
    expect(toAppCategory({ id: 4, name: '취미', visibility: 'HOUSE' }).visibility).toBe('neighbor');
    expect(toAppCategory({ id: 4, name: '취미', visibility: 'FRIENDS' }).visibility).toBe(
      'partial',
    );
    expect(toAppCategory({ id: 4, name: '취미', visibility: 'PRIVATE' }).visibility).toBe(
      'private',
    );

    const cat = { id: 'x', name: '취미', icon: 'palette', color: '#123456' } as const;
    expect(toCategoryCreate({ ...cat, visibility: 'public' }).visibility).toBe('PUBLIC');
    expect(toCategoryCreate({ ...cat, visibility: 'neighbor' }).visibility).toBe('HOUSE');
    expect(toCategoryCreate({ ...cat, visibility: 'partial' }).visibility).toBe('FRIENDS');
    expect(toCategoryCreate({ ...cat, visibility: 'private' }).visibility).toBe('PRIVATE');
  });

  it('round-trips the mission/house link ids (#578)', () => {
    // Routine ↔ houseMissionId: 서버 id가 앱 linkedMissionId로 오간다.
    const linked = toAppRoutine({ id: 12, title: '아침 스트레칭', houseMissionId: 6 });
    expect(linked.linkedMissionId).toBe(6);
    expect(toAppRoutine({ id: 12, title: '미연동', houseMissionId: null }).linkedMissionId).toBeUndefined(); // prettier-ignore
    expect(
      toRoutineCreate({
        title: '아침 스트레칭', category: '1', days: [], startDate: '2026-07-01',
        alarmEnabled: false, time: '', linkedMissionId: 6,
      }).houseMissionId, // prettier-ignore
    ).toBe(6);
    // 이름을 바꿔도 링크 id는 그대로 실려 연동이 유지된다.
    expect(toRoutineUpdate(linked, { title: '이름 바꿈' })).toMatchObject({ houseMissionId: 6 });
    // 미연동 루틴 수정은 houseMissionId를 싣지 않는다 — 링크를 건드리지 않음
    // (해제는 전용 DELETE 엔드포인트).
    expect(toRoutineUpdate({ ...linked, linkedMissionId: undefined }).houseMissionId).toBeUndefined(); // prettier-ignore

    // Category ↔ houseId.
    expect(toAppCategory({ id: 20, name: 'TripleS', houseId: 2 }).houseId).toBe(2);
    expect(toAppCategory({ id: 20, name: '일반', houseId: null }).houseId).toBeUndefined();
    const cat = { id: '20', name: 'TripleS', icon: 'house', color: '#123456', visibility: 'neighbor', houseId: 2 } as const; // prettier-ignore
    expect(toCategoryCreate(cat).houseId).toBe(2);
    expect(toCategoryCreate({ ...cat, houseId: undefined }).houseId).toBeUndefined();
  });

  it('clears alarm time and end date with explicit nulls on update', () => {
    const routine = {
      id: 'r7',
      title: '아침 운동',
      category: '5',
      days: [1, 5],
      startDate: '2026-07-02',
      endDate: '2026-12-31',
      alarmEnabled: true,
      time: '07:30',
      kind: 'routine' as const,
    };
    // Turning the alarm off / dropping the 종료일 must send null (the server
    // treats PUT as full replace — null unsets the column).
    const req = toRoutineUpdate(routine, { alarmEnabled: false, endDate: undefined, days: [] });
    expect(req.scheduledTime).toBeNull();
    expect(req.endsOn).toBeNull();
    expect(req.repeatDays).toBeNull();
    expect(req.repeatType).toBe('DAILY');
  });

  it('기존 사진 인증 루틴은 수정해도 authType PHOTO를 유지한다 (#695)', () => {
    // UI는 제거됐지만(PR #712) PUT이 전체 교체라, 다른 필드만 고친 수정이
    // 서버의 PHOTO를 CHECK로 조용히 바꾸면 안 된다 — photoVerify 왕복이 근거.
    const routine = {
      id: 'r8',
      title: '운동 인증',
      category: '5',
      days: [],
      startDate: '2026-07-02',
      alarmEnabled: false,
      time: '',
      kind: 'routine' as const,
      photoVerify: true,
    };
    expect(toRoutineUpdate(routine, { title: '이름 변경' }).authType).toBe('PHOTO');
    // photoVerify 없는 일반 루틴은 그대로 CHECK.
    expect(toRoutineUpdate({ ...routine, photoVerify: undefined }, {}).authType).toBe('CHECK');
  });
});
