import { useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { parseToolOutput, looksLikeToolFailure } from '../utils/parseToolResults';

function ImageCard({ item }) {
  const [broken, setBroken] = useState(false);
  if (broken) return null;
  const inner = (
    <>
      <img src={item.image} alt={item.title} loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
      <figcaption>
        <span className="img-title">{item.title}</span>
        {item.attribution && <span className="muted small">{item.attribution}</span>}
        {item.domain && <span className="muted small">{item.domain}</span>}
      </figcaption>
    </>
  );
  return (
    <figure className="img-card">
      {item.page ? <a href={item.page} target="_blank" rel="noopener noreferrer" aria-label={`Open source page for ${item.title}`}>{inner}</a> : inner}
    </figure>
  );
}

export default function SourceCards({ timeline }) {
  const { sources, images } = useMemo(() => {
    const src = [];
    const img = [];
    const seen = new Set();
    for (const t of timeline) {
      if (t.kind !== 'tool' || t.output == null || looksLikeToolFailure(t.output)) continue;
      for (const item of parseToolOutput(t.name, t.output).items) {
        const key = item.image || item.url;
        if (seen.has(key)) continue;
        seen.add(key);
        (item.kind === 'image' ? img : src).push(item);
      }
    }
    return { sources: src.slice(0, 12), images: img.slice(0, 12) };
  }, [timeline]);

  if (!sources.length && !images.length) return null;
  return (
    <div className="sources">
      {images.length > 0 && (
        <>
          <h3 className="section-label">Images from tool results</h3>
          <div className="img-grid">{images.map((it) => <ImageCard key={it.image} item={it} />)}</div>
          <p className="muted small">Check the license and attribution requirements before reusing an image.</p>
        </>
      )}
      {sources.length > 0 && (
        <>
          <h3 className="section-label">Sources returned by tools</h3>
          <div className="source-grid">
            {sources.map((s) => (
              <a key={s.url} className="source-card" href={s.url} target="_blank" rel="noopener noreferrer">
                <span className="source-domain">{s.domain}<ExternalLink size={12} aria-hidden="true" /></span>
                <span className="source-title">{s.title}</span>
                {(s.publisher || s.published) && <span className="muted small">{[s.publisher, s.published].filter(Boolean).join(' · ')}</span>}
                {s.description && <span className="source-desc">{s.description}</span>}
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
