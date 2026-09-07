# 고양이 앱 아이콘과 복귀 알림

관련 이슈: #1121, #1123. 서버 계약은 `rougether-spec/domains/app-icon`이다.

## 사용 흐름

- 설정 화면이나 수동 선택 없이 기본·기다림·눈물·울음·성공·왕관 6종 아이콘을 상태에 따라 자동 적용한다.
- iOS는 앱이 active일 때 서버 상태를 자동 적용한다. 변경 시 시스템 안내가 나타나며 같은 아이콘은 다시 설정하지 않는다. 앱 미실행 중 미접속 단계 교체는 구현하지 않는다. 복귀하면 방문 기록이 초기화되므로 미접속 아이콘을 보여 주려고 복귀 전 상태를 잠깐 적용하지 않는다.
- Android는 background 조회 때도 자동 적용한다. 상태 우선순위는 7일 유효 스트릭 > 오늘 루틴·할 일 완료 > 미접속 시간이다. 미접속 경계는 48·96·168시간이다.
- 로그인 후 실제 foreground 진입과 활동에서만 `POST /me/app-activity`를 호출한다. 터치는 5분 이내 호출을 합친다. 완료·취소 후에는 `GET /me/app-icon`으로 재조회한다.
- Android background 작업은 상태 조회만 한다. `expo-background-task`를 60분 최소 간격으로 등록하나 WorkManager 실행 시각은 OS가 정한다. 앱 강제 종료나 배터리 제한으로 실행되지 않을 수 있다. background 아이콘 교체는 24시간 최대 1회이며 실제 복귀의 회복은 즉시 반영한다.
- 미접속 푸시 `APP_INACTIVITY_REMINDER`를 누르면 내 방을 연다. 수신만으로 방문을 기록하지 않는다. 기존 전체·루틴 리마인더 설정을 따른다.

## 네이티브 구성

`expo-alternate-app-icons` 8.0.0의 에셋 생성 플러그인과 iOS 모듈을 사용한다. 해당 패키지의 Android 구현은 현재 Activity에 의존해 headless 실행을 처리할 수 없으므로 Android에서만 autolinking을 제외한다.

`modules/rougether-app-icon`은 application context로 launcher alias 6종을 전환한다. 실제 MainActivity는 항상 활성 상태로 유지해 OAuth·초대 링크를 처리한다. Android 13 이상은 원자적 전환, 이전 버전은 새 launcher 활성화 후 기존 launcher 비활성화 순서이다. 모든 alias 존재 여부를 먼저 검사한다.

background 모듈은 Android에서만 로드·등록하며 iOS autolinking에서 제외한다. 아이콘 변경은 직렬화하고, 로그아웃·계정 변경으로 오래된 자동 응답을 무효화한다. background 인증 복원 중 로그아웃이 일어나도 이전 세션을 되살리지 않는다.

## 배포 및 확인

새 이미지·모듈·앱 설정을 포함하므로 1.5.0 네이티브 빌드가 필요하다. 기존 설치본에는 OTA만으로 아이콘 기능이 생기지 않는다. 서버 PR #366, spec PR #102, 공개 개인정보처리방침 landing PR #36을 먼저 반영한다. 신규 foreground API를 호출한 사용자만 미접속 알림에 등록되므로 기존 사용자의 접속 기록을 소급 사용하지 않는다.

- 기본: `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test -- --ci`.
- 산출물: Expo prebuild 후 `node scripts/check-app-icons.mjs`. CI가 기본 launcher 1개, 실 Activity 활성 상태와 VIEW 링크, iOS 5종 추가 에셋·등록을 검증한다. Android 모듈도 Release Kotlin 컴파일한다.
- Release 실행: 시뮬레이터 첫 화면을 확인하고, 루틴 완료 후 자동 변경·재실행·로그인 링크 진입을 확인한다.
- 스토어 문구는 `store/ko-KR`에 반영했으며 실제 콘솔 반영 여부는 `store/README.md`에 별도로 기록한다.
