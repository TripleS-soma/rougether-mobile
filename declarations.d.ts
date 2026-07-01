/// <reference types="jest" />

// CSS imports are resolved by Metro at runtime; declare them so `tsc` is happy.
declare module '*.css';

declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

// SVG imports become React components via react-native-svg-transformer.
declare module '*.svg' {
  import type { FC } from 'react';
  import type { SvgProps } from 'react-native-svg';
  const content: FC<SvgProps>;
  export default content;
}

// Image assets resolve to a Metro asset reference (number).
declare module '*.webp' {
  const asset: number;
  export default asset;
}
