/// <reference types="jest" />

// CSS imports are resolved by Metro at runtime; declare them so `tsc` is happy.
declare module '*.css';

declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}
