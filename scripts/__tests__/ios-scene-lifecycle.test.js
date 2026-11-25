/* global describe, it, expect */
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');
const { addSceneLifecycle, addSceneManifest } = require('../../plugins/with-ios-scene-lifecycle');

// expo prebuild(SDK 55)가 만드는 AppDelegate.swift의 해당 부분.
const TEMPLATE = `internal import Expo
import React
import ReactAppDependencyProvider

@main
class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}
`;

// @react-native-firebase/app 플러그인과 같은 규칙: 첫 `factory.startReactNative(` 위에 넣는다.
function addFirebase(contents) {
  if (contents.includes('FirebaseApp.configure()')) return contents;
  return mergeContents({
    tag: '@react-native-firebase/app-didFinishLaunchingWithOptions',
    src: contents,
    newSrc: 'FirebaseApp.configure()',
    anchor: /(?:self\.moduleName\s*=\s*"([^"]*)")|(?:factory\.startReactNative\()/,
    offset: 0,
    comment: '//',
  }).contents;
}

function didFinishLaunchingBody(contents) {
  const start = contents.indexOf('didFinishLaunchingWithOptions launchOptions');
  const end = contents.indexOf(
    'return super.application(application, didFinishLaunchingWithOptions',
  );
  return contents.slice(start, end);
}

describe('iOS UIScene 생명주기 채택 (iOS 27 SDK 실행 즉시 종료)', () => {
  it('창 생성과 RN 시작을 SceneDelegate로 옮기고 시작 옵션을 남긴다', () => {
    const result = addSceneLifecycle(TEMPLATE);
    const body = didFinishLaunchingBody(result);

    expect(body).not.toContain('UIWindow(frame:');
    expect(body).not.toMatch(/^\s*factory\.startReactNative\(/m);
    expect(body).toContain('self.launchOptions = launchOptions');
    expect(result).toContain('  var launchOptions: [UIApplication.LaunchOptionsKey: Any]?\n');
    expect(result).toContain('class SceneDelegate: UIResponder, UIWindowSceneDelegate');
    expect(result).toContain('UIWindow(windowScene: windowScene)');
  });

  it('URL·유니버설 링크를 RCTLinkingManager가 아니라 앱 델리게이트로 넘긴다', () => {
    const sceneDelegate = addSceneLifecycle(TEMPLATE).split('class SceneDelegate')[1];

    expect(sceneDelegate).not.toContain('RCTLinkingManager');
    expect(sceneDelegate).toContain('UIApplication.shared, open: context.url, options: options)');
    expect(sceneDelegate).toContain('UIApplication.shared, continue: activity');
    expect(sceneDelegate).toContain('connectionOptions.urlContexts.forEach(SceneDelegate.deliver)');
    expect(sceneDelegate).toContain('applicationDidBecomeActive?(UIApplication.shared)');
  });

  it.each([
    ['Firebase 플러그인이 먼저 돌 때', (t) => addSceneLifecycle(addFirebase(t))],
    ['Firebase 플러그인이 나중에 돌 때', (t) => addFirebase(addSceneLifecycle(t))],
  ])('%s FirebaseApp.configure()가 didFinishLaunching 안에 한 번 남는다', (_, apply) => {
    const result = apply(TEMPLATE);

    expect(result.match(/FirebaseApp\.configure\(\)/g)).toHaveLength(1);
    expect(didFinishLaunchingBody(result)).toContain('FirebaseApp.configure()');
    expect(result.split('class SceneDelegate')[1]).not.toContain('FirebaseApp');
  });

  it('두 번 적용해도 같다', () => {
    const once = addSceneLifecycle(TEMPLATE);
    expect(addSceneLifecycle(once)).toBe(once);
  });

  it('템플릿이 바뀌어 찾을 줄이 없으면 조용히 넘어가지 않고 실패한다', () => {
    const changed = TEMPLATE.replace('window = UIWindow(frame: UIScreen.main.bounds)\n', '');
    expect(() => addSceneLifecycle(changed)).toThrow('창 생성 줄');
  });

  it('Info.plist에 단일 창 Scene 매니페스트를 넣고 기존 키는 유지한다', () => {
    const plist = { CFBundleDisplayName: '루게더' };
    const result = addSceneManifest(plist);

    expect(plist).toEqual({ CFBundleDisplayName: '루게더' });
    expect(result.CFBundleDisplayName).toBe('루게더');
    expect(result.UIApplicationSceneManifest).toEqual({
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
      },
    });
  });
});
