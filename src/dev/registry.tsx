import { type ReactNode } from 'react';

import { SampleButton } from '@/components/sample-button';

export type GalleryEntry = {
  /** Unique, human-readable name shown as the section header. */
  name: string;
  /** Optional one-line description of what this entry demonstrates. */
  description?: string;
  /** Renders the component in isolation. */
  render: () => ReactNode;
};

/**
 * The dev gallery (`/dev` route) renders every entry here so you can eyeball a
 * component in isolation on device / simulator / web without wiring it into a
 * real screen first. Add an entry whenever you build a new component.
 */
export const galleryEntries: GalleryEntry[] = [
  {
    name: 'SampleButton · primary',
    description: 'Reference pattern for harness components — theme-aware, testable.',
    render: () => <SampleButton label="Primary" variant="primary" />,
  },
  {
    name: 'SampleButton · secondary',
    render: () => <SampleButton label="Secondary" variant="secondary" />,
  },
  {
    name: 'SampleButton · disabled',
    render: () => <SampleButton label="Disabled" disabled />,
  },
];
