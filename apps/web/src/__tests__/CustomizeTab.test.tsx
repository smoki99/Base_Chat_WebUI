import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEFAULT_UI_CUSTOMIZATION } from 'shared';
import { CustomizeTab } from '../components/CustomizeTab';
import { AppearanceProvider } from '../appearance/AppearanceContext';
import { ImageValidationError } from '../appearance/imageUtils';

// Story-0038: the provider talks to the server – keep unit tests offline.
vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    fetchUiCustomization: () => Promise.resolve(DEFAULT_UI_CUSTOMIZATION),
    saveUiCustomization: () => Promise.resolve(DEFAULT_UI_CUSTOMIZATION),
  };
});

// Replace the image pipeline with a mock (no real decoding in jsdom).
const mockProcessImageFile = vi.fn();
vi.mock('../appearance/imageUtils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../appearance/imageUtils')>();
  return {
    ...actual,
    processImageFile: (...args: Parameters<typeof mockProcessImageFile>) =>
      mockProcessImageFile(...args),
  };
});

const LOGO_URL = 'data:image/png;base64,LOGO';
const BANNER_URL = 'data:image/png;base64,BANNER';

function pngFile(name: string): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type: 'image/png' });
}

function renderCustomizeTab() {
  return render(
    <AppearanceProvider>
      <CustomizeTab />
    </AppearanceProvider>
  );
}

