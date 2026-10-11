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

  it('주소 바로 뒤에 붙은 한글 조사는 링크에 넣지 않는다 (#1508 리뷰)', () => {
    expect(splitLinks('https://a.com/x에서 봐요')).toEqual([
      { kind: 'link', text: 'https://a.com/x', url: 'https://a.com/x' },
      { kind: 'text', text: '에서 봐요' },
    ]);
    expect(splitLinks('www.rougether.com도 봐').find((s) => s.kind === 'link')).toMatchObject({
      text: 'www.rougether.com',
    });
    expect(splitLinks('https://a.com/xㅋㅋ').find((s) => s.kind === 'link')).toMatchObject({
      url: 'https://a.com/x',
    });
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

  // 확인 창이 보여 주는 도메인은 브라우저가 실제로 여는 곳이어야 한다 (#1508 리뷰).
  it('백슬래시·여러 @로 다른 도메인인 척하는 주소도 실제 호스트를 보여 준다', () => {
    expect(linkHost('https://evil.com\\@google.com/')).toBe('evil.com');
    expect(linkHost('https://google.com@evil.com/x')).toBe('evil.com');
    expect(linkHost('https://a@b@evil.com/')).toBe('evil.com');
  });
});
