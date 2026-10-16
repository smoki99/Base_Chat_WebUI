import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomizeTab } from '../components/CustomizeTab';
import { AppearanceProvider } from '../appearance/AppearanceContext';
import { ImageValidationError } from '../appearance/imageUtils';

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
