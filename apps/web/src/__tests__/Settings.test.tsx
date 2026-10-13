import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Settings } from '../components/Settings';
import { VoiceProvider } from '../voice/VoiceContext';

const VOICE_LABEL = 'Stimme (Sprachausgabe)';
const LANGUAGE_LABEL = 'Sprache (Spracherkennung)';

function mockCapabilities(payload: unknown) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('/api/voice/capabilities')) {
      return { ok: true, json: async () => payload } as unknown as Response;
    }
    return { ok: false, status: 404, json: async () => ({}) } as unknown as Response;
  });
}

const caps = {
  data: {
    tts: true,
    stt: true,
    voices: [
      { id: 'de-DE-KatjaNeural', name: 'Katja', gender: 'f', language: 'de' },
      { id: 'es-ES-ElviraNeural', name: 'Elvira', gender: 'f', language: 'es' },
    ],
    languages: ['de', 'es', 'en'],
    defaultVoiceByLanguage: { de: 'de-DE-KatjaNeural', es: 'es-ES-ElviraNeural' },
  },
};

function renderSettings(props: { open?: boolean; onClose?: () => void } = {}) {
  const onClose = props.onClose ?? vi.fn();
  const result = render(
    <VoiceProvider>
      <Settings open={props.open ?? true} onClose={onClose} />
    </VoiceProvider>
  );
  return { ...result, onClose };
}

describe('Settings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the voice + language selects when open', async () => {
    mockCapabilities(caps);
    renderSettings();
    expect(await screen.findByLabelText(VOICE_LABEL)).toBeInTheDocument();
    expect(screen.getByLabelText(LANGUAGE_LABEL)).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    mockCapabilities(caps);
    renderSettings({ open: false });
    expect(screen.queryByLabelText(VOICE_LABEL)).not.toBeInTheDocument();
  });

  it('persists the selected voice', async () => {
    mockCapabilities(caps);
    const user = userEvent.setup();
    renderSettings();
    const voiceSelect = await screen.findByLabelText(VOICE_LABEL);
    await user.selectOptions(voiceSelect, 'es-ES-ElviraNeural');
    await waitFor(() => {
      expect(localStorage.getItem('base-chat.voice')).toBe('es-ES-ElviraNeural');
    });
  });

  it('persists the selected language', async () => {
    mockCapabilities(caps);
    const user = userEvent.setup();
    renderSettings();
    const langSelect = await screen.findByLabelText(LANGUAGE_LABEL);
    await user.selectOptions(langSelect, 'en');
    await waitFor(() => {
      expect(localStorage.getItem('base-chat.language')).toBe('en');
    });
  });

  it('calls onClose when the close button is clicked', async () => {
    mockCapabilities(caps);
    const user = userEvent.setup();
    const { onClose } = renderSettings();
    await screen.findByLabelText(VOICE_LABEL);
    await user.click(screen.getByLabelText('Schließen'));
    expect(onClose).toHaveBeenCalled();
  });

  it('disables the voice select when TTS is unavailable', async () => {
    mockCapabilities({
      data: { tts: false, stt: false, voices: [], languages: [], defaultVoiceByLanguage: {} },
    });
    renderSettings();
    const voiceSelect = await screen.findByLabelText(VOICE_LABEL);
    expect(voiceSelect).toBeDisabled();
    expect(screen.getByText(/Voice-Sidecar nicht erreichbar/i)).toBeInTheDocument();
  });
});
