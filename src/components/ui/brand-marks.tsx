/**
 * Official social-provider brand marks, drawn with `react-native-svg` so they
 * stay crisp at any size (the old K/A/G text glyphs were placeholders, #236).
 *
 * These are **vendor assets, not app design tokens** — every provider forbids
 * recoloring or reshaping the mark, so the path data and colors are fixed here
 * and deliberately do NOT come from `useTokens()`:
 *
 * - 카카오: 심볼의 형태·비율·색상은 변경할 수 없다 (카카오 로그인 디자인 가이드).
 *   Symbol is black at 85% opacity on the #FEE500 container.
 * - Google: the "G" is the official `logo_googleg_48dp` artwork; its size and
 *   color must not be changed (Sign in with Google branding guidelines).
 * - Apple: the logo must be solid black or solid white — no custom colors
 *   (Sign in with Apple HIG) — so `AppleMark` takes only those two.
 *
 * Path data traced from each vendor's published artwork; see the PR for the
 * source of each mark.
 */
import Svg, { Path } from 'react-native-svg';

export type BrandMarkProps = {
  /** Mark width in px. Height follows the artwork's own aspect ratio. */
  size?: number;
};

/** Kakao speech-bubble symbol (말풍선). Artwork is 576×512, wider than tall. */
export function KakaoMark({ size = 24 }: BrandMarkProps) {
  return (
    <Svg width={size} height={(size * 512) / 576} viewBox="0 0 576 512">
      <Path
        d="M288 2.5c159.1 0 288 101.7 288 227.1 0 125.4-128.9 227.1-288 227.1-17.5 0-34.6-1.2-51.2-3.6-16.6 11.7-112.6 79.1-121.7 80.4 0 0-3.7 1.4-6.9-.4s-2.6-6.7-2.6-6.7C106.6 519.8 130.6 437.2 135 421.9 53.9 381.8 0 310.6 0 229.5 0 104.1 128.9 2.5 288 2.5z"
        fill="#000000"
        fillOpacity={0.85}
      />
    </Svg>
  );
}

/**
 * Google "G" — the four-color `logo_googleg_48dp` artwork on its native 18×18
 * grid. Coordinates are copied verbatim from Google's published button asset so
 * nobody has to trust a re-trace.
 */
export function GoogleMark({ size = 24 }: BrandMarkProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18">
      <Path
        d="M17.64,9.20454545 C17.64,8.56636364 17.5827273,7.95272727 17.4763636,7.36363636 L9,7.36363636 L9,10.845 L13.8436364,10.845 C13.635,11.97 13.0009091,12.9231818 12.0477273,13.5613636 L12.0477273,15.8195455 L14.9563636,15.8195455 C16.6581818,14.2527273 17.64,11.9454545 17.64,9.20454545 L17.64,9.20454545 Z"
        fill="#4285F4"
      />
      <Path
        d="M9,18 C11.43,18 13.4672727,17.1940909 14.9563636,15.8195455 L12.0477273,13.5613636 C11.2418182,14.1013636 10.2109091,14.4204545 9,14.4204545 C6.65590909,14.4204545 4.67181818,12.8372727 3.96409091,10.71 L0.957272727,10.71 L0.957272727,13.0418182 C2.43818182,15.9831818 5.48181818,18 9,18 L9,18 Z"
        fill="#34A853"
      />
      <Path
        d="M3.96409091,10.71 C3.78409091,10.17 3.68181818,9.59318182 3.68181818,9 C3.68181818,8.40681818 3.78409091,7.83 3.96409091,7.29 L3.96409091,4.95818182 L0.957272727,4.95818182 C0.347727273,6.17318182 0,7.54772727 0,9 C0,10.4522727 0.347727273,11.8268182 0.957272727,13.0418182 L3.96409091,10.71 L3.96409091,10.71 Z"
        fill="#FBBC05"
      />
      <Path
        d="M9,3.57954545 C10.3213636,3.57954545 11.5077273,4.03363636 12.4404545,4.92545455 L15.0218182,2.34409091 C13.4631818,0.891818182 11.4259091,0 9,0 C5.48181818,0 2.43818182,2.01681818 0.957272727,4.95818182 L3.96409091,7.29 C4.67181818,5.16272727 6.65590909,3.57954545 9,3.57954545 L9,3.57954545 Z"
        fill="#EA4335"
      />
    </Svg>
  );
}

export type AppleMarkProps = BrandMarkProps & {
  /** Apple allows the logo in solid black or solid white only. */
  color: '#000000' | '#FFFFFF';
};

/** Apple logo, on its native 24×24 grid. */
export function AppleMark({ size = 24, color }: AppleMarkProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
        fill={color}
      />
    </Svg>
  );
}
