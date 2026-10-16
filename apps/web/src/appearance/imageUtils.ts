/** PNG is the only accepted format (no SVG – data-URL XSS risk). */
export const ALLOWED_IMAGE_TYPE = 'image/png';
/** Maximum input size: 512 kB (per issue #49). */
export const MAX_IMAGE_BYTES = 512 * 1024;
/** Maximum dimension after processing: 1024 px. */
export const MAX_IMAGE_DIMENSION = 1024;

export type ImageErrorCode = 'EMPTY' | 'TYPE' | 'SIZE' | 'DECODE' | 'CANVAS';

/** Error with a stable, assertable code (UI + tests). */
export class ImageValidationError extends Error {
  readonly code: ImageErrorCode;

  constructor(code: ImageErrorCode, message: string) {
    super(message);
    this.name = 'ImageValidationError';
    this.code = code;
  }
}

export interface ProcessedImage {
  /** Data URL of the (possibly resized) PNG – safe for inline rendering + persistence. */
  dataUrl: string;
  width: number;
  height: number;
  /** Approximate encoded size in bytes. */
  byteSize: number;
  /** `true` when the source image was downscaled to fit 1024 px. */
  resized: boolean;
}

/**
 * Validates and converts a PNG file to a data URL.
 *
 * - Rejects non-PNG files and files above 512 kB (assertable error codes).
 * - Downscales images larger than 1024 px on a canvas and re-encodes as PNG.
 * - Returns a `data:image/png` URL suitable for localStorage + `<img>`.
 */
export async function processImageFile(file: File): Promise<ProcessedImage> {
  if (!file || file.size === 0) {
    throw new ImageValidationError('EMPTY', 'The file is empty.');
  }
  if (file.type !== ALLOWED_IMAGE_TYPE) {
    throw new ImageValidationError('TYPE', 'Only PNG images are supported.');
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new ImageValidationError(
      'SIZE',
      `Image is too large (max ${Math.round(MAX_IMAGE_BYTES / 1024)} kB).`
    );
  }

  const sourceUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(sourceUrl);
    const width = img.naturalWidth;
    const height = img.naturalHeight;
    if (width === 0 || height === 0) {
      throw new ImageValidationError('DECODE', 'Could not read the image.');
    }

    const fits = width <= MAX_IMAGE_DIMENSION && height <= MAX_IMAGE_DIMENSION;
    if (fits) {
      return {
        dataUrl: await fileToDataUrl(file),
        width,
        height,
        byteSize: file.size,
        resized: false,
      };
    }

    const scale = Math.min(MAX_IMAGE_DIMENSION / width, MAX_IMAGE_DIMENSION / height);
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new ImageValidationError('CANVAS', 'Canvas is not available in this browser.');
    }
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
    const dataUrl = canvas.toDataURL('image/png');
    if (!dataUrl.startsWith('data:image/png')) {
      throw new ImageValidationError('CANVAS', 'Could not encode the image.');
    }
    return {
      dataUrl,
      width: targetWidth,
      height: targetHeight,
      byteSize: approximateDataUrlBytes(dataUrl),
      resized: true,
    };
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

/** Converts a thrown value into a user-readable message. */
export function imageErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return 'Could not process the image.';
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new ImageValidationError('DECODE', 'Could not read the image.'));
    img.src = url;
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new ImageValidationError('DECODE', 'Could not read the file.'));
    reader.readAsDataURL(file);
  });
}

/** Rough byte size of a base64 data URL (base64 expands ~4/3). */
function approximateDataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.split(',')[1] ?? '';
  return Math.round(base64.length * 0.75);
}
