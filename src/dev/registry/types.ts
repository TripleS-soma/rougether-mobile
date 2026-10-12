import { type ReactNode } from 'react';

export type GalleryEntry = {
  /** Unique, human-readable name shown as the section header. */
  name: string;
  /** Optional one-line description of what this entry demonstrates. */
  description?: string;
  /** Renders the component in isolation. */
  render: () => ReactNode;
};
