/**
 * Storybook(웹 Vite) 전용 빈 모듈 (#1660).
 *
 * `src/lib/analytics.ts`는 웹이면 Firebase를 `require`하기 전에 돌아가지만, Vite는 실행되지 않을
 * `require`도 미리 묶으려다 RNFB 내부 파일을 못 찾아 빌드가 깨졌다(집 화면이 `track`을 부르게 된 뒤).
 * 런타임에 쓰이지 않으니 빈 객체면 된다.
 */
export default {};
