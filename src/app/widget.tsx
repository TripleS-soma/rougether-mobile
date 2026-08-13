import { Redirect } from 'expo-router';

/**
 * 위젯 딥링크 수신 (#803·#805) — `rougether://widget`. 위젯 탭이 계기를 남기려면
 * URL로 열려야 하는데(`app-open.ts`가 그 URL을 보고 `source: widget`으로 센다),
 * 대응 라우트가 없으면 expo-router가 매칭 실패 화면을 띄운다. 계측은 URL 수신만
 * 필요하므로 여기서는 즉시 루트로 넘긴다 — 위젯은 "앱을 열어라"가 전부다.
 */
export default function WidgetDeepLink() {
  return <Redirect href="/" />;
}
