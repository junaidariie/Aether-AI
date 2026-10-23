import { Volume2, Square, Pause, Play, Loader2 } from 'lucide-react';

export default function AudioControls({ messageId, tts, onSpeak }) {
  const loading = tts.loadingId === messageId;
  const playing = tts.playingId === messageId;

  if (loading) {
    return <button className="action-btn" aria-label="Generating audio" disabled><Loader2 size={16} className="spin" /></button>;
  }
  if (playing) {
    return (
      <>
        {tts.paused
          ? <button className="action-btn" onClick={tts.resume} aria-label="Resume playback"><Play size={16} /></button>
          : <button className="action-btn" onClick={tts.pause} aria-label="Pause playback"><Pause size={16} /></button>}
        <button className="action-btn active" onClick={tts.stop} aria-label="Stop playback"><Square size={16} /></button>
      </>
    );
  }
  return <button className="action-btn" onClick={onSpeak} aria-label="Read aloud" title="Read aloud"><Volume2 size={16} /></button>;
}
