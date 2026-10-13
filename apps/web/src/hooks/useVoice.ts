import { useCallback, useEffect, useRef, useState } from 'react';
import type { Voice, VoiceCapabilities } from 'shared';

const API = '/api/voice';
const SILENCE_TIMEOUT_MS = 800;
const NOISE_FLOOR_SAMPLES = 50; // 50 × 10ms = 500ms calibration
const RMS_THRESHOLD_FACTOR = 3;
const MIN_RMS_THRESHOLD = 0.01;
const SPEECH_DEBOUNCE_FRAMES = 10; // 10 × 10ms = 100ms continuous speech required
const MIN_SPEECH_DURATION_MS = 300; // discard recordings shorter than this
const COOLDOWN_MS = 500; // pause VAD after STT to prevent immediate re-trigger
const MAX_RECORDING_MS = 15000; // hard cap: STT rejects >30s audio

type InteractiveState = 'off' | 'listening' | 'recording' | 'processing' | 'paused';

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
  const isSpeakingRef = useRef(false);
  // Timestamp when TTS finished – loop stays blocked until this + margin,
  // giving the speaker time to flush its output buffer before the mic
  // could pick up residual TTS audio.
  const ttsEndAtRef = useRef(0);

  // Interactive mode refs
  const interactiveStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const loopRef = useRef<number | null>(null);

  // Sync interactive state: auto-pause during TTS, resume after.
  // NOTE: isSpeakingRef is managed directly in speak()/stopSpeaking()/onended
  // to avoid the async gap where React state hasn't propagated yet.
  useEffect(() => {
    if (isSpeaking && interactiveStateRef.current === 'listening') {
      setInteractiveState('paused');
    } else if (!isSpeaking && interactiveStateRef.current === 'paused') {
      setInteractiveState('listening');
    }
  }, [isSpeaking, setInteractiveState]);

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
    isSpeakingRef.current = false;
    audioRef.current?.pause();
    audioRef.current = null;
    setIsSpeaking(false);
  }, []);

  const speak = useCallback(
    async (text: string) => {
      console.log('[voice] speak() called:', JSON.stringify(text));
      console.trace('[voice] speak() stack:');

      // Block the detection loop IMMEDIATELY – before the TTS fetch starts.
      // During the fetch window (~500ms) the loop would otherwise still run
      // and could pick up residual audio or echo as "speech".
      isSpeakingRef.current = true;

      // Pause any previously playing audio (without resetting the ref –
      // we just set it to true and must NOT let stopSpeaking() clear it).
      audioRef.current?.pause();
      audioRef.current = null;
      setError(null);
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
          isSpeakingRef.current = false;
          ttsEndAtRef.current = performance.now();
          setIsSpeaking(false);
          URL.revokeObjectURL(url);
        };
        audio.onerror = () => {
          isSpeakingRef.current = false;
          ttsEndAtRef.current = performance.now();
          setIsSpeaking(false);
          setError('Audio playback error');
        };
        await audio.play();
      } catch (err) {
        isSpeakingRef.current = false;
        setError(err instanceof Error ? err.message : 'TTS failed');
      }
    },
    [currentVoice]
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
      analyser.smoothingTimeConstant = 0; // no smoothing – raw signal for VAD
      source.connect(analyser);
      analyserRef.current = analyser;

      setInteractiveState('listening');

      // Mutable loop state
      let speechActive = false;
      let silenceStart = 0;
      let speechFrameCount = 0; // debounce: consecutive speech frames
      let recordingStart = 0; // when current recording started
      let cooldownUntil = 0; // VAD paused until this timestamp
      const noiseSamples: number[] = [];
      let threshold = MIN_RMS_THRESHOLD;
      let recorder: MediaRecorder | null = null;
      let chunks: Blob[] = [];
      let processing = false;

      /* v8 ignore start */ // Audio processing requires real browser environment
      function resetLoopState() {
        speechActive = false;
        silenceStart = 0;
        speechFrameCount = 0;
        recordingStart = 0;
        recorder = null;
        chunks = [];
        processing = false;
        // NOTE: noiseSamples and threshold are intentionally NOT reset here.
        // The noise floor is calibrated once at start (500ms) and then
        // continuously adapted. Recalibrating after every recording caused
        // a 300-500ms window where the threshold was at its minimum,
        // allowing noise bursts to trigger false recordings.
      }

      async function transcribeAudio() {
        const mime = recorder?.mimeType || 'audio/webm';
        const audioChunks = [...chunks];
        const blob = new Blob(audioChunks, { type: mime });
        const base64 = await blobToBase64(blob);
        const res = await fetch(`${API}/stt`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audio: base64, language: currentLanguage }),
        });
        const payload = await res.json();
        if (!res.ok || !payload?.data) {
          throw new Error(payload?.error?.message ?? `STT failed: ${res.status}`);
        }
        const text = payload.data.text ?? '';
        console.log(
          '[voice] STT transcript:',
          JSON.stringify(text),
          '(len:',
          text.trim().length + ')'
        );
        setLastTranscript(text);
      }

      async function handleSilence() {
        if (!recorder || recorder.state === 'inactive') return;
        processing = true;
        setInteractiveState('processing');

        await new Promise<void>((resolve) => {
          recorder!.onstop = () => resolve();
          recorder!.stop();
        });

        const duration = performance.now() - recordingStart;
        console.log('[voice] silence → STT, duration:', Math.round(duration), 'ms');

        if (duration < MIN_SPEECH_DURATION_MS) {
          console.log('[voice] discarded: too short', duration, 'ms');
          resetLoopState();
          cooldownUntil = performance.now() + COOLDOWN_MS;
          setInteractiveState('listening');
          return;
        }

        try {
          await transcribeAudio();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'STT failed');
        }

        resetLoopState();
        cooldownUntil = performance.now() + COOLDOWN_MS;
        setInteractiveState('listening');
      }

      function beginRecording() {
        speechActive = true;
        silenceStart = 0;
        recordingStart = performance.now();
        recorder = new MediaRecorder(stream);
        chunks = [];
        recorder!.ondataavailable = (e: BlobEvent) => {
          if (e.data.size > 0) chunks.push(e.data);
        };
        recorder!.start(100);
        setInteractiveState('recording');
        console.log('[voice] speech detected → recording');
      }

      function checkSilence(isSpeech: boolean) {
        if (isSpeech) {
          silenceStart = 0;
        } else if (silenceStart === 0) {
          silenceStart = performance.now();
        } else if (performance.now() - silenceStart > SILENCE_TIMEOUT_MS) {
          void handleSilence();
        }
      }

      function updateNoiseFloor(rms: number) {
        if (speechActive || noiseSamples.length >= NOISE_FLOOR_SAMPLES) return;
        noiseSamples.push(rms);
        if (noiseSamples.length === NOISE_FLOOR_SAMPLES) {
          const sorted = [...noiseSamples].sort((a, b) => a - b);
          const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
          threshold = Math.max(MIN_RMS_THRESHOLD, median * RMS_THRESHOLD_FACTOR);
          console.log('[voice] calibrated:', threshold.toFixed(4), '(500ms noise floor)');
        }
      }

      function handleSpeechDetection(isSpeech: boolean) {
        // Skip detection entirely during initial calibration (first 500ms).
        // During this period the threshold is at its minimum (0.01), so
        // any ambient noise would register as "speech" and trigger a recording.
        if (noiseSamples.length < NOISE_FLOOR_SAMPLES) return;

        if (!speechActive && !processing) {
          if (isSpeech) {
            speechFrameCount++;
          } else {
            speechFrameCount = 0;
          }
          if (speechFrameCount >= SPEECH_DEBOUNCE_FRAMES) {
            speechFrameCount = 0;
            beginRecording();
          }
          return;
        }

        if (speechActive && !processing) {
          if (performance.now() - recordingStart > MAX_RECORDING_MS) {
            console.log('[voice] max duration reached, forcing STT');
            void handleSilence();
            return;
          }
          checkSilence(isSpeech);
        }
      }

      function loop() {
        if (interactiveStateRef.current === 'off') return;
        if (isSpeakingRef.current) return;
        // Post-TTS guard: block detection for 500ms after audio ends,
        // giving the speaker time to flush its output buffer.
        if (performance.now() - ttsEndAtRef.current < 500) return;
        const a = analyserRef.current;
        if (!a) return;
        if (performance.now() < cooldownUntil) return;

        const buffer = new Uint8Array(a.fftSize);
        a.getByteTimeDomainData(buffer);
        const rms = computeRms(buffer);

        updateNoiseFloor(rms);
        handleSpeechDetection(rms > threshold);
      }

      loopRef.current = setInterval(loop, 10);
      /* v8 ignore end */
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Microphone access denied');
    }
  }, [currentLanguage, setInteractiveState]);

  const stopInteractiveMode = useCallback(() => {
    if (loopRef.current !== null) {
      clearInterval(loopRef.current);
      loopRef.current = null;
    }
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
      if (loopRef.current !== null) {
        clearInterval(loopRef.current);
        loopRef.current = null;
      }
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
