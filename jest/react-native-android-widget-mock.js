/** react-native-android-widget mock — 네이티브 모듈 없이 테스트. */
const React = require('react');
const passthrough = (name) => {
  const C = ({ children }) => React.createElement(React.Fragment, null, children ?? null);
  C.displayName = name;
  return C;
};
module.exports = {
  FlexWidget: passthrough('FlexWidget'),
  TextWidget: passthrough('TextWidget'),
  ImageWidget: passthrough('ImageWidget'),
  requestWidgetUpdate: jest.fn(async () => {}),
  registerWidgetTaskHandler: jest.fn(),
};
