import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useVoice } from '../hooks/useVoice';
import type { UseVoiceReturn } from '../hooks/useVoice';

/**
 * Single shared voice state for the whole app.
 *
 * `useVoice()` owns the TTS/STT state (current voice, language, mic, …).
 * Both the `Chat` (uses it for TTS) and the `Settings` dialog (lets the user
 * change voice/language) must share ONE instance, otherwise a voice change in
 * Settings would not affect the TTS used by the chat. The provider calls the
 * hook once and exposes the result through context.
 */
const VoiceContext = createContext<UseVoiceReturn | null>(null);

export function VoiceProvider({ children }: { children: ReactNode }) {
  const voice = useVoice();
  return <VoiceContext.Provider value={voice}>{children}</VoiceContext.Provider>;
}

/** Access the shared voice state. Must be used inside a `VoiceProvider`. */
export function useVoiceContext(): UseVoiceReturn {
  const ctx = useContext(VoiceContext);
  if (!ctx) {
    throw new Error('useVoiceContext must be used within a VoiceProvider');
  }
  return ctx;
}
