const { withPodfile } = require('expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');

// Firebase Analytics is linked into RNFBAnalytics, not the app executable.
// RNFirebase 26.3.3 only adds -ObjC to the app, stripping Analytics categories
// from the dynamic pod in Release (APMMeasurement fetchSBT launch crash).
function addAnalyticsLinkerFlag(contents) {
  return mergeContents({
    tag: 'rougether-firebase-analytics-linker',
    src: contents,
    anchor: /post_install do \|installer\|/,
    offset: 1,
    comment: '#',
    newSrc: `    installer.pods_project.targets.each do |target|
      next unless target.name == 'RNFBAnalytics'
      target.build_configurations.each do |configuration|
        flags = configuration.build_settings['OTHER_LDFLAGS']
        flags = flags.is_a?(Array) ? flags.dup : flags.to_s.split(' ')
        flags.unshift('$(inherited)') unless flags.include?('$(inherited)')
        flags << '-ObjC' unless flags.include?('-ObjC')
        configuration.build_settings['OTHER_LDFLAGS'] = flags
      end
    end`,
  }).contents;
}

module.exports = function withFirebaseAnalyticsLinker(config) {
  return withPodfile(config, (config) => {
    config.modResults.contents = addAnalyticsLinkerFlag(config.modResults.contents);
    return config;
  });
};
module.exports.addAnalyticsLinkerFlag = addAnalyticsLinkerFlag;
