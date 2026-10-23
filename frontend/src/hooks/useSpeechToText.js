import { useCallback, useEffect, useRef, useState } from 'react';
import { transcribeAudio } from '../services/speechService';

const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

export function useSpeechToText({ translation, onResult }) {
  const [status, setStatus] = useState('idle'); // idle | recording | transcribing
  const [error, setError] = useState('');
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const tickRef = useRef(null);
  const abortRef = useRef(null);
  const cancelledRef = useRef(false);
  const onResultRef = useRef(onResult);
  useEffect(() => { onResultRef.current = onResult; }, [onResult]);

  const supported = typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';

  const cleanup = useCallback(() => {
    clearInterval(tickRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
  }, []);

  const start = useCallback(async () => {
    setError('');
    if (!supported) {
      setError('Audio recording is not supported in this browser. You can still type your message.');
      return;
    }
    const mimeType = MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported?.(m));
    if (!mimeType) {
      setError('This browser cannot record in a supported audio format. You can still type your message.');
      return;
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      setError(
        err?.name === 'NotAllowedError' || err?.name === 'SecurityError'
          ? 'Microphone permission was denied. Allow microphone access in your browser settings to dictate.'
          : err?.name === 'NotFoundError'
            ? 'No microphone was found on this device.'
            : 'Could not access the microphone.'
      );
      return;
    }
    try {
      cancelledRef.current = false;
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      recorder.onerror = () => { setError('Recording failed. You can still type your message.'); cleanup(); setStatus('idle'); };
      recorder.onstop = async () => {
        const chunks = chunksRef.current;
        const type = recorder.mimeType || mimeType;
        cleanup();
        if (cancelledRef.current) { setStatus('idle'); return; }
        const blob = new Blob(chunks, { type });
        if (!blob.size) { setError('No audio was captured.'); setStatus('idle'); return; }
        setStatus('transcribing');
        const controller = new AbortController();
        abortRef.current = controller;
        try {
          const result = await transcribeAudio(blob, { translation, signal: controller.signal });
          if (!result.text) setError('No speech was recognized. Try again, or type your message.');
          else onResultRef.current?.(result.text, { translated: result.translated });
        } catch (err) {
          if (err?.kind !== 'abort') setError(`Voice transcription failed${err?.message ? `: ${err.message}` : '.'} You can still type your message.`);
        } finally {
          abortRef.current = null;
          setStatus('idle');
        }
      };
      recorder.start();
      setSeconds(0);
      tickRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      setStatus('recording');
    } catch {
      cleanup();
      setError('Recording failed. You can still type your message.');
      setStatus('idle');
    }
  }, [supported, translation, cleanup]);

  const stop = useCallback(() => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    abortRef.current?.abort();
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    else setStatus('idle');
  }, []);

  useEffect(() => () => { cancelledRef.current = true; abortRef.current?.abort(); cleanup(); }, [cleanup]);

  return { supported, status, error, seconds, start, stop, cancel, clearError: () => setError('') };
}
