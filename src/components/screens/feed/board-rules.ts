/**
 * 게시판별 작성 조건 (서버 #428·#430, spec feed/features.md "게시판 구분") — 화면(버튼·안내)과
 * 훅(제출 가드)이 같은 판정을 쓰도록 한 곳에.
 *
 * - `FREE`: 사진 0–10장. 사진이 없으면 공백을 뺀 본문이 필수. 루틴 연결 없음.
 * - `VERIFICATION`: 사진 1–10장 필수, 본문 선택, **최근 7일 안에 완료한 루틴 하나 연결 필수**.
 */
import type {
  FeedBoardType,
  FeedDraftImage,
  FeedPost,
  FeedPostEdit,
  FeedRoutineCompletion,
} from '@/components/screens/feed/types';

/** 지금 올릴 수 없는 이유 — null이면 올릴 수 있다. */
export type FeedComposeBlocker =
  'needPhoto' | 'needRoutine' | 'needContent' | 'waitUpload' | 'uploadFailed';

export function feedComposeBlocker(
  board: FeedBoardType,
  images: readonly FeedDraftImage[],
  content: string,
  routine: FeedRoutineCompletion | null,
): FeedComposeBlocker | null {
  if (images.length === 0) {
    if (board === 'VERIFICATION') return 'needPhoto';
    return content.trim() ? null : 'needContent';
  }
  if (board === 'VERIFICATION' && !routine) return 'needRoutine';
  if (images.some((img) => img.status === 'uploading')) return 'waitUpload';
  if (images.some((img) => img.status !== 'done' || img.imageId == null)) return 'uploadFailed';
  return null;
}

/** 이 글의 본문을 비울 수 있는가 — 사진 없는 자유글만 본문이 필수(수정 포함). */
export function feedContentRequired(board: FeedBoardType, imageCount: number): boolean {
  return board === 'FREE' && imageCount === 0;
}

/** 수정에서 인증게시판으로 옮길 수 있는가 — 사진은 수정할 수 없으니 이미 사진이 있는 글만. */
export function feedCanBeVerification(imageCount: number): boolean {
  return imageCount > 0;
}

/** 수정 창에서 저장할 수 없는 이유 — null이면 저장할 수 있다. */
export type FeedEditBlocker = 'needPhotoForVerification' | 'needRoutine' | 'needContent';

/** 수정 창의 초안 — 게시판·연결 루틴·본문. */
export type FeedEditDraft = {
  board: FeedBoardType;
  routine: FeedRoutineCompletion | null;
  content: string;
};

type EditablePost = Pick<FeedPost, 'boardType' | 'routine' | 'images'>;

/**
 * 수정 저장 조건 (서버 #430) — 자유 → 인증은 사진이 있는 글 + 루틴 선택이 필요하다. 인증으로
 * 남는 글은 루틴을 바꾸지 않아도 된다(생략 = 기존 연결 유지, 연결 없는 옛 글도 그대로).
 */
export function feedEditBlocker(post: EditablePost, draft: FeedEditDraft): FeedEditBlocker | null {
  const imageCount = post.images.length;
  if (draft.board === 'VERIFICATION' && post.boardType !== 'VERIFICATION') {
    if (!feedCanBeVerification(imageCount)) return 'needPhotoForVerification';
    if (!draft.routine) return 'needRoutine';
  }
  if (feedContentRequired(draft.board, imageCount) && !draft.content.trim()) return 'needContent';
  return null;
}

const sameCompletion = (a: FeedRoutineCompletion | null, b: FeedRoutineCompletion | null) =>
  a?.routineId === b?.routineId && a?.date === b?.date;

/**
 * 수정 초안 → PATCH 요청. 본문은 늘 보내고, 게시판은 바뀔 때만, 연결 루틴은 인증 결과이면서
 * 고른 값이 원래 연결과 다를 때만 싣는다. 자유로 바꾸면 연결을 싣지 않는다(서버가 해제한다 —
 * 자유 결과에 연결을 보내면 400 FEED_INPUT_INVALID).
 */
export function feedPostEditRequest(post: EditablePost, draft: FeedEditDraft): FeedPostEdit {
  const edit: FeedPostEdit = { content: draft.content };
  if (draft.board !== post.boardType) edit.boardType = draft.board;
  if (draft.board === 'VERIFICATION' && draft.routine) {
    const original = post.routine
      ? { routineId: post.routine.routineId, date: post.routine.date }
      : null;
    if (draft.board !== post.boardType || !sameCompletion(draft.routine, original)) {
      edit.routineCompletion = { routineId: draft.routine.routineId, date: draft.routine.date };
    }
  }
  return edit;
}
