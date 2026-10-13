import { useCallback, useEffect, useRef, useState } from 'react';
import type { Voice, VoiceCapabilities } from 'shared';

const API = '/api/voice';
const SILENCE_TIMEOUT_MS = 5000;
const NOISE_FLOOR_SAMPLES = 30;
const RMS_THRESHOLD_FACTOR = 3;
const MIN_RMS_THRESHOLD = 0.01;

type InteractiveState = 'off' | 'listening' | 'recording' | 'processing';

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
  /** Interactive (hands-free) mode. */
  interactiveState: InteractiveState;
  toggleInteractiveMode: () => void;
  stopInteractiveMode: () => void;
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
  const [interactiveState, setInteractiveStateRaw] = useState<InteractiveState>('off');

  const setInteractiveState = useCallback((s: InteractiveState) => {
    interactiveStateRef.current = s;
    setInteractiveStateRaw(s);
  }, []);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const interactiveStateRef = useRef<InteractiveState>('off');

  // Interactive mode refs
  const interactiveStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number>(0);

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

  // ─── Interactive (hands-free) mode ────────────────────────────────────────

  /* v8 ignore start */ // Audio processing requires real browser environment
  /** Compute RMS from a time-domain buffer. */
  function computeRms(buffer: Uint8Array): number {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      const v = ((buffer[i] ?? 128) - 128) / 128;
      sum += v * v;
    }
    return Math.sqrt(sum / buffer.length);
  }
  /* v8 ignore end */

  const startInteractiveMode = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      interactiveStreamRef.current = stream;

      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;

      setInteractiveState('listening');

      // Mutable loop state
      let speechActive = false;
      let silenceStart = 0;
      const noiseSamples: number[] = [];
      let threshold = MIN_RMS_THRESHOLD;
      let recorder: MediaRecorder | null = null;
      let chunks: Blob[] = [];
      let processing = false;

      /* v8 ignore start */ // Audio processing requires real browser environment
      async function handleSilence() {
        if (!recorder || recorder.state === 'inactive') return;
        processing = true;
        setInteractiveState('processing');

        const mime = recorder.mimeType || 'audio/webm';
        const audioChunks = [...chunks];

        await new Promise<void>((resolve) => {
          recorder!.onstop = () => resolve();
          recorder!.stop();
        });

        const blob = new Blob(audioChunks, { type: mime });
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

        // Reset for next utterance
        speechActive = false;
        silenceStart = 0;
        noiseSamples.length = 0;
        threshold = MIN_RMS_THRESHOLD;
        recorder = null;
        chunks = [];
        processing = false;
        setInteractiveState('listening');
      }

      function loop() {
        if (interactiveStateRef.current === 'off') return;
        const a = analyserRef.current;
        if (!a) return;

        const buffer = new Uint8Array(a.fftSize);
        a.getByteTimeDomainData(buffer);
        const rms = computeRms(buffer);

        // Adaptive noise floor using median (robust to outliers)
        if (!speechActive && noiseSamples.length < NOISE_FLOOR_SAMPLES) {
          noiseSamples.push(rms);
          if (noiseSamples.length === NOISE_FLOOR_SAMPLES) {
            const sorted = [...noiseSamples].sort((a, b) => a - b);
            const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
            threshold = Math.max(MIN_RMS_THRESHOLD, median * RMS_THRESHOLD_FACTOR);
          }
        }

        const isSpeech = rms > threshold;

        if (isSpeech && !speechActive && !processing) {
          // Speech started → begin recording
          speechActive = true;
          silenceStart = 0;
          recorder = new MediaRecorder(stream);
          chunks = [];
          recorder!.ondataavailable = (e: BlobEvent) => {
            if (e.data.size > 0) chunks.push(e.data);
          };
          recorder!.start(100);
          setInteractiveState('recording');
        }

        if (speechActive && !processing) {
          if (isSpeech) {
            silenceStart = 0;
          } else if (silenceStart === 0) {
            silenceStart = performance.now();
          } else if (performance.now() - silenceStart > SILENCE_TIMEOUT_MS) {
            void handleSilence();
          }
        }

        rafRef.current = requestAnimationFrame(loop);
      }

      rafRef.current = requestAnimationFrame(loop);
      /* v8 ignore end */
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Microphone access denied');
    }
  }, [currentLanguage]);

  const stopInteractiveMode = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (interactiveStreamRef.current) {
      interactiveStreamRef.current.getTracks().forEach((t) => t.stop());
      interactiveStreamRef.current = null;
    }
    if (audioCtxRef.current) {
      void audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    setInteractiveState('off');
  }, [setInteractiveState]);

  const toggleInteractiveMode = useCallback(() => {
    if (interactiveState === 'off') {
      void startInteractiveMode();
    } else {
      stopInteractiveMode();
    }
  }, [interactiveState, startInteractiveMode, stopInteractiveMode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (interactiveStreamRef.current) {
        interactiveStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioCtxRef.current) {
        void audioCtxRef.current.close();
      }
    };
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
    interactiveState,
    toggleInteractiveMode,
    stopInteractiveMode,
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
