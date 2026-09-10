import { parseInviteText } from '@/lib/invite-code';

describe('parseInviteText (#1007)', () => {
  it('서버 랜딩이 복사하는 봉투를 읽는다', () => {
    expect(parseInviteText('rougether-invite:friend:abcd2345')).toEqual({
      kind: 'friend',
      code: 'ABCD2345',
    });
    expect(parseInviteText('  rougether-invite:house:XY12ZW  ')).toEqual({
      kind: 'house',
      code: 'XY12ZW',
    });
  });

  it('친구가 보낸 공유 메시지를 통째로 붙여넣어도 링크에서 코드를 찾는다', () => {
    const message =
      '루게더에서 함께 루틴 지켜요! 내 초대코드: ABCD2345\nhttps://rougether.com/invite.html?code=ABCD2345';
    expect(parseInviteText(message)).toEqual({ kind: 'friend', code: 'ABCD2345' });
    expect(parseInviteText('https://rougether.com/join.html?code=HOUSE9')).toEqual({
      kind: 'house',
      code: 'HOUSE9',
    });
  });

  it('앱 스킴과 서버 짧은 링크도 읽는다', () => {
    expect(parseInviteText('rougether://invite?code=ab12cd34')).toEqual({
      kind: 'friend',
      code: 'AB12CD34',
    });
    expect(parseInviteText('rougether://join?code=QW12')).toEqual({ kind: 'house', code: 'QW12' });
    expect(parseInviteText('https://rougether.app/i/ABCD2345')).toEqual({
      kind: 'friend',
      code: 'ABCD2345',
    });
    expect(parseInviteText('https://api.rougether.com/h/HOME77')).toEqual({
      kind: 'house',
      code: 'HOME77',
    });
  });

  it('rougether가 아닌 호스트의 /i/ 경로는 초대 링크가 아니다', () => {
    expect(parseInviteText('https://example.com/i/ABCD2345')).toBeNull();
  });

  it('코드만 붙여넣으면 친구 코드로 본다 — rougether.com 랜딩의 복사 버튼', () => {
    expect(parseInviteText('abcd2345')).toEqual({ kind: 'friend', code: 'ABCD2345' });
    // 앞뒤 공백·줄바꿈은 괜찮다.
    expect(parseInviteText('  ABCD2345\n')).toEqual({ kind: 'friend', code: 'ABCD2345' });
  });

  it('코드 모양이 아니면 null — 문장·너무 짧은 글·기호', () => {
    expect(parseInviteText('오늘 저녁에 만나')).toBeNull();
    // 공백으로 나뉜 단어를 이어 붙여 코드로 만들지 않는다.
    expect(parseInviteText('hello world friend')).toBeNull();
    expect(parseInviteText('ABCD 2345')).toBeNull();
    expect(parseInviteText('AB1')).toBeNull();
    expect(parseInviteText('ABCD-2345')).toBeNull();
    expect(parseInviteText('')).toBeNull();
    expect(parseInviteText(null)).toBeNull();
    expect(parseInviteText('rougether-invite:friend:')).toBeNull();
  });
});
