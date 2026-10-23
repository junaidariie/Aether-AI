import { Volume2, Loader2 } from 'lucide-react';

export default function AudioControls({ messageId, tts, onSpeak }) {
  const loading = tts.loadingId === messageId;
  const playing = tts.playingId === messageId;
  const active = loading || playing;

  return (
    <button
      className={`action-btn audio-toggle ${playing ? 'playing' : ''} ${loading ? 'loading' : ''}`}
      onClick={active ? tts.stop : onSpeak}
      aria-label={loading ? 'Stop audio generation' : playing ? 'Stop reading aloud' : 'Read aloud'}
      title={loading ? 'Stop audio generation' : playing ? 'Stop reading aloud' : 'Read aloud'}
      aria-pressed={playing}
    >
      {loading ? <Loader2 size={17} className="spin" /> : <Volume2 size={17} aria-hidden="true" />}
    </button>
  );
}
