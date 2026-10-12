import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// No `globals: true` in vitest config → @testing-library/react cannot register
// its auto-cleanup (it needs a global afterEach). Unmount explicitly per test so
// successive renders do not accumulate in document.body.
afterEach(() => {
  cleanup();
});
