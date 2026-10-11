import { linkHost, splitLinks } from '@/utils/linkify';

describe('splitLinks (#1507)', () => {
  it('링크가 없으면 글자 조각 하나', () => {
    expect(splitLinks('안녕하세요')).toEqual([{ kind: 'text', text: '안녕하세요' }]);
  });

  it('http(s)와 www. 주소를 링크로, 사이 글자는 그대로', () => {
    expect(splitLinks('봐요 https://a.com/x 그리고 www.b.kr 끝')).toEqual([
      { kind: 'text', text: '봐요 ' },
      { kind: 'link', text: 'https://a.com/x', url: 'https://a.com/x' },
      { kind: 'text', text: ' 그리고 ' },
      { kind: 'link', text: 'www.b.kr', url: 'https://www.b.kr' },
      { kind: 'text', text: ' 끝' },
    ]);
  });

  it('문장 끝 구두점·닫는 괄호는 주소에서 뺀다', () => {
    const segs = splitLinks('여기(https://a.com/x).');
    expect(segs).toEqual([
      { kind: 'text', text: '여기(' },
      { kind: 'link', text: 'https://a.com/x', url: 'https://a.com/x' },
      { kind: 'text', text: ').' },
    ]);
  });

  it('짝이 맞는 괄호는 주소에 남긴다', () => {
    const link = splitLinks('https://en.wikipedia.org/wiki/Foo_(bar) 참고').find(
      (s) => s.kind === 'link',
    );
    expect(link).toMatchObject({ text: 'https://en.wikipedia.org/wiki/Foo_(bar)' });
  });

  it('맨 도메인·이메일은 링크로 보지 않는다', () => {
    expect(splitLinks('example.com 이나 me@example.com').every((s) => s.kind === 'text')).toBe(
      true,
    );
  });
});

describe('linkHost', () => {
  it('확인 창에 보여 줄 호스트만 뽑는다(사용자 정보 제외)', () => {
    expect(linkHost('https://www.youtube.com/watch?v=1')).toBe('www.youtube.com');
    expect(linkHost('https://user:pw@evil.com/x')).toBe('evil.com');
    expect(linkHost('not a url')).toBe('not a url');
  });
});
