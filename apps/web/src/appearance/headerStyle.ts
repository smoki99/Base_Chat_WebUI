/**
 * Inline styles for a configurable header line (Story-0038).
 * Shared by the chat header (Chat.tsx) and the settings preview (CustomizeTab).
 */
import type { CSSProperties } from 'react';
import type { UiHeaderLine, UiHeaderSegment } from 'shared';

export function headerLineStyle(line: UiHeaderLine): CSSProperties {
  const style: CSSProperties = {
    fontSize: `${line.fontSize}px`,
    fontWeight: line.fontWeight,
    fontStyle: line.fontStyle,
    // '' = theme text color (inherit from CSS)
    color: line.color || undefined,
  };
  if (line.fontFamily) style.fontFamily = line.fontFamily;
  return style;
}

/**
 * Segments rendered for a header line (rich header, Story-0038): the
 * non-empty segments of the explicit list, or – when none have text – a
 * single segment carrying the classic line text (backward-compatible
 * fallback). Returns `[]` for a fully empty line.
 */
export function headerLineContent(line: UiHeaderLine): UiHeaderSegment[] {
  const segments = line.segments.filter((segment) => segment.text.trim() !== '');
  if (segments.length > 0) return segments;
  return line.text.trim() !== '' ? [{ text: line.text }] : [];
}

/**
 * Inline style of one styled segment: the line's base style with the
 * segment's own overrides applied. Omitted fields (or `color: ''`)
 * inherit the line style, which itself falls back to the theme.
 */
export function segmentStyle(segment: UiHeaderSegment, line: UiHeaderLine): CSSProperties {
  const style: CSSProperties = { ...headerLineStyle(line) };
  if (segment.color !== undefined && segment.color !== '') style.color = segment.color;
  if (segment.fontWeight !== undefined) style.fontWeight = segment.fontWeight;
  if (segment.fontStyle !== undefined) style.fontStyle = segment.fontStyle;
  if (segment.fontSize !== undefined) style.fontSize = `${segment.fontSize}px`;
  return style;
}
