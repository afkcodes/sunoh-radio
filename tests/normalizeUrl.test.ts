import { describe, expect, it } from 'vitest';
import fixture from './fixtures/url_normalization.json';
import { normalizeUrl } from '../src/lib/normalizeUrl';

// The same fixture is asserted by scripts/tests/test_normalize_url.py, pinning
// the Python and TypeScript implementations to identical output.
describe('normalizeUrl — parity with canonical fixture', () => {
  for (const { input, expected } of fixture as { input: string; expected: string }[]) {
    it(`normalizes ${JSON.stringify(input)}`, () => {
      expect(normalizeUrl(input)).toBe(expected);
    });
  }

  it('handles null/undefined', () => {
    expect(normalizeUrl(null)).toBe('');
    expect(normalizeUrl(undefined)).toBe('');
  });
});
