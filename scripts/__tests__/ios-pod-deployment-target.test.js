/* global describe, it, expect */
const { addPodDeploymentTargetFloor } = require('../../plugins/with-ios-pod-deployment-target');

// expo prebuild(SDK 55)가 만드는 Podfile의 해당 부분.
const PODFILE = `podfile_properties = JSON.parse(File.read(File.join(__dir__, 'Podfile.properties.json'))) rescue {}
platform :ios, podfile_properties['ios.deploymentTarget'] || '15.1'

target 'Rougether' do
  use_expo_modules!

  post_install do |installer|
    react_native_post_install(installer, config[:reactNativePath])
  end
end
`;

describe('with-ios-pod-deployment-target', () => {
  it('post_install 안, 다른 처리보다 먼저 낮은 Pod 타깃을 앱의 배포 대상으로 올린다', () => {
    const result = addPodDeploymentTargetFloor(PODFILE);
    const hook = result.split('post_install do |installer|')[1];
    expect(hook).toContain("podfile_properties['ios.deploymentTarget'] || '15.1'");
    expect(hook).toContain("configuration.build_settings['IPHONEOS_DEPLOYMENT_TARGET']");
    // 낮을 때만 — 이미 높은 타깃(위젯 17 등)을 내리지 않는다.
    expect(hook).toContain('Gem::Version.new(current) < Gem::Version.new(app_deployment_target)');
    expect(hook.indexOf('rougether-pod-deployment-target')).toBeLessThan(
      hook.indexOf('react_native_post_install'),
    );
  });

  it('두 번 적용해도 같다', () => {
    const once = addPodDeploymentTargetFloor(PODFILE);
    expect(addPodDeploymentTargetFloor(once)).toBe(once);
  });

  it('post_install이 없는 Podfile이면 조용히 넘어가지 않고 실패한다', () => {
    expect(() => addPodDeploymentTargetFloor("platform :ios, '16.4'\n")).toThrow();
  });
});
