import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

const WEB_GA_ID = 'G-P8V3RCKCD5';

// 웹(PWA) 루트 HTML — 네이티브에는 영향 없음. 매니페스트·테마·서비스워커 등록.
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="ko">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
        <title>루게더</title>
        <meta name="description" content="내 캐릭터와, 친구들과 한 집에서 함께 크는 할 일 관리 앱" />
        <meta name="theme-color" content="#7FA87F" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="루게더" />
        <meta name="robots" content="noindex" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: 'html,body{background:#FBF8F3}' }} />
        <script
          dangerouslySetInnerHTML={{
            __html: "if('serviceWorker' in navigator){addEventListener('load',()=>navigator.serviceWorker.register('/sw.js'))}",
          }}
        />
        {/* GA4 — 웹앱 전용 속성 "루게더 웹앱"(랜딩·네이티브 앱과 분리). 네이티브 빌드에는 포함되지 않는다. */}
        <script async src={`https://www.googletagmanager.com/gtag/js?id=${WEB_GA_ID}`} />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${WEB_GA_ID}');`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
