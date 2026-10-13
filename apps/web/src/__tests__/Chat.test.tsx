import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { Chat } from '../components/Chat';

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
});
