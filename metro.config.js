// Learn more: https://docs.expo.dev/guides/customizing-metro/
// Sentry(#801): 기본 config 대신 getSentryExpoConfig를 쓴다 — 번들과 함께
// 디버그 id가 박힌 소스맵이 나와야 릴리스 스택 트레이스를 되읽을 수 있다.
const path = require('path');
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const config = getSentryExpoConfig(__dirname);

// Import .svg files as React components via react-native-svg-transformer.
config.transformer.babelTransformerPath = require.resolve('react-native-svg-transformer/expo');
config.resolver.assetExts = config.resolver.assetExts.filter((ext) => ext !== 'svg');
config.resolver.sourceExts = [...config.resolver.sourceExts, 'svg'];

const EMPTY_MODULE = path.resolve(__dirname, 'src/stubs/empty-module.js');

const { stripFromProduction } = require('./src/stubs/strip-from-production');

const upstreamResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (stripFromProduction(context, moduleName, platform)) {
    return { type: 'sourceFile', filePath: EMPTY_MODULE };
  }
  return (upstreamResolve ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
