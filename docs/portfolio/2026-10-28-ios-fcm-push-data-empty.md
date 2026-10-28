# iOS에서 푸시를 눌러도 해당 화면으로 안 가는 문제 — FCM data가 비어 들어오던 원인

- 2026-10-28 / notification / 이슈 #1582
- 키워드: expo-notifications, FCM, APNs userInfo, 푸시 딥링크, iOS 시뮬레이터 `simctl push`, 라이브러리 소스 추적

## 배경

서버는 FCM(Firebase Admin SDK)으로 푸시를 보내고, 알림 종류(`type`)와 목적지 id(`houseId`·`postId`)를 FCM `data`에 싣는다. 앱은 expo-notifications로 탭·수신을 받아 `type`으로 목적지(채팅방·게시물 등)를 고른다. 목적지를 모르면 알림함으로 보낸다.

## 문제 (증상)

"채팅 푸시를 눌러도 채팅방으로 잘 안 간다"는 제보가 들어왔다. 확인해 보니 iOS에서는 어떤 푸시를 눌러도 알림함으로 가고 있었다. Android는 정상이었다.

## 원인 분석 (가설 → 검증 과정)

1. **앱 코드의 경로 확인**: 탭 처리(`onNotificationTap` → `notificationDestination` → `openChatFor`)에는 문제가 없었다. 의심할 곳은 입력값, 즉 `content.data`였다.
2. **서버 페이로드 확인**: `FirebaseFcmSender`는 `putAllData(data)`로 키를 싣는다. APNs로 전달되면 이 키들은 `userInfo` **최상위**에 놓인다.
3. **라이브러리 소스 확인**: expo-notifications 55.0.27 iOS의 `NotificationRecords.swift`는 원격 푸시의 data를 `userInfo["body"]`에서만 읽는다. 이건 Expo 푸시 서비스가 쓰는 형식이라, FCM으로 직접 보낸 푸시에는 `body`가 없다. 그래서 `data`가 비고 `type`도 없어 알림함으로 간다는 가설을 세웠다. 같은 파일에서 푸시 트리거의 `payload`는 `userInfo` 전체를 담는다는 것도 확인했다.
4. **실기 재현**: 로컬 Debug 빌드를 iOS 시뮬레이터에 올리고 `xcrun simctl push`로 서버와 같은 모양(`aps` + 최상위 `type`)의 페이로드를 넣었다. 받은 값을 인앱 배너에 임시로 찍어 보니 `content.data = null`, `trigger.type = push`였고 `trigger.payload`의 키는 `aps, notificationId, type…`였다. 가설과 일치했다.
   - 검증 중 함정 두 개가 있었다. 하나는 Debug 앱이어도 expo-updates가 켜져 있으면 받아 둔 OTA 번들로 실행돼 Metro의 수정이 반영되지 않았다는 것이다. 덕분에 수정 전 코드가 실제 출시 코드로 동작하는 것은 확인할 수 있었다. 다른 하나는 Metro 파일 감시가 바뀐 파일을 못 잡아 `--clear`로 다시 띄워야 했다는 것이다.

## 해결

`pushDataOf(request)`를 만들었다. `content.data`가 비어 있으면 iOS 푸시 트리거의 `payload`를 읽는다. 이 함수를 탭(`onNotificationTap`), 포그라운드 수신(`onNotificationReceived`), 표시 필터(`setNotificationHandler`) 세 곳에 모두 적용했다. 마지막 필터는 채팅방을 보고 있을 때 그 방의 푸시를 거르는 용도인데, 이것도 iOS에서는 안 걸리고 있었다. 서버 페이로드나 네이티브 설정은 바꾸지 않았기 때문에 JS만 바뀌어 OTA로 고칠 수 있다.

## 결과 (수치)

- 시뮬레이터에 같은 응원 푸시를 넣었을 때 배너 아이콘이 수정 전에는 종(type 모름), 수정 후에는 하트(`FRIEND_CHEER`)였다.
- 단위 테스트 3개를 추가해 iOS 모양의 요청(data 빈 값 + `trigger.payload`)에서 탭, 수신, 필터를 확인했다. 전체 412 스위트, 3409 테스트가 통과했다.

## 배운 점 / 재발 방지

- "푸시 → 화면 이동"은 **보내는 쪽(FCM) 형식과 받는 라이브러리가 기대하는 형식(Expo 푸시)이 다를 수 있다.** 단위 테스트는 우리가 상상한 `content.data` 모양으로만 짜여 있어서 이 문제를 못 잡았다. 테스트 픽스처는 실제 기기에서 받은 모양을 기준으로 만든다.
- 시뮬레이터 `simctl push`는 APNs 없이도 원격 푸시와 같은 트리거(`UNPushNotificationTrigger`)를 만든다. 서버 페이로드 계약을 실기에서 확인할 때 싸게 쓸 수 있다.
