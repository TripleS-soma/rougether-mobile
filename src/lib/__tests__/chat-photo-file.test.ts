import { chatPhotoUploadFile } from '@/lib/chat-photo-file';

describe('chatPhotoUploadFile', () => {
  it('data URI의 형식을 읽어 이름을 붙이고 크기를 가늠한다', () => {
    const body = 'A'.repeat(4000);
    expect(chatPhotoUploadFile(`data:image/jpeg;base64,${body}`)).toEqual({
      uri: `data:image/jpeg;base64,${body}`,
      name: 'chat-photo.jpg',
      type: 'image/jpeg',
      fileSize: 3000,
    });
    expect(chatPhotoUploadFile('data:IMAGE/PNG;base64,AAAA')).toMatchObject({
      name: 'chat-photo.png',
      type: 'image/png',
    });
  });

  // 방금 보낸 사진은 아직 고른 파일 경로다 — 크기는 모른다(서버가 다시 본다).
  it('파일 경로는 확장자로 형식을 가늠한다', () => {
    expect(chatPhotoUploadFile('file:///tmp/picked.PNG')).toEqual({
      uri: 'file:///tmp/picked.PNG',
      name: 'chat-photo.png',
      type: 'image/png',
      fileSize: undefined,
    });
    expect(chatPhotoUploadFile('file:///tmp/picked.heic.jpg')).toMatchObject({
      type: 'image/jpeg',
    });
  });
});
