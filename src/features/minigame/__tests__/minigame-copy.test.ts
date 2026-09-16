import { i18n } from '@/i18n';
import {
  escapeHtml,
  getMinigameCopy,
  MINIGAME_FMT_SOURCE,
} from '@/features/minigame/minigame-copy';
import { createMergeHtml } from '@/features/minigame/merge-html';
import { createRunnerHtml } from '@/features/minigame/runner-html';
import { createStairsHtml } from '@/features/minigame/stairs-html';

const HANGUL = /[가-힣]/;
const build = () => [
  createMergeHtml({ seed: 1, channelId: 'test' }),
  createRunnerHtml({ seed: 1, channelId: 'test' }),
  createStairsHtml({ seed: 1, channelId: 'test' }),
];

/** 미니게임 WebView 문구 (#893) — 문서를 만드는 시점의 언어로 문구가 실린다. */
describe('minigame copy', () => {
  afterEach(async () => {
    await i18n.changeLanguage('ko');
  });

  it('한국어 문서는 기존 문구를 그대로 싣는다', () => {
    const [merge, runner, stairs] = build();
    expect(merge).toContain('합치기 시작');
    expect(merge).toContain('lang="ko"');
    expect(runner).toContain('"title":"루틴 러너"');
    expect(stairs).toContain('"timeout":"시간 초과"');
  });

  it('영어 문서에는 한글이 한 글자도 없다', async () => {
    await i18n.changeLanguage('en');
    for (const html of build()) {
      expect(html).toContain('lang="en"');
      expect(html.match(new RegExp(HANGUL.source, 'g'))).toBeNull();
    }
  });

  it('게임별 문구는 공통 문구와 합쳐지고 자리표시자를 보간 전 그대로 둔다', async () => {
    await i18n.changeLanguage('en');
    const copy = getMinigameCopy('stairs');
    expect(copy.start).toBe('Start');
    expect(copy.steps).toBe('{{score}} steps');
  });

  it('문서 안 fmt는 i18next 자리표시자를 채운다', () => {
    const fmt = new Function(`${MINIGAME_FMT_SOURCE}; return fmt;`)() as (
      t: string,
      v?: Record<string, unknown>,
    ) => string;
    expect(fmt('{{score}}점', { score: 12 })).toBe('12점');
    expect(fmt('Row {{ row }}:', { row: 2 })).toBe('Row 2:');
    expect(fmt('{{missing}} steps', {})).toBe(' steps');
  });

  it('두 언어 모두 문서 스크립트가 문법 오류 없이 파싱된다', async () => {
    for (const lng of ['ko', 'en']) {
      await i18n.changeLanguage(lng);
      for (const html of build()) {
        const script = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
        // 실행하지 않고 파싱만 — DOM 없이 문법만 확인한다.
        expect(() => new Function(script)).not.toThrow();
      }
    }
  });

  it('마크업에 들어가는 문구를 이스케이프한다', () => {
    expect(escapeHtml(`"<b>'&`)).toBe('&quot;&lt;b&gt;&#39;&amp;');
  });
});
