// expo-glass-effect 목 — 네이티브 뷰 매니저를 요구하므로 jest에서는 View로
// 대체한다. 기본은 "글래스 불가"(라이브러리의 비-iOS 폴백과 같음). 글래스
// 경로를 검증하는 테스트는 jest.mocked(isLiquidGlassAvailable)로 켠다.
const React = require('react');
const { View } = require('react-native');

const GlassView = (props) => React.createElement(View, { ...props, testID: props.testID });
const GlassContainer = (props) => React.createElement(View, props);

module.exports = {
  GlassView,
  GlassContainer,
  isLiquidGlassAvailable: jest.fn(() => false),
  isGlassEffectAPIAvailable: jest.fn(() => false),
};
