/**
 * Story-0036 – PromptTab (settings tab for the custom chatbot prompt).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PromptTab } from '../components/PromptTab';
import { MAX_CUSTOM_PROMPT_CHARS } from 'shared';

type ApiResult = { ok?: boolean; status?: number; data?: unknown; error?: string };

/** Mock GET/PUT /api/chat/custom-prompt and record the calls. */
function mockPromptApi(get: ApiResult, put: (body: string) => ApiResult) {
  const calls: Array<{ method: string; body?: string }> = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(
    async (_input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const body = typeof init?.body === 'string' ? init.body : undefined;
      calls.push({ method, body });
      const result = method === 'PUT' ? put(body ?? '') : get;
      const payload =
        result.error !== undefined ? { error: { message: result.error } } : { data: result.data };
      return {
        ok: result.ok ?? true,
        status: result.status ?? 200,
        json: async () => payload,
      } as unknown as Response;
    }
  );
  return calls;
}

describe('PromptTab', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders token field, editor and character counter; editor disabled without token', () => {
    mockPromptApi({ data: { content: '' } }, () => ({ data: { content: '' } }));
    render(<PromptTab />);
    expect(screen.getByLabelText('Admin-Token')).toBeInTheDocument();
    const editor = screen.getByLabelText(/Chatbot-Prompt/);
    expect(editor).toBeDisabled();
    expect(screen.getByText(`${0} / ${MAX_CUSTOM_PROMPT_CHARS} Zeichen`)).toBeInTheDocument();
  });

  it('loads the stored prompt into the editor when a token is present', async () => {
    localStorage.setItem('admin_token', 'secret');
    mockPromptApi({ data: { content: 'SKU = Artikelnummer' } }, () => ({ data: { content: '' } }));
    render(<PromptTab />);
    const editor = screen.getByLabelText(/Chatbot-Prompt/) as HTMLTextAreaElement;
    await waitFor(() => expect(editor.value).toBe('SKU = Artikelnummer'));
    expect(editor).toBeEnabled();
  });

  it('saves edited content via PUT and reports success', async () => {
    localStorage.setItem('admin_token', 'secret');
    const calls = mockPromptApi({ data: { content: 'old' } }, (body) => ({
      data: { content: JSON.parse(body).content.trim() },
    }));
    const user = userEvent.setup();
    render(<PromptTab />);
    const editor = screen.getByLabelText(/Chatbot-Prompt/) as HTMLTextAreaElement;
    await waitFor(() => expect(editor.value).toBe('old'));

    await user.type(editor, 'X');
    expect(screen.getByRole('button', { name: 'Speichern' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/Gespeichert/));
    const put = calls.find((c) => c.method === 'PUT');
    expect(put?.body).toBe(JSON.stringify({ content: 'oldX' }));
  });

  it('shows the API error message when the token is rejected (403)', async () => {
    localStorage.setItem('admin_token', 'wrong');
    mockPromptApi({ ok: false, status: 403, error: 'Invalid admin token' }, () => ({
      ok: false,
      status: 403,
      error: 'Invalid admin token',
    }));
    render(<PromptTab />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Invalid admin token'));
  });

  it('clears the stored prompt via Zurücksetzen (PUT with empty content)', async () => {
    localStorage.setItem('admin_token', 'secret');
    const calls = mockPromptApi({ data: { content: 'some text' } }, (body) => ({
      data: { content: JSON.parse(body).content.trim() },
    }));
    const user = userEvent.setup();
    render(<PromptTab />);
    const editor = screen.getByLabelText(/Chatbot-Prompt/) as HTMLTextAreaElement;
    await waitFor(() => expect(editor.value).toBe('some text'));

    await user.click(screen.getByRole('button', { name: 'Zurücksetzen' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/Zurückgesetzt/));
    expect(editor.value).toBe('');
    const put = calls.find((c) => c.method === 'PUT');
    expect(put?.body).toBe(JSON.stringify({ content: '' }));
  });

  it('disables saving and flags the limit when content exceeds MAX_CUSTOM_PROMPT_CHARS', async () => {
    localStorage.setItem('admin_token', 'secret');
    mockPromptApi({ data: { content: '' } }, () => ({ data: { content: '' } }));
    render(<PromptTab />);
    const editor = screen.getByLabelText(/Chatbot-Prompt/) as HTMLTextAreaElement;
    await waitFor(() => expect(editor).toBeEnabled());

    fireEvent.change(editor, { target: { value: 'x'.repeat(MAX_CUSTOM_PROMPT_CHARS + 1) } });
    expect(screen.getByRole('button', { name: 'Speichern' })).toBeDisabled();
    expect(screen.getByText(/zu lang/)).toBeInTheDocument();
  });
});
