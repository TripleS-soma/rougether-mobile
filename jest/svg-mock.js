// Jest mock for `*.svg` imports (real transform is metro/react-native-svg-transformer).
const React = require('react');

function SvgMock(props) {
  return React.createElement('SvgMock', props, props.children);
}

module.exports = SvgMock;
module.exports.default = SvgMock;
