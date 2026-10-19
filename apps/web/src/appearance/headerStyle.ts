/**
 * Inline styles for a configurable header line (Story-0038).
 * Shared by the chat header (Chat.tsx) and the settings preview (CustomizeTab).
 */
import type { CSSProperties } from 'react';
import type { UiHeaderLine } from 'shared';

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
