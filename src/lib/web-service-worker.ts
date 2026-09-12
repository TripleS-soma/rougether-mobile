/**
 * 웹(PWA) 서비스워커 등록 스크립트 — `+html.tsx`가 `<head>`에 인라인으로 싣는다.
 * 문자열로 둔 건 앱 번들이 아니라 정적 HTML이 로드 직후 실행해야 해서다.
 *
 * 등록 거부는 삼킨다 (#1300). 크롤러·헤드리스 렌더러나 저장소를 막은 브라우저에서는
 * `register`가 거부되는데, 처리하지 않으면 Sentry에 `Error: Rejected`(unhandled)로 쌓였다.
 * 앱은 서비스워커 없이도 그대로 돌아가고 재방문 캐시만 켜지지 않는다.
 */
export const SERVICE_WORKER_REGISTER_SCRIPT =
  "if('serviceWorker' in navigator){addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js').catch(()=>{})})}";
