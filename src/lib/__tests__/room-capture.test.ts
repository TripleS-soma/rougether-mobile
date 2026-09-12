import * as MediaLibrary from 'expo-media-library';

import { saveRoomImage } from '@/lib/room-capture';

jest.mock('react-native-view-shot', () => ({
  captureRef: jest.fn(async () => 'file:///tmp/room.png'),
}));
// 전역 목(jest/expo-media-library-mock.js)은 인자를 기록하지 않는 일반 함수라, 호출 인자를
// 단언하는 이 파일에서만 jest.fn으로 덮는다.
jest.mock('expo-media-library', () => ({
  requestPermissionsAsync: jest.fn(),
  saveToLibraryAsync: jest.fn(async () => {}),
}));

const request = MediaLibrary.requestPermissionsAsync as jest.Mock;
const save = MediaLibrary.saveToLibraryAsync as jest.Mock;

describe('saveRoomImage', () => {
  /**
   * Play 사진/동영상 권한 정책(2026-09-12 거절)으로 READ_MEDIA_IMAGES/VIDEO를 매니페스트에서
   * 뗐다. 저장은 쓰기 전용 요청이어야 한다 — 인자 없이 부르면 뗀 읽기 권한까지 요구해
   * Android 13+에서 늘 거부되고, 방 사진 저장이 조용히 죽는다.
   */
  it('앨범 저장은 쓰기 전용 권한만 묻는다', async () => {
    request.mockResolvedValueOnce({ granted: true });
    const ref = { current: {} as never };

    await expect(saveRoomImage(ref)).resolves.toBe('saved');

    expect(request).toHaveBeenCalledWith(true);
    expect(save).toHaveBeenCalledWith('file:///tmp/room.png');
  });

  it('권한이 거부되면 캡처하지 않고 denied', async () => {
    request.mockResolvedValueOnce({ granted: false });

    await expect(saveRoomImage({ current: {} as never })).resolves.toBe('denied');
    expect(save).not.toHaveBeenCalled();
  });
});
