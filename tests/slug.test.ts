import { describe, expect, it } from 'vitest';
import { makeSlug, slugify } from '../src/sync_to_db';

describe('slugify', () => {
  it('lowercases, replaces spaces, strips punctuation, collapses dashes', () => {
    expect(slugify('FLAIXBAC AND')).toBe('flaixbac-and');
    expect(slugify('Rock & Roll!!!')).toBe('rock-roll'); // punctuation removed, dashes collapsed
    expect(slugify('  Trimmed  ')).toBe('trimmed');
  });
});

describe('makeSlug — deterministic and stable', () => {
  it('is deterministic for the same inputs', () => {
    const a = makeSlug('Jazz FM', 'https://stream.example.com/jazz');
    const b = makeSlug('Jazz FM', 'https://stream.example.com/jazz');
    expect(a).toBe(b);
  });

  it('uses a 10-hex suffix of sha1(normalized_url)', () => {
    expect(makeSlug('Jazz FM', 'https://stream.example.com/jazz')).toMatch(/^jazz-fm-[0-9a-f]{10}$/);
  });

  it('distinguishes same-named stations by their unique URL', () => {
    const a = makeSlug('Radio One', 'https://a.example.com/stream');
    const b = makeSlug('Radio One', 'https://b.example.com/stream');
    expect(a).not.toBe(b);
  });

  it('falls back to "station" when the name slugifies to empty', () => {
    expect(makeSlug('!!!', 'https://x.example.com/s')).toMatch(/^station-[0-9a-f]{10}$/);
  });
});
