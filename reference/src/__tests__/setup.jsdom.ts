import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// React Testing Library doesn't auto-cleanup when vitest's `globals: true` is
// set (it relies on bare `afterEach` being the jest-compat global). With the
// unified vitest config we import afterEach from 'vitest' explicitly so the
// DOM is torn down between tests — prevents "Found multiple elements" errors
// from stacked renders.
afterEach(() => {
  cleanup();
});
