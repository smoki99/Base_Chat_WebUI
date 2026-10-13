import { useCallback, useEffect, useRef, useState } from 'react';
import type { Voice, VoiceCapabilities } from 'shared';

const API = '/api/voice';

interface UseVoiceReturn {
  capabilities: VoiceCapabilities | null;
  isTtsAvailable: boolean;
  isSttAvailable: boolean;
  voices: Voice[];
  languages: string[];
  currentVoice: string;
  setCurrentVoice: (v: string) => void;
  currentLanguage: string;
  setCurrentLanguage: (l: string) => void;
  speak: (text: string) => Promise<void>;
  isSpeaking: boolean;
  stopSpeaking: () => void;
  startRecording: () => Promise<void>;
  isRecording: boolean;
  stopRecording: () => void;
  lastTranscript: string | null;
  clearTranscript: () => void;
  error: string | null;
}

/**
 * Voice (TTS + STT) state and actions.
 *
 * - Loads capabilities from `/api/voice/capabilities` on mount.
 * - TTS: synthesizes speech via the API and plays it back.
 * - STT: records with MediaRecorder, transcribes via the API.
 *
 * When the voice sidecar is unavailable, both `isTtsAvailable` and
 * `isSttAvailable` are `false` and the UI should hide the buttons.
 */
export function useVoice(): UseVoiceReturn {
  const [capabilities, setCapabilities] = useState<VoiceCapabilities | null>(null);
  const [currentVoice, setCurrentVoice] = useState('');
  const [currentLanguage, setCurrentLanguage] = useState('de');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);

  // Load capabilities on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API}/capabilities`);
        const payload = await res.json();
        if (!cancelled && payload?.data) {
          setCapabilities(payload.data);
          const defaultVoice =
            payload.data.defaultVoiceByLanguage?.['de'] ?? payload.data.voices?.[0]?.id ?? '';
          setCurrentVoice(defaultVoice);
        }
      } catch {
        // Sidecar unavailable → capabilities stays null (buttons hidden).
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const isTtsAvailable = capabilities?.tts ?? false;
  const isSttAvailable = capabilities?.stt ?? false;
  const voices = capabilities?.voices ?? [];
  const languages = capabilities?.languages ?? [];

  const stopSpeaking = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    setIsSpeaking(false);
  }, []);

  const speak = useCallback(
    async (text: string) => {
      setError(null);
      stopSpeaking();
      try {
        const res = await fetch(`${API}/tts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, voice: currentVoice }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error?.message ?? `TTS failed: ${res.status}`);
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        setIsSpeaking(true);
        audio.onended = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(url);
        };
        audio.onerror = () => {
          setIsSpeaking(false);
          setError('Audio playback error');
        };
        await audio.play();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'TTS failed');
      }
    },
    [currentVoice, stopSpeaking]
  );

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e: BlobEvent) => chunks.push(e.data);
      recorder.onstop = async () => {
        setIsRecording(false);
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        const base64 = await blobToBase64(blob);
        try {
          const res = await fetch(`${API}/stt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audio: base64, language: currentLanguage }),
          });
          const payload = await res.json();
          if (!res.ok || !payload?.data) {
            throw new Error(payload?.error?.message ?? `STT failed: ${res.status}`);
          }
          setLastTranscript(payload.data.text);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'STT failed');
        }
      };
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Microphone access denied');
    }
  }, [currentLanguage]);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
  }, []);

  const clearTranscript = useCallback(() => {
    setLastTranscript(null);
  }, []);

  return {
    capabilities,
    isTtsAvailable,
    isSttAvailable,
    voices,
    languages,
    currentVoice,
    setCurrentVoice,
    currentLanguage,
    setCurrentLanguage,
    speak,
    isSpeaking,
    stopSpeaking,
    startRecording,
    isRecording,
    stopRecording,
    lastTranscript,
    clearTranscript,
    error,
  };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
