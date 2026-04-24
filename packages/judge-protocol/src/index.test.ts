import { describe, expect, it } from 'vitest';
import { compareOutput, normalizeOutput } from './index';

describe('judge output comparison', () => {
  it('normalizes line endings and trailing whitespace', () => {
    expect(normalizeOutput('1 2\r\n3\n\n')).toBe('1 2\n3');
  });

  it('compares normalized output', () => {
    expect(compareOutput('42\n', '42')).toBe(true);
    expect(compareOutput('42  \n', '42')).toBe(true);
  });
});
