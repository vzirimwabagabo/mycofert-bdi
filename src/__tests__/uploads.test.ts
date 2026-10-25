import { describe, it, expect } from 'vitest';
import { verifyImageBytes } from '../lib/object-storage';

describe('verifyImageBytes', () => {
  it('correctly validates JPEG magic bytes', () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(verifyImageBytes(jpeg, 'image/jpeg')).toBe(true);
    expect(verifyImageBytes(jpeg, 'image/png')).toBe(false);
  });

  it('correctly validates PNG magic bytes', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    expect(verifyImageBytes(png, 'image/png')).toBe(true);
    expect(verifyImageBytes(png, 'image/jpeg')).toBe(false);
  });

  it('correctly validates GIF magic bytes', () => {
    const gif = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    expect(verifyImageBytes(gif, 'image/gif')).toBe(true);
    expect(verifyImageBytes(gif, 'image/png')).toBe(false);
  });

  it('correctly validates WebP magic bytes', () => {
    const webp = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
    expect(verifyImageBytes(webp, 'image/webp')).toBe(true);
    expect(verifyImageBytes(webp, 'image/jpeg')).toBe(false);
  });

  it('correctly validates AVIF magic bytes', () => {
    const avif = Buffer.from([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66]);
    expect(verifyImageBytes(avif, 'image/avif')).toBe(true);
    expect(verifyImageBytes(avif, 'image/png')).toBe(false);
  });

  it('rejects corrupt, truncated or non-image buffers', () => {
    const textFile = Buffer.from('<!DOCTYPE html><html><body>malicious</body></html>');
    expect(verifyImageBytes(textFile, 'image/jpeg')).toBe(false);
    expect(verifyImageBytes(textFile, 'image/png')).toBe(false);
    expect(verifyImageBytes(Buffer.from([]), 'image/jpeg')).toBe(false);
    expect(verifyImageBytes(Buffer.from([0xff]), 'image/jpeg')).toBe(false);
  });
});
