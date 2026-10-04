import { feedComposeBlocker, feedContentRequired } from '@/components/screens/feed/board-rules';
import type { FeedDraftImage } from '@/components/screens/feed/types';

const done: FeedDraftImage = { key: 'a', uri: '', status: 'done', imageId: 1 };
const uploading: FeedDraftImage = { key: 'b', uri: '', status: 'uploading' };
const failed: FeedDraftImage = { key: 'c', uri: '', status: 'failed' };

describe('게시판별 작성 조건 (서버 #428)', () => {
  it('자유게시판: 사진이 없으면 공백 아닌 본문이 필요하다', () => {
    expect(feedComposeBlocker('FREE', [], '')).toBe('needContent');
    expect(feedComposeBlocker('FREE', [], '   ')).toBe('needContent');
    expect(feedComposeBlocker('FREE', [], '글만 써요')).toBeNull();
    expect(feedComposeBlocker('FREE', [done], '')).toBeNull();
  });

  it('인증게시판: 본문이 있어도 사진이 1장 이상 필요하다', () => {
    expect(feedComposeBlocker('VERIFICATION', [], '본문만')).toBe('needPhoto');
    expect(feedComposeBlocker('VERIFICATION', [done], '')).toBeNull();
  });

  it('고른 사진이 올라가는 중이거나 실패했으면 어느 게시판이든 막는다', () => {
    expect(feedComposeBlocker('FREE', [done, uploading], '글')).toBe('waitUpload');
    expect(feedComposeBlocker('VERIFICATION', [failed], '')).toBe('uploadFailed');
  });

  it('본문 필수는 사진 없는 자유글뿐', () => {
    expect(feedContentRequired('FREE', 0)).toBe(true);
    expect(feedContentRequired('FREE', 2)).toBe(false);
    expect(feedContentRequired('VERIFICATION', 1)).toBe(false);
  });
});
