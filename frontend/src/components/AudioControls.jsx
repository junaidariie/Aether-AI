import { Volume2, Square, Loader2 } from 'lucide-react';

export default function AudioControls({ messageId, tts, onSpeak }) {
  const loading = tts.loadingId === messageId;
  const playing = tts.playingId === messageId;
  const active = loading || playing;
  const label = loading
    ? 'Stop audio generation'
    : playing
      ? 'Stop reading aloud'
      : 'Read response aloud';

  return (
    <button
      className={`action-btn audio-toggle ${playing ? 'playing' : ''} ${loading ? 'loading' : ''}`}
      onClick={active ? tts.stop : onSpeak}
      aria-label={label}
      title={label}
      aria-pressed={playing}
      aria-busy={loading}
    >
      {loading
        ? <Loader2 size={17} className="spin" aria-hidden="true" />
        : playing
          ? (
            <>
              <Square size={14} fill="currentColor" aria-hidden="true" />
              <span className="audio-waveform" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></span>
            </>
          )
          : <Volume2 size={17} aria-hidden="true" />}
    </button>
  );
}
