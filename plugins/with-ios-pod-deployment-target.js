const { withPodfile } = require('expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');

// Xcode 27은 배포 대상이 iOS 15 미만인 타깃을 빌드하지 않는다
// ("The iOS Simulator deployment target 'IPHONEOS_DEPLOYMENT_TARGET' is set to 9.0, but the range of
// supported deployment target versions is 15.0 to 27.2.x"). 이 앱의 Pod 여러 개가 podspec에서
// 9.0~13.4를 선언한다(SDWebImage·PromisesObjC·GoogleUtilities·GTMSessionFetcher·KakaoSDK·Sentry·
// RNScreens 등 — Xcode 27.2 로컬 빌드로 확인, 2026-11-24).
//
// 앱 타깃의 배포 대상(expo-build-properties의 `ios.deploymentTarget`)은 Pod에 내려가지 않는다.
// post_install에서 그보다 낮은 Pod 타깃만 앱과 같은 값으로 끌어올린다 — 앱이 어차피 그 아래
// iOS에서는 설치되지 않으므로 동작이 달라지지 않는다. 이미 높은 타깃(위젯 17 등)은 건드리지 않는다.
function addPodDeploymentTargetFloor(contents) {
  return mergeContents({
    tag: 'rougether-pod-deployment-target',
    src: contents,
    anchor: /post_install do \|installer\|/,
    offset: 1,
    comment: '#',
    newSrc: `    app_deployment_target = podfile_properties['ios.deploymentTarget'] || '15.1'
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |configuration|
        current = configuration.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        next if current.nil?
        if Gem::Version.new(current) < Gem::Version.new(app_deployment_target)
          configuration.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = app_deployment_target
        end
      end
    end`,
  }).contents;
}

module.exports = function withIosPodDeploymentTarget(config) {
  return withPodfile(config, (cfg) => {
    cfg.modResults.contents = addPodDeploymentTargetFloor(cfg.modResults.contents);
    return cfg;
  });
};
module.exports.addPodDeploymentTargetFloor = addPodDeploymentTargetFloor;
