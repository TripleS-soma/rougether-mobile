/** 기기 캘린더 일정 임포트 (#844, 서버 2026-08-19). */
import type { DeviceRepeat } from '@/lib/device-calendar';

import { toApiRepeat } from './adapters';
import { apiPost } from './client';
import type { RoutineResponse, TodoResponse } from './types';

/**
 * 유사 비교 요청/응답 타입.
 *
 * `gen:api-types`가 만드는 `SimilarityResponse.items`는 요청 타입인 `Item`
 * (date·title)을 가리키는데, **실 응답은 그보다 필드가 많다**(hasSimilar·
 * similar[]). 2026-08-19 실호출로 확인했다 — 생성 타입을 그대로 쓰면 결과를
 * 읽을 수 없어 여기 손으로 적는다. 스웨거가 응답 스키마를 분리하면 그때
 * 생성 타입으로 옮길 것.
 */
export type SimilarKind = 'ROUTINE' | 'TODO';
export type SimilarMatchType = 'EXACT' | 'EMBEDDING';

export type SimilarHit = {
  kind: SimilarKind;
  id: number;
  title: string;
  /** 0~1. EXACT는 1.0. */
  score: number;
  matchType: SimilarMatchType;
};

export type SimilarityItem = {
  date: string;
  title: string;
  hasSimilar: boolean;
  similar: SimilarHit[];
};

export type SimilarityResult = {
  /**
   * 임베딩 비교가 실제로 적용됐는지. false면 서버가 임베딩을 못 써서
   * (키 미설정·외부 API 장애) 정규화 일치만 본 것이다 — **임포트는 계속
   * 진행할 수 있다.** 힌트가 덜 똑똑해질 뿐이다.
   */
  embeddingApplied: boolean;
  /** 요청 items와 같은 순서. */
  items: SimilarityItem[];
};

/**
 * POST /routines/similarity — 날짜·제목 목록(1~200개)에 대해 그날 예정인 내
 * 루틴·투두 중 제목이 비슷한 것을 최대 3개씩. **아무것도 저장하지 않는다.**
 */
export function fetchSimilarity(items: { date: string; title: string }[]) {
  return apiPost<SimilarityResult>('/routines/similarity', { items });
}

export type ImportTodoInput = {
  title: string;
  dueDate: string;
  /** 출처 (대문자 영숫자·언더스코어, 최대 30자). 서버는 값을 해석하지 않는다. */
  externalSource: string;
  /** 그 캘린더의 이벤트 id (최대 255자). */
  externalId: string;
  categoryId?: number;
};

/**
 * POST /todos — 임포트 투두 생성. 같은 `externalSource`+`externalId` 조합은
 * 회원당 한 번뿐이고, **사용자가 지운 조합도 재등록되지 않는다**(서버 규칙).
 * 중복이면 409 `TODO_EXTERNAL_DUPLICATE` — 호출부가 "이미 가져옴"으로 보고
 * 건너뛴다. 지운 걸 되살리지 않는 게 의도다.
 */
export function importCalendarTodo(input: ImportTodoInput) {
  return apiPost<TodoResponse>('/todos', input);
}

export type ImportRoutineInput = {
  title: string;
  /** 반복 종류 — 서버 repeatType으로 변환해 보낸다. */
  repeat: DeviceRepeat;
  /** 주간·격주의 요일 (0=일 … 6=토). 실제 회차 날짜에서 뽑는다. */
  days: number[];
  /** 월간·연간의 일. 연간은 month와 함께. */
  dayOfMonth?: number;
  month?: number;
  /** 창 안 첫 회차 날짜 — 서버는 과거 startsOn을 거부한다. */
  startsOn: string;
  externalSource: string;
  /** 루틴은 시리즈당 한 행이라 **시리즈 id**다 (투두는 회차 키). */
  externalId: string;
  categoryId?: number;
};

/**
 * POST /routines — 기기 캘린더의 **반복 일정**을 루틴으로 (#952).
 * 회차마다 투두를 만들면 매주 회의가 창 안에서 4~5개로 불어난다.
 *
 * 중복이면 409 `ROUTINE_EXTERNAL_DUPLICATE` — 투두와 같이 "이미 가져옴"으로
 * 건너뛴다. 서버는 지운 조합도 재등록해주지 않는다.
 */
export function importCalendarRoutine(input: ImportRoutineInput) {
  const { repeat, days, dayOfMonth, month, ...rest } = input;
  return apiPost<RoutineResponse>('/routines', {
    ...rest,
    ...toApiRepeat({ repeat, days, dayOfMonth, month }),
    authType: 'CHECK',
  });
}
