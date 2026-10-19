import { MAX_IMAGE_BYTES } from 'shared';

/** Re-exported from `shared` (single source for web + API). */
export { MAX_IMAGE_BYTES };

/** Accepted image formats: PNG (raster) and SVG (vector, validated at upload). */
export const ALLOWED_IMAGE_TYPES: readonly string[] = ['image/png', 'image/svg+xml'];
/** Maximum raster dimension after processing: 1024 px (PNG only – SVG stays vector). */
export const MAX_IMAGE_DIMENSION = 1024;

export type ImageErrorCode = 'EMPTY' | 'TYPE' | 'SIZE' | 'DECODE' | 'CANVAS' | 'SVG';

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
  /** Data URL of the PNG (possibly resized) or the validated SVG – safe for inline rendering + persistence. */
  dataUrl: string;
  /** Intrinsic width in px (0 when the source has no explicit size). */
  width: number;
  /** Intrinsic height in px (0 when the source has no explicit size). */
  height: number;
  /** Approximate encoded size in bytes. */
  byteSize: number;
  /** `true` when the source image was downscaled to fit 1024 px. */
  resized: boolean;
}

/**
 * Validates and converts a PNG or SVG file to a data URL.
 *
 * - Rejects unsupported types, files above 512 kB and unsafe SVG content
 *   (assertable error codes).
 * - PNG: downscales images larger than 1024 px on a canvas and re-encodes as PNG.
 * - SVG: validated (no scripts, event handlers, `javascript:` or external
 *   references) and kept as a vector.
 * - Returns a data URL suitable for localStorage + `<img>`.
 */
export async function processImageFile(file: File): Promise<ProcessedImage> {
  if (!file || file.size === 0) {
    throw new ImageValidationError('EMPTY', 'The file is empty.');
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new ImageValidationError('TYPE', 'Only PNG and SVG images are supported.');
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new ImageValidationError(
      'SIZE',
      `Image is too large (max ${Math.round(MAX_IMAGE_BYTES / 1024)} kB).`
    );
  }
  if (file.type === 'image/svg+xml') {
    return processSvgFile(file);
  }
  return processPngFile(file);
}

/** Validates the SVG and stores it as a base64 data URL (no re-encoding). */
async function processSvgFile(file: File): Promise<ProcessedImage> {
  const markup = await fileToText(file);
  validateSvgMarkup(markup);
  const root = new DOMParser().parseFromString(markup, 'image/svg+xml').documentElement;
  const { width, height } = svgDimensions(root);
  return {
    dataUrl: await fileToDataUrl(file),
    width,
    height,
    byteSize: file.size,
    resized: false,
  };
}

/**
 * Security gate for uploaded SVGs. They are rendered later in a safe `<img>`
 * context, but known-dangerous payloads are still refused at upload time:
 *
 * - the document must parse as XML with an `<svg>` root;
 * - no `<script>`, `<foreignObject>`, `<iframe>`, `<object>`, `<embed>`;
 * - no event-handler attributes (`on*`);
 * - no `javascript:` URLs, no external references (`http(s)://`, `//…`,
 *   `data:text/*`).
 */
function validateSvgMarkup(markup: string): void {
  const fail = (message: string): never => {
    throw new ImageValidationError('SVG', message);
  };
  if (/javascript:/i.test(markup)) {
    return fail('SVGs with javascript: URLs are not allowed.');
  }
  const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
  if (doc.querySelector('parsererror')) {
    return fail('The file is not a valid SVG document.');
  }
  const root = doc.documentElement;
  if (!root || root.nodeName.toLowerCase() !== 'svg') {
    return fail('The file is not a valid SVG document.');
  }
  const forbidden = new Set(['script', 'foreignobject', 'iframe', 'object', 'embed']);
  for (const el of Array.from(root.querySelectorAll('*'))) {
    if (forbidden.has(el.localName.toLowerCase())) {
      return fail(`SVGs with <${el.localName}> elements are not allowed.`);
    }
  }
  const walk = (el: Element): void => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on')) {
        return fail('SVGs with event handlers are not allowed.');
      }
      const isReference = name === 'href' || name === 'xlink:href' || name === 'src';
      const value = attr.value.trim();
      if (isReference && (/^(https?:)?\/\//i.test(value) || /^data:text\//i.test(value))) {
        return fail('SVGs with external references are not allowed.');
      }
    }
    for (const child of Array.from(el.children)) {
      walk(child);
    }
  };
  walk(root);
}

/** Intrinsic SVG size from width/height attributes, falling back to the viewBox. */
function svgDimensions(root: Element | null): { width: number; height: number } {
  const attr = (name: string): number => {
    const value = root?.getAttribute(name);
    if (!value) return 0;
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  };
  let width = attr('width');
  let height = attr('height');
  if ((width === 0 || height === 0) && root) {
    const parts = (root.getAttribute('viewBox') ?? '')
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
      width = width || Math.abs(parts[2] ?? 0);
      height = height || Math.abs(parts[3] ?? 0);
    }
  }
  return { width, height };
}

/** Loads a PNG, downscales it when needed, and returns it as a PNG data URL. */
async function processPngFile(file: File): Promise<ProcessedImage> {
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

/** Reads a file as UTF-8 text (SVG validation). */
function fileToText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new ImageValidationError('DECODE', 'Could not read the file.'));
    reader.readAsText(file);
  });
}

/** Rough byte size of a base64 data URL (base64 expands ~4/3). */
function approximateDataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.split(',')[1] ?? '';
  return Math.round(base64.length * 0.75);
}
