import { useEffect, useState } from 'react';
import type { Voice } from 'shared';
import { useVoiceContext } from '../voice/VoiceContext';
import { CustomizeTab } from './CustomizeTab';
import { PromptTab } from './PromptTab';
import { DiagnosticsTab } from './DiagnosticsTab';

interface SettingsProps {
  /** Controls whether the settings dialog is visible. */
  open: boolean;
  /** Closes the dialog (backdrop, ×, Escape, "Fertig"). */
  onClose: () => void;
}

type SettingsTab = 'voice' | 'diagnostics' | 'appearance' | 'prompt';

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
  const [activeTab, setActiveTab] = useState<SettingsTab>('voice');

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
        <div className="modal-dialog modal-dialog-centered modal-lg">
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
              <nav
                className="nav nav-tabs settings-tabs"
                role="tablist"
                aria-label="Einstellungsbereiche"
              >
                <button
                  type="button"
                  role="tab"
                  id="settings-tab-voice"
                  className={`nav-link${activeTab === 'voice' ? ' active' : ''}`}
                  aria-selected={activeTab === 'voice'}
                  aria-controls="settings-panel-voice"
                  onClick={() => setActiveTab('voice')}
                >
                  Stimme &amp; Sprache
                </button>
                <button
                  type="button"
                  role="tab"
                  id="settings-tab-diagnostics"
                  className={`nav-link${activeTab === 'diagnostics' ? ' active' : ''}`}
                  aria-selected={activeTab === 'diagnostics'}
                  aria-controls="settings-panel-diagnostics"
                  onClick={() => setActiveTab('diagnostics')}
                >
                  Verbindung
                </button>
                <button
                  type="button"
                  role="tab"
                  id="settings-tab-appearance"
                  className={`nav-link${activeTab === 'appearance' ? ' active' : ''}`}
                  aria-selected={activeTab === 'appearance'}
                  aria-controls="settings-panel-appearance"
                  onClick={() => setActiveTab('appearance')}
                >
                  Erscheinungsbild
                </button>
                <button
                  type="button"
                  role="tab"
                  id="settings-tab-prompt"
                  className={`nav-link${activeTab === 'prompt' ? ' active' : ''}`}
                  aria-selected={activeTab === 'prompt'}
                  aria-controls="settings-panel-prompt"
                  onClick={() => setActiveTab('prompt')}
                >
                  Chatbot-Prompt
                </button>
              </nav>

              {activeTab === 'voice' && (
                <div role="tabpanel" id="settings-panel-voice" aria-labelledby="settings-tab-voice">
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
              )}
              {activeTab === 'diagnostics' && (
                <div
                  role="tabpanel"
                  id="settings-panel-diagnostics"
                  aria-labelledby="settings-tab-diagnostics"
                >
                  <DiagnosticsTab />
                </div>
              )}
              {activeTab === 'appearance' && (
                <div
                  role="tabpanel"
                  id="settings-panel-appearance"
                  aria-labelledby="settings-tab-appearance"
                >
                  <CustomizeTab />
                </div>
              )}
              {activeTab === 'prompt' && (
                <div
                  role="tabpanel"
                  id="settings-panel-prompt"
                  aria-labelledby="settings-tab-prompt"
                >
                  <PromptTab />
                </div>
              )}
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
