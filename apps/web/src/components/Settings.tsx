import { useEffect } from 'react';
import type { Voice } from 'shared';
import { useVoiceContext } from '../voice/VoiceContext';

interface SettingsProps {
  /** Controls whether the settings dialog is visible. */
  open: boolean;
  /** Closes the dialog (backdrop, ×, Escape, "Fertig"). */
  onClose: () => void;
}

const SAMPLE_DE = 'Hallo! Dies ist dein gewähltes Sprachprofil.';
const SAMPLE_PHRASES: Record<string, string> = {
  de: SAMPLE_DE,
  es: '¡Hola! Esta es tu voz seleccionada.',
  en: 'Hello! This is your selected voice.',
};

const LANGUAGE_LABELS: Record<string, string> = {
  de: 'Deutsch',
  es: 'Spanisch',
  en: 'Englisch',
};

/** Groups a flat voice list by its language (order-preserving). */
function groupVoices(voices: Voice[]): [string, Voice[]][] {
  const groups = new Map<string, Voice[]>();
  for (const v of voices) {
    const arr = groups.get(v.language) ?? [];
    arr.push(v);
    groups.set(v.language, arr);
  }
  return Array.from(groups.entries());
}

export function Settings({ open, onClose }: SettingsProps) {
  const voice = useVoiceContext();

  // Close on Escape while the dialog is open.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const voices = voice.voices;
  const languages = voice.languages;
  const groups = groupVoices(voices);
  const ttsAvailable = voice.isTtsAvailable;

  const selectedVoice = voices.find((v) => v.id === voice.currentVoice);
  const samplePhrase = SAMPLE_PHRASES[selectedVoice?.language ?? 'de'] ?? SAMPLE_DE;
  const canPreview = ttsAvailable && Boolean(voice.currentVoice) && !voice.isSpeaking;

  return (
    <>
      <div className="settings-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        className="modal settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title" id="settings-title">
                Einstellungen
              </h2>
              <button
                type="button"
                className="btn-close"
                aria-label="Schließen"
                onClick={onClose}
              />
            </div>

            <div className="modal-body">
              {/* ── Voice (TTS) ── */}
              <div className="mb-3">
                <label className="form-label" htmlFor="settings-voice">
                  Stimme (Sprachausgabe)
                </label>
                <div className="input-group">
                  <select
                    id="settings-voice"
                    className="form-select"
                    value={voice.currentVoice}
                    disabled={!ttsAvailable}
                    onChange={(e) => voice.setCurrentVoice(e.target.value)}
                  >
                    {groups.map(([lang, list]) => (
                      <optgroup key={lang} label={LANGUAGE_LABELS[lang] ?? lang}>
                        {list.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    disabled={!canPreview}
                    onClick={() => void voice.speak(samplePhrase)}
                  >
                    {voice.isSpeaking ? '⏹ Stopp' : '🔊 Hören'}
                  </button>
                </div>
                {!ttsAvailable && (
                  <div className="form-text settings-notice" role="status">
                    Voice-Sidecar nicht erreichbar – Sprachausgabe ist deaktiviert.
                  </div>
                )}
              </div>

              {/* ── Language (STT) ── */}
              <div className="mb-0">
                <label className="form-label" htmlFor="settings-language">
                  Sprache (Spracherkennung)
                </label>
                <select
                  id="settings-language"
                  className="form-select"
                  value={voice.currentLanguage}
                  onChange={(e) => voice.setCurrentLanguage(e.target.value)}
                >
                  {languages.map((lang) => (
                    <option key={lang} value={lang}>
                      {LANGUAGE_LABELS[lang] ?? lang}
                    </option>
                  ))}
                </select>
                <div className="form-text">
                  Bestimmt, in welcher Sprache deine Spracheingabe erkannt wird.
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-primary" onClick={onClose}>
                Fertig
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
