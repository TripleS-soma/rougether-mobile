import { photoRows, singlePhotoSize } from '@/components/chat/chat-photo-grid';

describe('채팅 사진 묶음 배치', () => {
  it('한 줄에 최대 3칸, 3으로 안 나눠떨어지면 앞줄을 2칸으로 둬 빈칸 없이 채운다', () => {
    expect(photoRows(0)).toEqual([]);
    expect(photoRows(1)).toEqual([1]);
    expect(photoRows(2)).toEqual([2]);
    expect(photoRows(3)).toEqual([3]);
    expect(photoRows(4)).toEqual([2, 2]);
    expect(photoRows(5)).toEqual([2, 3]);
    expect(photoRows(6)).toEqual([3, 3]);
    expect(photoRows(7)).toEqual([2, 2, 3]);
    expect(photoRows(8)).toEqual([2, 3, 3]);
    expect(photoRows(9)).toEqual([3, 3, 3]);
    expect(photoRows(10)).toEqual([2, 2, 3, 3]);
  });

  it('줄마다 칸 수를 더하면 사진 장수와 같다', () => {
    for (let count = 1; count <= 10; count += 1)
      expect(photoRows(count).reduce((sum, n) => sum + n, 0)).toBe(count);
  });

  it('한 장짜리는 비율을 살리되 3:4 ~ 4:3 사이로 가둔다', () => {
    expect(singlePhotoSize(1)).toEqual({ width: 184, height: 184 });
    expect(singlePhotoSize(4 / 3)).toEqual({ width: 184, height: 138 });
    // 파노라마도 4:3까지만 눕는다.
    expect(singlePhotoSize(5)).toEqual({ width: 184, height: 138 });
    expect(singlePhotoSize(3 / 4)).toEqual({ width: 138, height: 184 });
    expect(singlePhotoSize(0.1)).toEqual({ width: 138, height: 184 });
    // 크기를 모르면 정사각.
    expect(singlePhotoSize(0)).toEqual({ width: 184, height: 184 });
  });
});
