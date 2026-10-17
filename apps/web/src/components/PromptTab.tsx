/**
 * PromptTab – settings tab for the custom chatbot prompt (Story-0036).
 *
 * The prompt extension (e.g. a glossary for imported tables/columns) is
 * stored server-side (shared across all users) and appended to the LLM's
 * system prompt. Protected by the same ADMIN_TOKEN as the DB-Admin dialog
 * (stored in the same localStorage key).
 */
import { useCallback, useEffect, useState } from 'react';
import { MAX_CUSTOM_PROMPT_CHARS } from 'shared';
import { fetchCustomPrompt, saveCustomPrompt } from '../lib/api';

/** Same key the DB-Admin dialog uses – one token for all admin features. */
const TOKEN_STORAGE_KEY = 'admin_token';

function readStoredToken(): string {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function persistToken(token: string): void {
  try {
    if (token) window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    else window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // localStorage unavailable (private mode) – token stays in memory only.
  }
}

export function PromptTab() {
  const [token, setToken] = useState(readStoredToken);
  const [loaded, setLoaded] = useState(false);
  const [stored, setStored] = useState('');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async (tk: string) => {
    setBusy(true);
    setError('');
    setStatusText('Lädt…');
    try {
      const content = await fetchCustomPrompt(tk);
      setStored(content);
      setDraft(content);
      setLoaded(true);
      setStatusText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatusText('');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (token) void load(token);
  }, [token, load]);

  const dirty = loaded && draft !== stored;
  const overLimit = draft.length > MAX_CUSTOM_PROMPT_CHARS;
  const canSave = loaded && dirty && !overLimit && !busy;
  const canReset = loaded && stored !== '' && !busy;

  async function handleSave() {
    setBusy(true);
    setError('');
    setStatusText('Speichert…');
    try {
      const storedContent = await saveCustomPrompt(token, draft);
      setStored(storedContent);
      setDraft(storedContent);
      setStatusText('✓ Gespeichert');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatusText('');
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    setBusy(true);
    setError('');
    setStatusText('Setze zurück…');
    try {
      const storedContent = await saveCustomPrompt(token, '');
      setStored(storedContent);
      setDraft('');
      setStatusText('✓ Zurückgesetzt');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatusText('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-3">
        <label className="form-label" htmlFor="prompt-admin-token">
          Admin-Token
        </label>
        <input
          id="prompt-admin-token"
          type="password"
          className="form-control"
          value={token}
          placeholder="ADMIN_TOKEN aus der .env"
          autoComplete="off"
          onChange={(e) => {
            const next = e.target.value.trim();
            setToken(next);
            persistToken(next);
          }}
        />
        <div className="form-text">
          Gleicher Token wie der DB-Admin. Ohne Token bleibt die Funktion deaktiviert (403).
        </div>
      </div>

      <label className="form-label" htmlFor="prompt-editor">
        Chatbot-Prompt (Begriffserklärungen, Zusatzanweisungen)
      </label>
      <textarea
        id="prompt-editor"
        className="form-control font-monospace"
        rows={10}
        value={draft}
        disabled={!token || busy}
        placeholder={'z. B.\nSKU = Artikelnummer\nMwSt. = Mehrwertsteuer (19 %)\n…'}
        onChange={(e) => setDraft(e.target.value)}
      />
      <div className={`form-text${overLimit ? ' text-danger' : ''}`}>
        {draft.length} / {MAX_CUSTOM_PROMPT_CHARS} Zeichen{overLimit ? ' – zu lang' : ''}
      </div>

      <div className="d-flex gap-2 align-items-center flex-wrap">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!canSave}
          onClick={() => void handleSave()}
        >
          Speichern
        </button>
        <button
          type="button"
          className="btn btn-outline-secondary"
          disabled={!canReset}
          onClick={() => void handleReset()}
        >
          Zurücksetzen
        </button>
        <span role="status" aria-live="polite" className="small">
          {statusText}
        </span>
        {error && (
          <span role="alert" className="small text-danger">
            {error}
          </span>
        )}
      </div>
      <div className="form-text mt-2">
        Wird dem Systemprompt des Chatbots hinzugefügt (z. B. um Begriffe importierter Tabellen und
        Spalten zu erklären). Gilt für alle Nutzer der Instanz und liegt serverseitig auf dem
        Dateisystem der API.
      </div>
    </div>
  );
}
