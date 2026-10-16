import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ImageValidationError,
  processImageFile,
  imageErrorMessage,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_DIMENSION,
} from '../appearance/imageUtils';

function pngFile(sizeBytes = 1000, type = 'image/png'): File {
  const payload = new ArrayBuffer(sizeBytes);
  return new File([payload], 'test.png', { type });
}

/** Minimal stand-in for `new Image()` that "loads" asynchronously. */
class MockImage {
  naturalWidth: number;
  naturalHeight: number;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private currentSrc = '';

  constructor(width = 100, height = 50) {
    this.naturalWidth = width;
    this.naturalHeight = height;
  }

  get src(): string {
    return this.currentSrc;
  }

  set src(value: string) {
    this.currentSrc = value;
    queueMicrotask(() => this.onload?.());
  }
}

describe('processImageFile – validation', () => {
  it('rejects an empty file with code EMPTY', async () => {
    const file = new File([], 'empty.png', { type: 'image/png' });
    await expect(processImageFile(file)).rejects.toMatchObject({ code: 'EMPTY' });
  });

  it('rejects non-PNG files with code TYPE', async () => {
    const file = pngFile(100, 'image/svg+xml');
    await expect(processImageFile(file)).rejects.toMatchObject({ code: 'TYPE' });
  });

  it('rejects files above 512 kB with code SIZE', async () => {
    const file = pngFile(MAX_IMAGE_BYTES + 1);
    await expect(processImageFile(file)).rejects.toMatchObject({ code: 'SIZE' });
  });
});

describe('processImageFile – success paths', () => {
  beforeEach(() => {
    vi.stubGlobal('Image', MockImage);
    URL.createObjectURL = vi.fn(() => 'blob:mock');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('passes small PNGs through unchanged (data URL, no resize)', async () => {
    const file = pngFile(1000);
    const result = await processImageFile(file);
    expect(result.dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(result.width).toBe(100);
    expect(result.height).toBe(50);
    expect(result.resized).toBe(false);
    expect(result.byteSize).toBe(1000);
  });

  it('rejects when the image cannot be decoded', async () => {
    class BrokenImage extends MockImage {
      set src(_value: string) {
        queueMicrotask(() => this.onerror?.());
      }
    }
    vi.stubGlobal('Image', BrokenImage);
    await expect(processImageFile(pngFile(1000))).rejects.toMatchObject({ code: 'DECODE' });
  });

  it('downscales oversized images to 1024 px via canvas', async () => {
    vi.stubGlobal(
      'Image',
      class extends MockImage {
        constructor() {
          super(2000, 1000);
        }
      }
    );

    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    const toDataURL = vi.fn(() => 'data:image/png;base64,QUJDREVG');
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(toDataURL as never);

    const result = await processImageFile(pngFile(1000));

    expect(result.resized).toBe(true);
    expect(result.width).toBe(MAX_IMAGE_DIMENSION);
    expect(result.height).toBe(512);
    expect(drawImage).toHaveBeenCalledTimes(1);
    expect(toDataURL).toHaveBeenCalledWith('image/png');
    expect(result.dataUrl).toBe('data:image/png;base64,QUJDREVG');
  });

  it('rejects with code CANVAS when the canvas is unavailable', async () => {
    vi.stubGlobal(
      'Image',
      class extends MockImage {
        constructor() {
          super(2000, 1000);
        }
      }
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    await expect(processImageFile(pngFile(1000))).rejects.toMatchObject({ code: 'CANVAS' });
  });
});

describe('imageErrorMessage', () => {
  it('returns the message of Error instances', () => {
    expect(imageErrorMessage(new ImageValidationError('TYPE', 'PNG only.'))).toBe('PNG only.');
    expect(imageErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('falls back to a generic message', () => {
    expect(imageErrorMessage('string-error')).toBe('Could not process the image.');
    expect(imageErrorMessage(null)).toBe('Could not process the image.');
  });
});
