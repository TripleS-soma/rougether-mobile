# 공식 SDK 다운로드 장애와 네이티브 지문 추적 누락을 고친 사례

- 날짜: 2026-11-09~11-10
- 영역: iOS Release 검증, SDK 의존성, OTA 런타임
- 관련 이슈와 PR: 모바일 #1694, #1695
- 키워드: CocoaPods, 무결성 검증, Expo config plugin, 네이티브 지문, 릴리스 게이트

## 배경

습관 형성을 돕는 소셜 루틴 앱에 크리스마스 이벤트를 공개하고 새 iOS 후보를 올리는 작업이었다. 기존 설치본의 JS 업데이트와 새 네이티브 빌드는 채널과 런타임이 달라 각각 검증해야 했다. 새 후보는 실제 Release 앱의 첫 화면까지 확인한 뒤 TestFlight에 올리는 절차를 사용했다.

## 문제 (증상)

앱 테스트와 네이티브 설정 검사는 통과했지만, Release 검증의 CocoaPods 단계에서 FBAEMKit 18.1.1 설치가 실패했다. Facebook SDK의 공식 GitHub release 다운로드 URL이 HTTP 504를 반환했고 같은 소스의 실패 job을 한 번 다시 실행해도 동일하게 실패했다.

이는 빌드 준비 단계에서 확인한 장애다. 운영 사용자의 앱이 같은 원인으로 고장 났다고 확인한 것은 아니다.

## 원인 분석 (가설과 검증)

앱 코드나 SDK 버전 충돌인지 먼저 구분했다. 실패 위치는 컴파일 이전의 단일 archive 전송이었고, 다른 pod 설치는 진행됐다. 원래 URL과 캐시 우회 query는 실패했지만, 공식 GitHub asset API는 같은 공개 archive를 정상 반환했다.

공식 asset metadata의 크기와 SHA256을 실제 다운로드와 대조했다. 파일 크기는 59,426,423 bytes였고 SHA256은 `23c0bb829b49d1611d4640aa5a2459d3008a63ea31300cc4b553b5f862baa7d1`로 일치했다. archive에는 기존 iOS device와 arm64/x86_64 simulator framework가 포함돼 있었다.

별도 Ruby loader를 만든 다음에는 이 파일이 네이티브 지문에 포함되는지도 확인했다. 기본 collector는 JS config plugin은 추적했지만 Podfile에서 나중에 읽는 Ruby 파일은 추적하지 않았다. 그대로 두면 Ruby 파일만 바꿨을 때 실제 네이티브 입력과 OTA 런타임이 어긋날 수 있었다.

## 해결

- 정확한 v18.1.1 원본 URL에만 반응하는 작은 adapter를 기존 iOS config plugin에 연결했다. SDK 버전이나 링크 설정은 바꾸지 않았다.
- 공식 asset API, ZIP 형식, 공식 SHA256, octet-stream Accept header를 CocoaPods downloader에 전달했다. 다운로드, TLS, 재시도, 체크섬 검사와 압축 해제는 기존 구현을 그대로 사용했다.
- 실제 cocoapods-downloader 2.1에서 네트워크 executor만 대체한 테스트로 잘못된 체크섬을 거절하고 압축 해제하지 않는지 확인했다. 다른 URL의 옵션과 동작은 보존했다.
- 기존 `fingerprint.config.js`의 extraSources에 Ruby 파일을 추가했다. Ruby 파일에 임시 주석만 넣어도 지문이 달라지는지 측정한 뒤 원본 바이트를 복원했다.

## 결과 (수치)

공식 metadata와 실제 59,426,423-byte archive의 SHA256이 일치했다. config plugin 테스트 4개와 실제 downloader의 오프라인 경로 검증을 통과했고, 수정한 후보의 원격 Release 검증은 기존 504 지점을 넘어 전체 pod 설치와 simulator 부팅까지 통과했다. 이 단계까지 새 EAS 네이티브 빌드는 실행하지 않았다.

같은 소스 `6c8ccc69`의 arm64 Release 시뮬레이터 로그인 화면과 기동 후 프로세스를 확인했다. 이어 iOS 1.5.6(135)을 EAS에서 한 번 빌드하고 한 번 제출했으며, Apple `VALID`, `expired=false`, 내부 `IN_BETA_TESTING`까지 확인했다. 실제 사용자 로그인이나 알림 테스트는 하지 않았다.

- [Release 실행 검증](https://github.com/TripleS-soma/rougether-mobile/actions/runs/42768712067)
- [단일 EAS 빌드](https://github.com/TripleS-soma/rougether-mobile/actions/runs/42774272048)
- [TestFlight 제출과 Apple 상태](https://github.com/TripleS-soma/rougether-mobile/actions/runs/42776371256)

## 배운 점과 재발 방지

의존성 전송 장애를 SDK 버전 변경으로 처리하면 원인과 무관한 ABI 변경까지 생길 수 있다. 같은 공식 파일임을 검증하고 전송 경로만 좁게 바꿨다. 또한 빌드 때 읽는 파일을 추가했다면 네이티브 지문 collector가 그 파일까지 보는지 직접 확인해야 한다. 설정 파일이 정상이라는 사실과 실제 Release 앱이 실행된다는 사실은 별도 게이트로 유지했다.

## 코드 근거

- [plugins/fbsdk-http-download.rb](../../plugins/fbsdk-http-download.rb)
- [plugins/with-fbsdk-react-link.js](../../plugins/with-fbsdk-react-link.js)
- [scripts/test-fbsdk-http-download.rb](../../scripts/test-fbsdk-http-download.rb)
- [scripts/**tests**/fbsdk-react-link.test.js](../../scripts/__tests__/fbsdk-react-link.test.js)
- [fingerprint.config.js](../../fingerprint.config.js)
- [.github/workflows/ios-release-smoke.yml](../../.github/workflows/ios-release-smoke.yml)
