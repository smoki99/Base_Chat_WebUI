import type { ReactElement } from 'react';
import { render as rtlRender, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { Chat } from '../components/Chat';
import { VoiceProvider } from '../voice/VoiceContext';

/**
 * Renders inside the shared voice provider (single useVoice instance), mirroring
 * how the app wires it. This keeps the capability / interactive-mode tests
 * exercising the real hook without per-test provider boilerplate.
 */
function render(ui: ReactElement) {
  return rtlRender(<VoiceProvider>{ui}</VoiceProvider>);
}

function mockApi(payload: unknown) {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue({ ok: true, json: async () => payload } as unknown as Response);
}

/** Returns a mock fetch that can be resolved manually (for async state tests). */
function mockApiDeferred() {
  let resolveFn: (value: unknown) => void;
  const promise = new Promise((resolve) => {
    resolveFn = resolve;
  });

  const spy = vi.spyOn(globalThis, 'fetch').mockReturnValue(
    new Promise<Response>((resolve) => {
      promise.then((payload) =>
        resolve({ ok: true, json: async () => payload } as unknown as Response)
      );
    })
  );

  return {
    spy,
    resolve: (payload: unknown) => resolveFn!(payload),
  };
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Chat', () => {
  test('shows the empty state before any message is sent', () => {
    render(<Chat />);
    expect(screen.getByText(/Starte die Unterhaltung/i)).toBeInTheDocument();
  });

  test('sends a message and renders the assistant reply', async () => {
    mockApi({ data: { id: 'r1', content: 'Hallo! Wie kann ich helfen?' } });
    const user = userEvent.setup();
    render(<Chat />);

    const input = screen.getByRole('textbox');
    await user.type(input, 'Hallo');
    await user.click(screen.getByRole('button', { name: 'Senden' }));

    expect(input).toHaveValue('');
    expect(await screen.findByText('Hallo! Wie kann ich helfen?')).toBeInTheDocument();
    expect(screen.getByText('Hallo', { exact: true })).toBeInTheDocument();
  });

  test('does not send a blank message', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/api/chat')) {
          return { ok: false, json: async () => ({}) } as Response;
        }
        return {
          ok: true,
          json: async () => ({
            data: { tts: false, stt: false, voices: [], languages: [], defaultVoiceByLanguage: {} },
          }),
        } as unknown as Response;
      });
    const user = userEvent.setup();
    render(<Chat />);

    await user.type(screen.getByRole('textbox'), '   ');
    await user.click(screen.getByRole('button', { name: 'Senden' }));

    const chatCalls = spy.mock.calls.filter((args) => String(args[0]).includes('/api/chat'));
    expect(chatCalls).toHaveLength(0);
  });

  test('shows the API error message on failure', async () => {
    mockApi({ error: { message: 'Serverfehler' } });
    const user = userEvent.setup();
    render(<Chat />);

    await user.type(screen.getByRole('textbox'), 'Hallo');
    await user.click(screen.getByRole('button', { name: 'Senden' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Serverfehler');
  });

  test('shows the typing indicator while waiting for the assistant reply', async () => {
    const { resolve } = mockApiDeferred();
    const user = userEvent.setup();
    render(<Chat />);

    await user.type(screen.getByRole('textbox'), 'Hallo');
    await user.click(screen.getByRole('button', { name: 'Senden' }));

    // Typing indicator should be visible while the request is in flight
    expect(screen.getByText('Bot schreibt …')).toBeInTheDocument();

    // Resolve the deferred response
    resolve({ data: { id: 'r1', content: 'Hallo zurück!' } });
    expect(await screen.findByText('Hallo zurück!')).toBeInTheDocument();

    // Typing indicator should be gone after the response arrives
    expect(screen.queryByText('Bot schreibt …')).not.toBeInTheDocument();
  });

  test('shows a sending indicator on the user message while the request is in flight', async () => {
    const { resolve } = mockApiDeferred();
    const user = userEvent.setup();
    render(<Chat />);

    await user.type(screen.getByRole('textbox'), 'Hallo');
    await user.click(screen.getByRole('button', { name: 'Senden' }));

    // While sending, the user message should have a sending indicator
    expect(screen.getByLabelText('Wird gesendet')).toBeInTheDocument();

    resolve({ data: { id: 'r1', content: 'Ok!' } });
    await screen.findByText('Ok!');

    // After success, the sending indicator should be gone
    expect(screen.queryByLabelText('Wird gesendet')).not.toBeInTheDocument();
  });

  test('shows an error indicator on the user message when the request fails', async () => {
    mockApi({ error: { message: 'Netzwerkfehler' } });
    const user = userEvent.setup();
    render(<Chat />);

    await user.type(screen.getByRole('textbox'), 'Hallo');
    await user.click(screen.getByRole('button', { name: 'Senden' }));

    // Error indicator on the user message
    expect(await screen.findByLabelText('Sendefehler')).toBeInTheDocument();
    // Alert banner with the error message
    expect(screen.getByRole('alert')).toHaveTextContent('Netzwerkfehler');
  });

  test('renders assistant replies as Markdown (table with headers)', async () => {
    mockApi({
      data: {
        id: 'r1',
        content: '| Stadt | Angebot |\n| --- | --- |\n| Hamburg | Fischbrot |',
      },
    });
    const user = userEvent.setup();
    render(<Chat />);

    await user.type(screen.getByRole('textbox'), 'Was gibt es in Hamburg?');
    await user.click(screen.getByRole('button', { name: 'Senden' }));

    // GFM table renders a real <table> with <th> / <td>
    expect(await screen.findByRole('cell', { name: 'Fischbrot' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Stadt' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Angebot' })).toBeInTheDocument();
  });

  test('opens Markdown links in a new, safe tab', async () => {
    mockApi({
      data: { id: 'r1', content: 'Mehr Infos in der [Dokumentation](https://example.com).' },
    });
    const user = userEvent.setup();
    render(<Chat />);

    await user.type(screen.getByRole('textbox'), 'Doku?');
    await user.click(screen.getByRole('button', { name: 'Senden' }));

    const link = await screen.findByRole('link', { name: 'Dokumentation' });
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  // ── Voice buttons ─────────────────────────────────────────────────────────

  test('hides voice buttons when the sidecar is unavailable', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { tts: false, stt: false, voices: [], languages: [], defaultVoiceByLanguage: {} },
      }),
    } as unknown as Response);
    render(<Chat />);

    // Mic button must NOT be present (STT unavailable).
    expect(screen.queryByRole('button', { name: /Spracheingabe/i })).not.toBeInTheDocument();
    // TTS button must NOT be present (no assistant message + TTS unavailable).
    expect(screen.queryByRole('button', { name: /Vorlesen/i })).not.toBeInTheDocument();
  });

  test('shows the mic button when STT is available', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          tts: true,
          stt: true,
          voices: [{ id: 'de-DE-KatjaNeural', name: 'Katja', gender: 'f', language: 'de' }],
          languages: ['de', 'es', 'en'],
          defaultVoiceByLanguage: { de: 'de-DE-KatjaNeural' },
        },
      }),
    } as unknown as Response);
    render(<Chat />);

    // Mic button must be present (STT available).
    expect(await screen.findByRole('button', { name: /Spracheingabe/i })).toBeInTheDocument();
  });

  test('shows the interactive mode button when STT is available', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          tts: true,
          stt: true,
          voices: [{ id: 'de-DE-KatjaNeural', name: 'Katja', gender: 'f', language: 'de' }],
          languages: ['de', 'es', 'en'],
          defaultVoiceByLanguage: { de: 'de-DE-KatjaNeural' },
        },
      }),
    } as unknown as Response);
    // Mock mediaDevices so toggle doesn't crash
    const mockStream = { getTracks: () => [{ stop: () => {} }] } as unknown as MediaStream;
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: () => Promise.resolve(mockStream) },
      writable: true,
      configurable: true,
    });
    (globalThis as Record<string, unknown>).AudioContext = class {
      createMediaStreamSource() {
        return { connect: () => {} };
      }
      createAnalyser() {
        return { getByteTimeDomainData: () => {}, fftSize: 512 };
      }
      close() {
        return Promise.resolve();
      }
    };
    (globalThis as Record<string, unknown>).requestAnimationFrame = () => 1;
    (globalThis as Record<string, unknown>).cancelAnimationFrame = () => {};

    const user = userEvent.setup();
    render(<Chat />);

    const btn = await screen.findByRole('button', { name: /Hands-free/i });
    expect(btn).toBeInTheDocument();
    // Click to toggle on (exercises onClick handler)
    await user.click(btn);
  });

  test('pauses the interactive (hands-free) mode while the bot is writing', async () => {
    // Keep the LLM call in flight so isLoading stays true.
    let resolveChat: (payload: unknown) => void;
    const chatPromise = new Promise((resolve) => {
      resolveChat = resolve;
    });
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/chat')) {
        await chatPromise;
        return {
          ok: true,
          json: async () => ({ data: { id: 'r1', content: 'Antwort' } }),
        } as unknown as Response;
      }
      // capabilities – STT available so the hands-free button is shown.
      return {
        ok: true,
        json: async () => ({
          data: {
            tts: false,
            stt: true,
            voices: [],
            languages: ['de'],
            defaultVoiceByLanguage: {},
          },
        }),
      } as unknown as Response;
    });
    const mockStream = { getTracks: () => [{ stop: () => {} }] } as unknown as MediaStream;
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: () => Promise.resolve(mockStream) },
      writable: true,
      configurable: true,
    });
    (globalThis as Record<string, unknown>).AudioContext = class {
      createMediaStreamSource() {
        return { connect: () => {} };
      }
      createAnalyser() {
        return { getByteTimeDomainData: () => {}, fftSize: 512 };
      }
      close() {
        return Promise.resolve();
      }
    };
    (globalThis as Record<string, unknown>).requestAnimationFrame = () => 1;
    (globalThis as Record<string, unknown>).cancelAnimationFrame = () => {};

    const user = userEvent.setup();
    render(<Chat />);

    // Enable interactive mode → dot is green (listening).
    const btn = await screen.findByRole('button', { name: /Hands-free/i });
    await user.click(btn);
    await waitFor(() => {
      expect(document.querySelector('.btn-interactive-dot')).not.toBeNull();
      expect(document.querySelector('.btn-interactive-dot--blue')).toBeNull();
    });

    // Send a message → isLoading becomes true (LLM call in flight).
    const input = screen.getByRole('textbox', { name: 'Nachricht' });
    await user.type(input, 'Hallo');
    await user.click(screen.getByRole('button', { name: /Senden/i }));

    // While the bot is writing, the hands-free mode must be paused (blue dot).
    await waitFor(() => {
      expect(document.querySelector('.btn-interactive-dot--blue')).not.toBeNull();
    });

    // Resolve the LLM call → isLoading false → mode resumes to listening (green).
    resolveChat!({ data: { id: 'r1', content: 'Antwort' } });
    await waitFor(() => {
      expect(document.querySelector('.btn-interactive-dot--blue')).toBeNull();
      expect(document.querySelector('.btn-interactive-dot')).not.toBeNull();
    });
  });

  test('hides interactive mode button when STT is unavailable', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { tts: false, stt: false, voices: [], languages: [], defaultVoiceByLanguage: {} },
      }),
    } as unknown as Response);
    render(<Chat />);

    expect(screen.queryByRole('button', { name: /Hands-free/i })).not.toBeInTheDocument();
  });

  // ── Voice Summary (auto-TTS) ────────────────────────────────────────────────

  test('strips the voice summary from the displayed message', async () => {
    // API returns a response that includes the VOICE_SUMMARY marker.
    const fullResponse =
      'Hier ist die Antwort auf deine Frage.\n\n<!-- VOICE_SUMMARY: -->Kurze Zusammenfassung für die Sprachausgabe.';
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/chat')) {
        return {
          ok: true,
          json: async () => ({ data: { id: 'r1', content: fullResponse } }),
        } as unknown as Response;
      }
      // Voice capabilities – TTS unavailable so no auto-speak side-effect.
      return {
        ok: true,
        json: async () => ({
          data: { tts: false, stt: false, voices: [], languages: [], defaultVoiceByLanguage: {} },
        }),
      } as unknown as Response;
    });
    const user = userEvent.setup();
    render(<Chat />);

    await user.type(screen.getByRole('textbox'), 'Test');
    await user.click(screen.getByRole('button', { name: 'Senden' }));

    // The main content should be visible…
    expect(await screen.findByText(/Hier ist die Antwort/i)).toBeInTheDocument();
    // …but the voice summary should NOT be displayed.
    expect(
      screen.queryByText(/Kurze Zusammenfassung für die Sprachausgabe/i)
    ).not.toBeInTheDocument();
  });

  test('displays the full message when no voice summary marker is present', async () => {
    const plainResponse = 'Einfache Antwort ohne Marker.';
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/chat')) {
        return {
          ok: true,
          json: async () => ({ data: { id: 'r1', content: plainResponse } }),
        } as unknown as Response;
      }
      return {
        ok: true,
        json: async () => ({
          data: { tts: false, stt: false, voices: [], languages: [], defaultVoiceByLanguage: {} },
        }),
      } as unknown as Response;
    });
    const user = userEvent.setup();
    render(<Chat />);

    await user.type(screen.getByRole('textbox'), 'Test');
    await user.click(screen.getByRole('button', { name: 'Senden' }));

    expect(await screen.findByText('Einfache Antwort ohne Marker.')).toBeInTheDocument();
  });

  test('renders a rich header with per-segment styles (Story-0038)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { tts: false, stt: false, voices: [], languages: [], defaultVoiceByLanguage: {} },
      }),
    } as unknown as Response);

    render(
      <Chat
        header={{
          line1: {
            text: 'Base Chat',
            fontFamily: '',
            fontSize: 16,
            fontWeight: 700,
            fontStyle: 'normal',
            color: '',
            segments: [
              { text: 'Bold ', fontWeight: 900 },
              { text: 'Blue', color: '#0000ff' },
            ],
          },
          line2: {
            text: '',
            fontFamily: '',
            fontSize: 14,
            fontWeight: 400,
            fontStyle: 'italic',
            color: '',
            segments: [{ text: "Let's talk realestate." }],
          },
        }}
      />
    );

    const line1 = document.querySelector('.chat-header .chat-header-title--line1') as HTMLElement;
    const [bold, blue] = Array.from(line1.querySelectorAll('span')) as HTMLElement[];
    expect(bold).toHaveTextContent('Bold');
    expect(bold).toHaveStyle({ fontWeight: '900', fontSize: '16px' });
    expect(blue).toHaveStyle({ color: 'rgb(0, 0, 255)', fontWeight: '700' });

    const line2 = document.querySelector('.chat-header .chat-header-title--line2') as HTMLElement;
    expect(line2).toHaveTextContent("Let's talk realestate.");
    expect(line2).toHaveStyle({ fontStyle: 'italic', fontSize: '14px' });
  });

  test('hides empty header lines in the chat header', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { tts: false, stt: false, voices: [], languages: [], defaultVoiceByLanguage: {} },
      }),
    } as unknown as Response);

    render(
      <Chat
        header={{
          line1: {
            text: '',
            fontFamily: '',
            fontSize: 16,
            fontWeight: 700,
            fontStyle: 'normal',
            color: '',
            segments: [],
          },
          line2: {
            text: '',
            fontFamily: '',
            fontSize: 14,
            fontWeight: 400,
            fontStyle: 'normal',
            color: '',
            segments: [],
          },
        }}
      />
    );

    expect(document.querySelector('.chat-header .chat-header-titles')).toBeEmptyDOMElement();
  });
});
