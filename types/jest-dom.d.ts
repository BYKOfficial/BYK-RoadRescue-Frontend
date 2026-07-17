// Pulls in @testing-library/jest-dom's global Jest matcher augmentation
// (toBeInTheDocument, toHaveClass, etc.) for the whole TypeScript program.
// jest.setup.js does the equivalent import for the actual test *runtime*;
// this file makes the same matchers type-check correctly in `tsc --noEmit`
// and in your editor, since jest.setup.js (a .js file) isn't part of the
// TS program. Do not remove even though nothing else imports it directly.
import '@testing-library/jest-dom';
