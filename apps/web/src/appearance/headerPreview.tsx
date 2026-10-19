/**
 * Shared rendering of one header line (rich header, Story-0038): styled
 * segments, or – when none have text – the classic line text. Used by the
 * chat header (Chat.tsx) and the settings preview (CustomizeTab.tsx).
 * Returns `null` for fully empty lines.
 */
import type { UiHeaderLine } from 'shared';
import { headerLineContent, headerLineStyle, segmentStyle } from './headerStyle';

export function HeaderLineView({ line, className }: { line: UiHeaderLine; className?: string }) {
  const segments = headerLineContent(line);
  if (segments.length === 0) return null;
  return (
    <span className={className} style={headerLineStyle(line)}>
      {segments.map((segment, index) => (
        <span key={index} style={segmentStyle(segment, line)}>
          {segment.text}
        </span>
      ))}
    </span>
  );
}
