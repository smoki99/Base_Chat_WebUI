import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { Chat } from '../components/Chat';

function mockApi(payload: unknown) {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue({ ok: true, json: async () => payload } as unknown as Response);
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
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: 'x', content: 'x' } }),
    } as unknown as Response);
    const user = userEvent.setup();
    render(<Chat />);

    await user.type(screen.getByRole('textbox'), '   ');
    await user.click(screen.getByRole('button', { name: 'Senden' }));

    expect(spy).not.toHaveBeenCalled();
  });

  test('shows the API error message on failure', async () => {
    mockApi({ error: { message: 'Serverfehler' } });
    const user = userEvent.setup();
    render(<Chat />);

    await user.type(screen.getByRole('textbox'), 'Hallo');
    await user.click(screen.getByRole('button', { name: 'Senden' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Serverfehler');
  });
});
