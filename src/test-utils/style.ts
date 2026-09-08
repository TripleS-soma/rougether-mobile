import { StyleSheet, type StyleProp } from 'react-native';

/** 노드의 style prop(배열·중첩 포함)을 평탄한 객체로 — 테스트 파일 5곳의 수제 flatten 대체. */
export function flattenStyle(
  node: { props?: { style?: StyleProp<unknown> } } | StyleProp<unknown>,
) {
  const style =
    node && typeof node === 'object' && 'props' in (node as object)
      ? (node as { props?: { style?: StyleProp<unknown> } }).props?.style
      : (node as StyleProp<unknown>);
  return (StyleSheet.flatten(style) ?? {}) as Record<string, unknown>;
}
