import { useCallback, useEffect, useRef, useState } from 'react';
import { synthesizeSpeech } from '../services/speechService';
import { stripMarkdown } from '../utils/formatters';

export function useTextToSpeech({ voice, speed }) {
  const [state, setState] = useState({ loadingId: null, playingId: null, paused: false, error: '' });
  const audioRef = useRef(null);
  const urlRef = useRef(null);
  const abortRef = useRef(null);

  const release = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    release();
    setState((s) => ({ ...s, loadingId: null, playingId: null, paused: false }));
  }, [release]);

  const speak = useCallback(async (id, markdown) => {
    release(); // stop previous playback first
    const text = stripMarkdown(markdown);
    if (!text) {
      setState({ loadingId: null, playingId: null, paused: false, error: 'There is no text to read aloud.' });
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ loadingId: id, playingId: null, paused: false, error: '' });
    try {
      const blob = await synthesizeSpeech(text, { voice, speed, signal: controller.signal });
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => stop();
      audio.onerror = () => {
        if (audioRef.current !== audio) return;
        release();
        setState({ loadingId: null, playingId: null, paused: false, error: 'Audio playback failed. You can continue reading the response.' });
      };
      await audio.play();
      if (audioRef.current === audio) {
        setState({ loadingId: null, playingId: id, paused: false, error: '' });
      }
    } catch (err) {
      if (controller.signal.aborted || err?.kind === 'abort' || err?.name === 'AbortError') return;
      release();
      setState({ loadingId: null, playingId: null, paused: false, error: err?.message || 'Speech generation failed. You can continue reading the response.' });
    }
  }, [release, stop, voice, speed]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setState((s) => ({ ...s, paused: true }));
  }, []);

  const resume = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.play()
      .then(() => {
        if (audioRef.current === audio) setState((s) => ({ ...s, paused: false }));
      })
      .catch(() => {
        if (audioRef.current !== audio) return;
        release();
        setState({ loadingId: null, playingId: null, paused: false, error: 'Audio playback failed. You can continue reading the response.' });
      });
  }, [release]);

  useEffect(() => release, [release]);

  return { ...state, speak, pause, resume, stop, clearError: () => setState((s) => ({ ...s, error: '' })) };
}
