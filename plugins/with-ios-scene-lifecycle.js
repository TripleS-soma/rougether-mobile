const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

// iOS 27 SDK(Xcode 27)로 빌드한 앱은 UIScene 생명주기를 쓰지 않으면 iOS 27에서
// 실행 즉시 종료된다(`_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`,
// SIGTRAP). Expo는 57.0.23부터 지원하고 이 앱은 55라서 직접 채택한다.
// 참고: https://github.com/expo/expo/issues/50179
//
// - 매니페스트만 넣으면 죽지는 않지만 검은 화면이다. 창을 UIWindowScene에서 만들어야
//   해서 React Native 시작을 SceneDelegate로 옮긴다.
// - Scene 생명주기에서는 UIKit이 앱 델리게이트의 URL 열기·유니버설 링크·활성화 콜백을
//   부르지 않는다. 카카오 로그인 복귀(`AppDelegate`의 openURL 분기)와 expo-router의
//   콜드 스타트 딥링크(expo-linking 레지스트리)가 모두 앱 델리게이트를 거치므로,
//   RCTLinkingManager를 직접 부르지 않고 앱 델리게이트로 넘긴다.
// - SceneDelegate를 별도 파일이 아니라 AppDelegate.swift 끝에 붙여 Xcode 프로젝트를
//   건드리지 않는다. 같은 모듈이라 `$(PRODUCT_MODULE_NAME).SceneDelegate`로 찾는다.
const MARKER = '// rougether-scene-lifecycle';

const SCENE_DELEGATE = `
${MARKER}
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
          let appDelegate = UIApplication.shared.delegate as? AppDelegate,
          let factory = appDelegate.reactNativeFactory else {
      return
    }

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    // AppDelegate.window을 읽는 코드(React Native LogBox 등)가 아직 있다.
    appDelegate.window = window

    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: SceneDelegate.launchOptions(appDelegate.launchOptions, connectionOptions))

    // 링크로 앱이 처음 켜지면 URL은 connectionOptions로만 온다.
    connectionOptions.urlContexts.forEach(SceneDelegate.deliver)
    connectionOptions.userActivities.forEach(SceneDelegate.deliver)
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    URLContexts.forEach(SceneDelegate.deliver)
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    SceneDelegate.deliver(userActivity)
  }

  func sceneDidBecomeActive(_ scene: UIScene) {
    UIApplication.shared.delegate?.applicationDidBecomeActive?(UIApplication.shared)
  }

  func sceneWillResignActive(_ scene: UIScene) {
    UIApplication.shared.delegate?.applicationWillResignActive?(UIApplication.shared)
  }

  func sceneWillEnterForeground(_ scene: UIScene) {
    UIApplication.shared.delegate?.applicationWillEnterForeground?(UIApplication.shared)
  }

  func sceneDidEnterBackground(_ scene: UIScene) {
    UIApplication.shared.delegate?.applicationDidEnterBackground?(UIApplication.shared)
  }

  private static func deliver(_ context: UIOpenURLContext) {
    var options: [UIApplication.OpenURLOptionsKey: Any] = [
      .openInPlace: context.options.openInPlace
    ]
    if let source = context.options.sourceApplication {
      options[.sourceApplication] = source
    }
    if let annotation = context.options.annotation {
      options[.annotation] = annotation
    }
    _ = UIApplication.shared.delegate?.application?(
      UIApplication.shared, open: context.url, options: options)
  }

  private static func deliver(_ activity: NSUserActivity) {
    _ = UIApplication.shared.delegate?.application?(
      UIApplication.shared, continue: activity, restorationHandler: { _ in })
  }

  // Linking.getInitialURL()은 시작 옵션만 읽으므로 connectionOptions로 받은 링크를
  // 앱 델리게이트 시절과 같은 키로 옮겨 담는다.
  private static func launchOptions(
    _ base: [UIApplication.LaunchOptionsKey: Any]?,
    _ connectionOptions: UIScene.ConnectionOptions
  ) -> [UIApplication.LaunchOptionsKey: Any]? {
    var options = base ?? [:]
    if let context = connectionOptions.urlContexts.first {
      options[.url] = context.url
      if let source = context.options.sourceApplication {
        options[.sourceApplication] = source
      }
    }
    if let activity = connectionOptions.userActivities.first {
      options[.userActivityDictionary] = [
        "UIApplicationLaunchOptionsUserActivityKey": activity,
        "UIApplicationLaunchOptionsUserActivityTypeKey": activity.activityType,
      ]
    }
    return options.isEmpty ? nil : options
  }
}
`;

// 두 줄을 따로 찾는다. @react-native-firebase/app이 그 사이(startReactNative 바로 위)에
// FirebaseApp.configure()를 넣고, 그 코드는 didFinishLaunching에 남아야 한다.
const WINDOW_RE = /^[ \t]*window = UIWindow\(frame: UIScreen\.main\.bounds\)\r?\n/m;
const START_RN_RE =
  /^([ \t]*)factory\.startReactNative\(\r?\n[\s\S]*?launchOptions: launchOptions\)\r?\n/m;
const WINDOW_PROPERTY = '  var window: UIWindow?\n';

// Firebase 플러그인은 `factory.startReactNative(`를 찾아 그 위에 configure를 넣는다.
// 이 플러그인이 먼저 돌아도 그 자리가 남도록 같은 문자열을 주석으로 남긴다.
const START_RN_PLACEHOLDER =
  '$1self.launchOptions = launchOptions\n' +
  '$1// factory.startReactNative( 와 창 생성은 SceneDelegate로 옮겼다(UIScene 생명주기).\n';

function addSceneLifecycle(contents) {
  if (contents.includes(MARKER)) return contents;

  const expected = [
    [WINDOW_RE, '창 생성 줄'],
    [START_RN_RE, 'factory.startReactNative 호출'],
  ];
  for (const [re, what] of expected) {
    if (!re.test(contents)) {
      throw new Error(
        `with-ios-scene-lifecycle: AppDelegate.swift에서 ${what}을 찾지 못했다. ` +
          'Expo 템플릿이 바뀌었으니 플러그인을 고쳐야 한다.',
      );
    }
  }
  if (!contents.includes(WINDOW_PROPERTY)) {
    throw new Error('with-ios-scene-lifecycle: AppDelegate의 window 프로퍼티를 찾지 못했다.');
  }

  const body = contents
    .replace(WINDOW_RE, '')
    .replace(START_RN_RE, START_RN_PLACEHOLDER)
    .replace(
      WINDOW_PROPERTY,
      `${WINDOW_PROPERTY}  var launchOptions: [UIApplication.LaunchOptionsKey: Any]?\n`,
    );
  return body + SCENE_DELEGATE;
}

function addSceneManifest(infoPlist) {
  return {
    ...infoPlist,
    UIApplicationSceneManifest: {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
      },
    },
  };
}

module.exports = function withIosSceneLifecycle(config) {
  const withDelegate = withAppDelegate(config, (cfg) => {
    if (cfg.modResults.language !== 'swift') {
      throw new Error('with-ios-scene-lifecycle: Swift AppDelegate만 지원한다.');
    }
    return {
      ...cfg,
      modResults: { ...cfg.modResults, contents: addSceneLifecycle(cfg.modResults.contents) },
    };
  });
  return withInfoPlist(withDelegate, (cfg) => ({
    ...cfg,
    modResults: addSceneManifest(cfg.modResults),
  }));
};
module.exports.addSceneLifecycle = addSceneLifecycle;
module.exports.addSceneManifest = addSceneManifest;