describe('CustomizeTab', () => {
  beforeEach(() => {
    mockProcessImageFile.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the five color pickers with their default values', () => {
    renderCustomizeTab();
    expect(screen.getByLabelText('Primärfarbe')).toHaveValue('#4f46e5');
    expect(screen.getByLabelText('Primärfarbe (Hover)')).toHaveValue('#4338ca');
    expect(screen.getByLabelText('Hintergrund')).toHaveValue('#ffffff');
    expect(screen.getByLabelText('Seitenleiste')).toHaveValue('#f8fafc');
    expect(screen.getByLabelText('Textfarbe')).toHaveValue('#1e1e2e');
  });

  it('renders all presets and marks the default one as active', () => {
    renderCustomizeTab();
    const presets = screen.getAllByRole('button', { name: /Farbschema .* anwenden/ });
    expect(presets).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Farbschema Indigo anwenden' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('updates the color pickers when a preset is applied', async () => {
    const user = userEvent.setup();
    renderCustomizeTab();
    await user.click(screen.getByRole('button', { name: 'Farbschema Ocean anwenden' }));
    expect(screen.getByLabelText('Primärfarbe')).toHaveValue('#0369a1');
    expect(screen.getByLabelText('Seitenleiste')).toHaveValue('#f0f9ff');
    expect(screen.getByRole('button', { name: 'Farbschema Ocean anwenden' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    // The default preset is no longer active.
    expect(screen.getByRole('button', { name: 'Farbschema Indigo anwenden' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('uploads a logo and shows the preview', async () => {
    mockProcessImageFile.mockResolvedValue({
      dataUrl: LOGO_URL,
      width: 100,
      height: 50,
      byteSize: 3,
      resized: false,
    });
    const user = userEvent.setup();
    renderCustomizeTab();
    await user.upload(screen.getByLabelText('Logo-Datei wählen'), pngFile('logo.png'));
    expect(mockProcessImageFile).toHaveBeenCalledTimes(1);
    await expect(screen.findByAltText('Logo (Vorschau)')).resolves.toHaveAttribute('src', LOGO_URL);
    // The remove button appears once a logo exists.
    expect(screen.getByRole('button', { name: 'Logo entfernen' })).toBeInTheDocument();
  });

  it('shows the banner toggle after a banner upload and can hide the banner', async () => {
    mockProcessImageFile.mockResolvedValue({
      dataUrl: BANNER_URL,
      width: 100,
      height: 50,
      byteSize: 3,
      resized: false,
    });
    const user = userEvent.setup();
    renderCustomizeTab();
    await user.upload(screen.getByLabelText('Banner-Datei wählen'), pngFile('banner.png'));
    const toggle = await screen.findByLabelText('Banner anzeigen');
    expect(toggle).toBeChecked();

    await user.click(toggle);
    expect(toggle).not.toBeChecked();
  });

  it('shows a readable error when the upload fails', async () => {
    mockProcessImageFile.mockRejectedValue(
      new ImageValidationError('TYPE', 'Only PNG images are supported.')
    );
    const user = userEvent.setup();
    renderCustomizeTab();
    await user.upload(screen.getByLabelText('Logo-Datei wählen'), pngFile('logo.png'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Only PNG images are supported.');
  });

  it('renders the two configurable header lines with their defaults', () => {
    renderCustomizeTab();
    const el = (id: string) => document.getElementById(id) as HTMLInputElement;
    expect(el('customize-header-line1-text')).toHaveValue('Base Chat');
    expect(el('customize-header-line2-text')).toHaveValue('');
    expect(el('customize-header-line1-font')).toHaveValue('');
    expect(el('customize-header-line1-size')).toHaveValue('16');
  });

  it('edits a header line (text, italic) and previews it live', async () => {
    renderCustomizeTab();
    const user = userEvent.setup();

    await user.type(
      document.getElementById('customize-header-line2-text') as HTMLInputElement,
      "Let's talk realestate."
    );
    await user.click(document.getElementById('customize-header-line2-italic') as HTMLInputElement);

    const line2 = document.querySelector('.customize-header-preview .chat-header-title--line2');
    expect(line2).toHaveTextContent("Let's talk realestate.");
    expect(line2).toHaveStyle({ fontStyle: 'italic' });
  });

  // ── Rich header: styled segments (Story-0038) ─────────────────────────────

  it('offers segment editing for lines with text, not for empty lines', () => {
    renderCustomizeTab();
    expect(
      screen.getByRole('button', { name: 'Segment aus Zeilen-Text anlegen' })
    ).toBeInTheDocument();
    // Line 2 is empty by default → no "create segment" control there.
    expect(screen.getAllByRole('button', { name: 'Segment aus Zeilen-Text anlegen' })).toHaveLength(
      1
    );
  });

  it('creates a segment from the line text and styles it per segment', async () => {
    renderCustomizeTab();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Segment aus Zeilen-Text anlegen' }));
    const segmentText = screen.getByLabelText('Segment 1: Text');
    expect(segmentText).toHaveValue('Base Chat');

    // Style the segment: weight 900 + own color.
    await user.selectOptions(screen.getByLabelText('Segment 1: Stärke'), '900');
    await fireEvent.change(screen.getByLabelText('Segment 1: Farbe'), {
      target: { value: '#ff0000' },
    });

    // The preview renders the segment with the overrides on the line style.
    const preview = document.querySelector(
      '.customize-header-preview .chat-header-title--line1 span'
    ) as HTMLElement;
    expect(preview).toHaveTextContent('Base Chat');
    expect(preview).toHaveStyle({ fontWeight: '900', color: 'rgb(255, 0, 0)' });
  });

  it('marks the line text as a fallback while segments carry text', async () => {
    renderCustomizeTab();
    const user = userEvent.setup();
    const w1 = within(screen.getByRole('group', { name: 'Zeile 1' }));
    const hint = /Wird nur angezeigt, wenn alle Segmente leer sind/;

    // No segments → plain "Text" field, no fallback hint.
    expect(screen.queryByText(hint)).not.toBeInTheDocument();
    expect(w1.queryByLabelText('Text (Fallback)')).not.toBeInTheDocument();

    // First active segment → the text field becomes an explicit fallback.
    await user.click(w1.getByRole('button', { name: 'Segment aus Zeilen-Text anlegen' }));
    expect(w1.getByLabelText('Text (Fallback)')).toHaveClass('customize-text-fallback');
    expect(screen.getByText(hint)).toBeInTheDocument();

    // All segments empty again → the hint disappears (text renders normally).
    await user.clear(w1.getByLabelText('Segment 1: Text'));
    expect(screen.queryByText(hint)).not.toBeInTheDocument();
  });

  it('adds, reorders and removes draft segments', async () => {
    renderCustomizeTab();
    const user = userEvent.setup();
    // Scope to the line-1 editor (each line has its own segment controls).
    const w1 = within(screen.getByRole('group', { name: 'Zeile 1' }));

    await user.click(w1.getByRole('button', { name: 'Segment aus Zeilen-Text anlegen' }));
    await user.click(w1.getByRole('button', { name: '+ Segment' }));
    expect(w1.getByLabelText('Segment 2: Text')).toBeInTheDocument();

    // Move segment 2 up → it becomes segment 1.
    await user.click(w1.getByRole('button', { name: 'Segment 2 nach oben' }));
    expect((w1.getByLabelText('Segment 1: Text') as HTMLInputElement).value).toBe('');

    // Remove both again → the "create from line text" offer returns.
    await user.click(w1.getByRole('button', { name: 'Segment 1 entfernen' }));
    await user.click(w1.getByRole('button', { name: 'Segment 1 entfernen' }));
    expect(w1.getByRole('button', { name: 'Segment aus Zeilen-Text anlegen' })).toBeInTheDocument();
  });

  it('caps the number of segments at HEADER_MAX_SEGMENTS', async () => {
    renderCustomizeTab();
    const user = userEvent.setup();
    const w1 = within(screen.getByRole('group', { name: 'Zeile 1' }));

    await user.click(w1.getByRole('button', { name: 'Segment aus Zeilen-Text anlegen' }));
    // One segment already exists → 7 more fit (max 8).
    for (let i = 0; i < 7; i += 1) {
      await user.click(w1.getByRole('button', { name: '+ Segment' }));
    }
    expect(w1.getByRole('button', { name: '+ Segment' })).toBeDisabled();
    expect(w1.queryByLabelText('Segment 9: Text')).not.toBeInTheDocument();
  });

  it('limits the header text to 120 characters', async () => {
    renderCustomizeTab();
    const user = userEvent.setup();
    const input = document.getElementById('customize-header-line1-text') as HTMLInputElement;
    // The input already contains 'Base Chat' (9 chars); maxLength 120 applies to the
    // combined value, so 111 more characters fit.
    await user.type(input, 'a'.repeat(150));
    expect(input).toHaveValue('Base Chat' + 'a'.repeat(111));
  });

  it('resets to the factory defaults', async () => {
    mockProcessImageFile.mockResolvedValue({
      dataUrl: LOGO_URL,
      width: 100,
      height: 50,
      byteSize: 3,
      resized: false,
    });
    const user = userEvent.setup();
    renderCustomizeTab();
    await user.upload(screen.getByLabelText('Logo-Datei wählen'), pngFile('logo.png'));
    await screen.findByAltText('Logo (Vorschau)');

    await user.click(screen.getByRole('button', { name: 'Auf Werkseinstellungen zurücksetzen' }));
    expect(screen.getByLabelText('Primärfarbe')).toHaveValue('#4f46e5');
    expect(screen.queryByAltText('Logo (Vorschau)')).not.toBeInTheDocument();
  });
});
