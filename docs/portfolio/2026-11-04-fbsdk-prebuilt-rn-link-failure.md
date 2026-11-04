# Meta SDK를 넣자 iOS Release 링크가 깨진 문제 — 미리 컴파일된 RN 코어와 옛 podspec

- 2026-11-04 / infra / #1616, PR #1623
- 키워드: CocoaPods, use_frameworks dynamic, React-Core-prebuilt(React.xcframework), podspec 의존 선언, config plugin(post_install), 클라우드 빌드 전 로컬 검증

## 배경

Meta 앱 설치 광고의 성과를 측정하려고 `react-native-fbsdk-next` 13.4.3을 붙였다. 이 앱은 iOS를
`useFrameworks: "dynamic"`(Firebase SPM 때문)으로 빌드하고, Expo SDK 55가 기본으로 쓰는 **미리 컴파일된
React Native 코어**(`React-Core-prebuilt` → `React.xcframework`)를 링크한다. 머지하면 곧바로 EAS 클라우드
빌드가 돌아 쿼터를 쓰기 때문에, 머지 전에 로컬 Release 빌드로 먼저 확인했다.

## 문제 (증상)

`expo prebuild` → `pod install`까지는 통과했지만, Release 시뮬레이터 빌드가 `react-native-fbsdk-next`
타깃의 링크 단계에서 실패했다.

```
Undefined symbols for architecture x86_64:
  "_OBJC_CLASS_$_RCTConvert", referenced from: … RCTConvert+FBSDKAccessToken.o
  "_RCTRegisterModule", "_RCTPresentedViewController", …
clang: error: linker command failed with exit code 1
```

컴파일은 다 됐다. React 헤더는 보이는데, React 심볼만 링크할 대상이 없었다.

## 원인 분석 (가설 → 검증 과정)

1. **아키텍처 문제인가?** 실패한 줄이 x86_64 슬라이스뿐이라 처음엔 의심했다. 하지만 미정의 심볼이 FBSDK가 아니라
   **React 자신의 심볼**(`RCTConvert`, `RCTRegisterModule`)이었다. 아키텍처 누락이라면 다른 RN pod도 함께 깨졌어야
   하는데, 다른 pod는 멀쩡했다.
2. **링크 명령 비교.** 실패한 `Ld` 줄을 보니 `-F …/React-Core-prebuilt` 검색 경로는 있는데
   `-framework React`가 없었다. 링크 대상은 `FBSDKCoreKit`·`LoginKit`·`ShareKit`·`GamingServicesKit`·`Foundation`뿐이었다.
3. **podspec 비교.** 정상으로 링크되는 RN pod(`RNGoogleSignin`, `RNCKakaoCore`)는 podspec에서
   `install_modules_dependencies(s)`를 부른다. 이 헬퍼가 prebuilt 모드에서 React 프레임워크 링크까지 잡아 준다.
   `react-native-fbsdk-next`는 옛 방식인 `s.dependency 'React-Core'` 한 줄만 선언한다. 정적 라이브러리였다면 앱
   실행 파일이 마지막에 심볼을 모아 줬을 것이다. 그런데 **dynamic framework는 pod마다 독립적으로 링크되므로** 그
   시점에 React가 없으면 바로 실패한다.

## 해결

라이브러리를 포크하지 않고, 기존 `with-firebase-analytics-linker.js`와 같은 패턴의 config plugin
(`plugins/with-fbsdk-react-link.js`)으로 Podfile `post_install`에 블록을 주입했다. 이 블록은
`react-native-fbsdk-next` 타깃의 `OTHER_LDFLAGS`에만 `-framework React`를 한 번 붙인다.
`ios/`는 gitignore이고 매 prebuild마다 새로 생성되므로, 손으로 Podfile을 고치는 방식은 남지 않는다.
플러그인이 유일한 지속 경로다.

Ruby로 `post_install` 블록을 실제 실행하는 단위 테스트(`scripts/__tests__/fbsdk-react-link.test.js`)로 다음을 고정했다.

- 기존 플래그를 보존한다.
- 다른 pod는 건드리지 않는다.
- prebuild를 반복해도 중복으로 붙지 않는다.

## 결과 (수치)

- 수정 전: `** BUILD FAILED **`(2 failures, fbsdk 타깃 `Ld`)
- 수정 후: `** BUILD SUCCEEDED **`. 시뮬레이터(iPhone 17 Pro, iOS 26.5)에서 인트로와 로그인 뒤 메인 화면까지 실행됐고,
  `FBSDKCoreKit` 로그로 SDK가 우리 App ID로 Graph API(`ios_skadnetwork_conversion_config`)를 호출하는 것까지 확인했다.
- EAS 클라우드 빌드 소모 0회 — 이 실패를 클라우드에서 만났다면 iOS 빌드 1회(약 20분+)를 그대로 태웠을 것이다.

## 배운 점 / 재발 방지

- **"컴파일은 되는데 링크가 안 된다"면 헤더 경로(-I/-F)와 링크 대상(-framework/-l)을 따로 본다.** 이번엔 검색 경로는
  있었고 링크 대상만 없었다.
- RN 라이브러리를 들일 때 podspec이 `install_modules_dependencies`를 쓰는지 본다. 옛 `s.dependency 'React-Core'`뿐이면
  prebuilt RN 코어 + dynamic frameworks 조합에서 같은 증상이 날 가능성이 높다(추측: 같은 패턴의 다른 라이브러리도 해당).
- 네이티브 의존성 PR은 머지 전에 로컬 Release 빌드를 거친다(`docs/release-ops.md`의 "빌드 성공은 실행 가능을 뜻하지 않는다"와 같은 원칙).
