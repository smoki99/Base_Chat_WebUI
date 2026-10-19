import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { UiHeaderLine } from 'shared';
import { headerLineContent, headerLineStyle, segmentStyle } from '../appearance/headerStyle';
import { HeaderLineView } from '../appearance/headerPreview';

const LINE: UiHeaderLine = {
  text: 'Base Chat',
  fontFamily: '',
  fontSize: 16,
  fontWeight: 700,
  fontStyle: 'normal',
  color: '',
  segments: [],
};

describe('headerLineStyle', () => {
  it('maps the line fields to inline styles', () => {
    expect(headerLineStyle(LINE)).toEqual({
      fontSize: '16px',
      fontWeight: 700,
      fontStyle: 'normal',
      color: undefined,
    });
  });

  it('sets the color only when a non-theme color is chosen', () => {
    const styled: UiHeaderLine = { ...LINE, color: '#ff0000' };
    expect(headerLineStyle(styled).color).toBe('#ff0000');
    expect('fontFamily' in headerLineStyle(LINE)).toBe(false);
    expect(headerLineStyle({ ...LINE, fontFamily: 'Georgia, serif' }).fontFamily).toBe(
      'Georgia, serif'
    );
  });
});

describe('headerLineContent (rich header fallback)', () => {
  it('renders the non-empty segments when they carry text', () => {
    const line: UiHeaderLine = {
      ...LINE,
      segments: [{ text: 'Bold ' }, { text: '', fontSize: 30 }, { text: 'part', color: '#123456' }],
    };
    expect(headerLineContent(line)).toEqual([
      { text: 'Bold ' },
      { text: 'part', color: '#123456' },
    ]);
  });

  it('falls back to the classic line text when no segment has text', () => {
    expect(headerLineContent(LINE)).toEqual([{ text: 'Base Chat' }]);
    // Draft-only segments (empty text) must not hide the fallback.
    const draft: UiHeaderLine = { ...LINE, segments: [{ text: ' ' }] };
    expect(headerLineContent(draft)).toEqual([{ text: 'Base Chat' }]);
  });

  it('returns an empty list for a fully empty line', () => {
    const empty: UiHeaderLine = { ...LINE, text: '' };
    expect(headerLineContent(empty)).toEqual([]);
  });
});

describe('segmentStyle', () => {
  it('inherits the line style for unstyled segments', () => {
    expect(segmentStyle({ text: 'x' }, LINE)).toEqual({
      fontSize: '16px',
      fontWeight: 700,
      fontStyle: 'normal',
      color: undefined,
    });
  });

  it('applies the segment overrides on top of the line style', () => {
    const style = segmentStyle(
      { text: 'x', color: '#112233', fontWeight: 900, fontStyle: 'italic', fontSize: 24 },
      LINE
    );
    expect(style.color).toBe('#112233');
    expect(style.fontWeight).toBe(900);
    expect(style.fontStyle).toBe('italic');
    expect(style.fontSize).toBe('24px');
  });

  it("treats color '' as 'inherit' (no override)", () => {
    expect(segmentStyle({ text: 'x', color: '' }, { ...LINE, color: '#abc123' }).color).toBe(
      '#abc123'
    );
  });
});

describe('HeaderLineView', () => {
  it('renders the segment list with per-segment styles', () => {
    const line: UiHeaderLine = {
      ...LINE,
      segments: [
        { text: 'Bold ', fontWeight: 900 },
        { text: 'italic ', fontStyle: 'italic' },
        { text: 'blue', color: '#0000ff' },
      ],
    };
    const { container } = render(<HeaderLineView line={line} className="chat-header-title" />);
    const [bold, italic, blue] = Array.from(
      container.querySelectorAll('span span')
    ) as HTMLElement[];
    expect(bold).toHaveTextContent('Bold');
    expect(bold).toHaveStyle({ fontWeight: '900', fontSize: '16px' });
    expect(italic).toHaveStyle({ fontStyle: 'italic', fontWeight: '700' });
    expect(blue).toHaveStyle({ color: '#0000ff', fontWeight: '700' });
  });

  it('falls back to the classic line text for unstyled lines', () => {
    render(<HeaderLineView line={LINE} className="chat-header-title" />);
    const el = screen.getByText('Base Chat');
    expect(el).toHaveStyle({ fontSize: '16px', fontWeight: '700' });
    // The default line inherits the theme text color → no inline color.
    expect(el.style.color).toBe('');
  });

  it('renders nothing for a fully empty line', () => {
    const { container } = render(<HeaderLineView line={{ ...LINE, text: '' }} />);
    expect(container.innerHTML).toBe('');
  });
});
