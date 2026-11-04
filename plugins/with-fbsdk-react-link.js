const { withPodfile } = require('expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');

// react-native-fbsdk-next 13.4.3's podspec only declares `s.dependency 'React-Core'`
// (no install_modules_dependencies). With the prebuilt RN core (React.xcframework) and
// dynamic frameworks, that pod is never linked against React, so its dynamic framework
// fails with "Undefined symbols: _OBJC_CLASS_$_RCTConvert, _RCTRegisterModule" (#1616).
function addFbsdkReactLink(contents) {
  return mergeContents({
    tag: 'rougether-fbsdk-react-link',
    src: contents,
    anchor: /post_install do \|installer\|/,
    offset: 1,
    comment: '#',
    newSrc: `    installer.pods_project.targets.each do |target|
      next unless target.name == 'react-native-fbsdk-next'
      target.build_configurations.each do |configuration|
        flags = configuration.build_settings['OTHER_LDFLAGS']
        flags = flags.is_a?(Array) ? flags.dup : flags.to_s.split(' ')
        flags.unshift('$(inherited)') unless flags.include?('$(inherited)')
        flags.push('-framework', 'React') unless flags.each_cons(2).include?(['-framework', 'React'])
        configuration.build_settings['OTHER_LDFLAGS'] = flags
      end
    end`,
  }).contents;
}

module.exports = function withFbsdkReactLink(config) {
  return withPodfile(config, (config) => {
    config.modResults.contents = addFbsdkReactLink(config.modResults.contents);
    return config;
  });
};
module.exports.addFbsdkReactLink = addFbsdkReactLink;
