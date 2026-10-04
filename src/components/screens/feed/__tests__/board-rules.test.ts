import {
  feedComposeBlocker,
  feedContentRequired,
  feedEditBlocker,
  feedPostEditRequest,
} from '@/components/screens/feed/board-rules';
import type { FeedDraftImage, FeedPost } from '@/components/screens/feed/types';

const done: FeedDraftImage = { key: 'a', uri: '', status: 'done', imageId: 1 };
const uploading: FeedDraftImage = { key: 'b', uri: '', status: 'uploading' };
const failed: FeedDraftImage = { key: 'c', uri: '', status: 'failed' };
const routine = { routineId: 15, date: '2026-10-04' };

describe('게시판별 작성 조건 (서버 #428)', () => {
  it('자유게시판: 사진이 없으면 공백 아닌 본문이 필요하다', () => {
    expect(feedComposeBlocker('FREE', [], '', null)).toBe('needContent');
    expect(feedComposeBlocker('FREE', [], '   ', null)).toBe('needContent');
    expect(feedComposeBlocker('FREE', [], '글만 써요', null)).toBeNull();
    expect(feedComposeBlocker('FREE', [done], '', null)).toBeNull();
  });

  it('인증게시판: 본문이 있어도 사진이 1장 이상 필요하다', () => {
    expect(feedComposeBlocker('VERIFICATION', [], '본문만', routine)).toBe('needPhoto');
    expect(feedComposeBlocker('VERIFICATION', [done], '', routine)).toBeNull();
  });

  it('인증게시판: 사진이 있어도 루틴을 골라야 한다 (서버 #430)', () => {
    expect(feedComposeBlocker('VERIFICATION', [done], '본문', null)).toBe('needRoutine');
    // 자유게시판은 루틴과 무관.
    expect(feedComposeBlocker('FREE', [done], '', null)).toBeNull();
  });

  it('고른 사진이 올라가는 중이거나 실패했으면 어느 게시판이든 막는다', () => {
    expect(feedComposeBlocker('FREE', [done, uploading], '글', null)).toBe('waitUpload');
    expect(feedComposeBlocker('VERIFICATION', [failed], '', routine)).toBe('uploadFailed');
  });

  it('본문 필수는 사진 없는 자유글뿐', () => {
    expect(feedContentRequired('FREE', 0)).toBe(true);
    expect(feedContentRequired('FREE', 2)).toBe(false);
    expect(feedContentRequired('VERIFICATION', 1)).toBe(false);
  });
});

describe('수정에서 게시판 전환 (서버 #430)', () => {
  const photo = { imageId: 1, width: 10, height: 10 };
  const freeText: Pick<FeedPost, 'boardType' | 'routine' | 'images'> = {
    boardType: 'FREE',
    routine: null,
    images: [],
  };
  const freePhoto = { ...freeText, images: [photo] };
  const verified: Pick<FeedPost, 'boardType' | 'routine' | 'images'> = {
    boardType: 'VERIFICATION',
    routine: { routineId: 9, title: '물 마시기', date: '2026-10-01' },
    images: [photo],
  };
  const legacy = { ...verified, routine: null };

  it('사진 없는 글은 인증으로 옮길 수 없다', () => {
    expect(feedEditBlocker(freeText, { board: 'VERIFICATION', routine, content: '글' })).toBe(
      'needPhotoForVerification',
    );
  });

  it('자유 → 인증은 루틴을 골라야 저장된다', () => {
    expect(feedEditBlocker(freePhoto, { board: 'VERIFICATION', routine: null, content: '' })).toBe(
      'needRoutine',
    );
    expect(feedEditBlocker(freePhoto, { board: 'VERIFICATION', routine, content: '' })).toBeNull();
  });

  it('인증으로 남는 글(연결 없는 옛 글 포함)은 루틴 없이도 저장된다', () => {
    expect(feedEditBlocker(legacy, { board: 'VERIFICATION', routine: null, content: '' })).toBe(
      null,
    );
  });

  it('사진 없는 자유글은 여전히 본문이 필요하다', () => {
    expect(feedEditBlocker(freeText, { board: 'FREE', routine: null, content: ' ' })).toBe(
      'needContent',
    );
  });

  it('자유로 바꾸면 boardType만 — routineCompletion은 싣지 않는다', () => {
    expect(
      feedPostEditRequest(verified, {
        board: 'FREE',
        routine: { routineId: 9, date: '2026-10-01' },
        content: '본문',
      }),
    ).toEqual({ content: '본문', boardType: 'FREE' });
  });

  it('인증으로 바꾸면 boardType과 routineCompletion을 함께', () => {
    expect(feedPostEditRequest(freePhoto, { board: 'VERIFICATION', routine, content: '' })).toEqual(
      { content: '', boardType: 'VERIFICATION', routineCompletion: routine },
    );
  });

  it('인증으로 남으면 루틴이 바뀔 때만 routineCompletion, 같으면 본문만', () => {
    expect(
      feedPostEditRequest(verified, {
        board: 'VERIFICATION',
        routine: { routineId: 9, date: '2026-10-01' },
        content: '본문',
      }),
    ).toEqual({ content: '본문' });
    expect(feedPostEditRequest(verified, { board: 'VERIFICATION', routine, content: '' })).toEqual({
      content: '',
      routineCompletion: routine,
    });
    expect(
      feedPostEditRequest(legacy, { board: 'VERIFICATION', routine: null, content: 'x' }),
    ).toEqual({ content: 'x' });
  });
});
