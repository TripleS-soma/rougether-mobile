import type { BrandFontId } from '@/constants/theme';

/**
 * Native no-op of `use-web-fonts.web.ts`. On iOS/Android the fonts are
 * embedded at build time by the expo-font config plugin (app.json), so
 * nothing to load — and keeping the `require`s out of this variant keeps
 * 12MB of font assets out of the native JS bundle / OTA updates.
 */
export function useWebFonts(_fontId: BrandFontId): void {}

export function useWebFontPreviews(): void {}
