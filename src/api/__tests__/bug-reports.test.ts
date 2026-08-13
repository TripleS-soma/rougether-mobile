import { submitBugReport } from '@/api/bug-reports';
import { apiPost } from '@/api/client';

jest.mock('@/api/client', () => ({
  apiPost: jest.fn().mockResolvedValue({ bugReportId: 1 }),
  apiGetList: jest.fn().mockResolvedValue([]),
}));

// 텍스트를 쿼리 파라미터로 보내던 시절 Tomcat URL 한도로 한글 ~850자에서
// 400이 났다 — multipart 폼 필드 전환(#567) 뒤에는 경로에 쿼리가 없어야 하고
// 긴 내용도 폼 필드로 실려야 한다.
describe('submitBugReport (#567)', () => {
  it('텍스트를 쿼리스트링 대신 multipart 폼 필드로 보낸다', async () => {
    const longContent = '가'.repeat(1500);
    await submitBugReport({
      title: '버그 제목',
      content: longContent,
      appVersion: '1.2.0',
      deviceInfo: 'Pixel 7',
    });

    const [path, body] = (apiPost as jest.Mock).mock.calls[0] as [string, FormData];
    expect(path).toBe('/bug-reports');
    expect(path).not.toContain('?');

    // 폼 필드 확인 — jest는 node FormData(entries), 런타임 RN은 getParts.
    const fd = body as unknown as {
      entries?: () => IterableIterator<[string, unknown]>;
      getParts?: () => { fieldName: string; string?: string }[];
    };
    const parts = fd.entries
      ? [...fd.entries()]
      : (fd.getParts?.() ?? []).map((p) => [p.fieldName, p.string]);
    expect(parts).toEqual(
      expect.arrayContaining([
        ['title', '버그 제목'],
        ['content', longContent],
        ['appVersion', '1.2.0'],
        ['deviceInfo', 'Pixel 7'],
      ]),
    );
  });
});
