import { useEffect, useRef, useState } from 'react';
import { Cpu, Menu, MessageSquarePlus, Shuffle } from 'lucide-react';

const MODEL_GROUPS = [
  {
    title: 'Simple requests',
    description: 'Quick questions and straightforward tasks',
    models: [
      ['Groq', 'openai/gpt-oss-20b'],
      ['XKIRO', 'qwen/qwen3.8-omni-flash:free'],
      ['Gemini', 'gemini-3.5-flash-lite'],
    ],
  },
  {
    title: 'Complex requests',
    description: 'Multi-step reasoning and demanding tasks',
    models: [
      ['Groq', 'openai/gpt-oss-120b'],
      ['XKIRO', 'mistralai/mistral-medium-3.5'],
      ['Gemini', 'gemini-3.8-flash'],
    ],
  },
];

export default function ChatHeader({ title, onOpenSidebar, onNewChat }) {
  const [modelsOpen, setModelsOpen] = useState(false);
  const modelInfoRef = useRef(null);

  useEffect(() => {
    if (!modelsOpen) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!modelInfoRef.current?.contains(event.target)) setModelsOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setModelsOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [modelsOpen]);

  return (
    <header className="chat-header">
      <div className="chat-header-left">
        <button className="icon-btn header-sidebar-toggle" onClick={onOpenSidebar} aria-label="Toggle sidebar"><Menu size={22} /></button>
        <h1 className="chat-title">{title || 'Aether AI'}</h1>
      </div>
      <div className="model-info" ref={modelInfoRef}>
        <button
          type="button"
          className="model-info-trigger"
          aria-expanded={modelsOpen}
          aria-controls="model-info-panel"
          onClick={() => setModelsOpen((open) => !open)}
        >
          <Cpu size={16} aria-hidden="true" />
          <span>Models</span>
        </button>
        {modelsOpen && (
          <section className="model-info-panel" id="model-info-panel" aria-label="Available models">
            <div className="model-info-heading">
              <div>
                <h2>Available models</h2>
                <p>Models are selected automatically for each request.</p>
              </div>
              <Shuffle size={17} aria-hidden="true" />
            </div>
            <div className="model-info-groups">
              {MODEL_GROUPS.map((group) => (
                <section className="model-info-group" key={group.title}>
                  <h3>{group.title}</h3>
                  <p>{group.description}</p>
                  <ul>
                    {group.models.map(([provider, name]) => (
                      <li key={name}>
                        <span>{provider}</span>
                        <code>{name}</code>
                      </li>
                    ))}
                  </ul>
                  <p className="model-random-note">
                    A model is chosen randomly from this group when a request is classified here.
                  </p>
                </section>
              ))}
            </div>
            <p className="model-info-footer">You can view the model used for a response in its progress details; models cannot be selected manually.</p>
          </section>
        )}
      </div>
      <button className="header-new-chat" onClick={onNewChat}>
        <MessageSquarePlus size={17} aria-hidden="true" />
        <span>New chat</span>
      </button>
    </header>
  );
}
