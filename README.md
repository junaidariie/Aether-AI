<div align="center">
  <img src="frontend/src/assets/logo.svg" alt="Aether AI logo" width="76" height="76">
  <h1>Aether AI</h1>
  <p>Legal research and document assistance, powered by a multi-agent AI workflow.</p>
  <p><strong>Live application</strong><br>
    <a href="https://aether-ai-iota-sand.vercel.app/"><img src="https://img.shields.io/badge/OPEN%20THE%20LIVE%20APP-Aether%20AI-6C63FF?style=for-the-badge" alt="Open the live Aether AI app"></a>
  </p>
  <p><strong>Backend hosted on Hugging Face</strong><br>
    <a href="https://huggingface.co/spaces/junaid17/SynapseAI"><img src="https://img.shields.io/badge/VIEW%20THE%20BACKEND-Hugging%20Face%20Space-FFD21E?style=for-the-badge&logo=huggingface&logoColor=black" alt="View the Aether AI backend hosted on Hugging Face"></a>
  </p>
</div>

> **Important:** Aether AI is a research and document-assistance tool, not a lawyer and not a substitute for legal advice. Verify legal information against current primary sources and consult a qualified legal professional before acting on it.

## What it does

Aether AI helps users explore documents and research questions through a conversational interface. Lawyers, legal teams, and students can upload their own text-based PDFs—such as contracts, policies, or case materials—and ask questions grounded in the indexed documents. The assistant can also use web research tools for information that may have changed.

- **Ask questions about your PDFs:** retrieve relevant passages and source/page details, summarize material, and compare information across uploaded documents.
- **Research the web:** search for background, current information, and source pages using the available web-search tools.
- **Get routed answers:** a request-complexity router selects a model pool, then a supervisor delegates to a specialist agent or responds directly.
- **Use other assistant tools:** image discovery, news, weather, calculations, unit conversion, and date/time lookup.
- **Speak and listen:** transcribe microphone recordings and have responses read aloud.
- **Follow the work:** see routing, agent, and tool activity while the response streams.

### Legal-use limitations

The legal workflow comes from general-purpose models, web research, and the documents you provide—not from a dedicated legal model or a built-in legal research database. The application does not verify jurisdiction, establish that a law is current, guarantee legal citations, or provide professional legal judgment. Web search is not a substitute for checking official statutes, regulations, court opinions, and other authoritative primary sources. Review all extracted text and generated answers before relying on them.

PDF ingestion uses text extraction; scanned/image-only PDFs may not yield useful text. The app does not claim to perform a complete contract review, identify every legal risk, or provide OCR-based analysis.

## How it works

![Aether AI multi-agent workflow](./agent_workflow.png)

*Agent workflow graph: the supervisor routes work to specialist agents. The PDF knowledge-base agent is part of the current application and is described below.*

```text
React client
    │ POST /api/chat/stream (Server-Sent Events)
    ▼
FastAPI ── Laya complexity router ── selects a model
    │
    ▼
LangGraph supervisor ── direct response or specialist agent(s)
    ├── document questions ── PDF RAG ── Pinecone + BM25 + reranker
    ├── web research ── Tavily / DuckDuckGo / webpage fetch
    └── other requests ── news, image, weather, or utility tools
```

1. The React frontend sends the message and browser-profile knowledge-base ID to the FastAPI stream endpoint.
2. Laya classifies the request as **simple** or **complex**. A model is selected at random from the matching configured pool.
3. The LangGraph supervisor answers directly or delegates to one or more specialists. Document questions can be routed to the knowledge-base agent.
4. The backend streams routing, status, agent, tool, and answer-token events to the browser as Server-Sent Events.

### Specialist agents

| Agent | Role |
|---|---|
| `chat_agent` | General explanations, writing, and conversation |
| `knowledge_base_agent` | Answers grounded in the current browser profile's uploaded PDFs |
| `web_search_agent` | Web research, search, and fetching public webpages |
| `news_agent` | News searches and top headlines |
| `image_search_agent` | Image discovery and source details |
| `weather_agent` | Current conditions and forecasts |
| `utility_agent` | Arithmetic, unit conversion, and date/time |

The knowledge-base agent is designed to preserve document source names and page numbers and to distinguish missing evidence from retrieval failures. As with any generated response, check the cited source material directly.

## Models and routing

The configured models are general-purpose language models; none is represented as a lawyer, legal expert, or legally fine-tuned model. Laya chooses task complexity, then `select_model` chooses uniformly at random from that pool:

| Task pool | Groq | XKIRO (OpenAI-compatible API) | Google Gemini |
|---|---|---|---|
| Simple | `openai/gpt-oss-20b` | `qwen/qwen3.8-omni-flash:free` | `gemini-3.5-flash-lite` |
| Complex | `openai/gpt-oss-120b` | `mistralai/mistral-medium-3.5` | `gemini-3.8-flash` |

The selected provider must have its API key configured. Because selection is random within a pool, either configure all providers in each pool you use or edit `MODEL_POOLS` in [agents_workflow/models.py](./agents_workflow/models.py) to include only providers you have enabled. Model IDs and provider availability can change; check the providers' current documentation.

## PDF RAG pipeline

The knowledge base is intended for asking questions about user-supplied PDFs. Its retrieval process is:

1. Extract PDF pages and split text into chunks of 1,000 characters with 250-character overlap.
2. Store vectors in the Pinecone index named `bot`, using `BAAI/bge-base-en-v1.5` embeddings. Queries filter Pinecone results by the browser-profile owner ID.
3. Combine dense vector results with BM25 lexical results using reciprocal-rank fusion (up to 15 candidates).
4. Rerank candidates with `cross-encoder/ms-marco-MiniLM-L-12-v2` and return up to 7 passages, with document and page metadata.

The BM25 document cache is held in backend-process memory; dense vectors are stored in Pinecone. The current profile ID is generated and stored by the browser, not authenticated by a server-side identity system. It is therefore a convenience partition, **not a security boundary**.

## Technology

- **Frontend:** React 18, Vite, JavaScript, and CSS.
- **API:** Python 3.11+, FastAPI, and Uvicorn.
- **Agent orchestration:** Laya, LangChain, and LangGraph.
- **Model providers:** Groq, XKIRO, and Google Gemini.
- **Document processing and retrieval:** PyPDF, Hugging Face sentence-transformer embeddings and CrossEncoder reranking, BM25, and Pinecone.
- **Speech:** Faster-Whisper (`base`, CPU/int8 configuration) for speech-to-text and Edge TTS for read-aloud audio.
- **Deployment:** Docker backend on Hugging Face Spaces; static React frontend on Vercel.

## Project structure

```text
.
├── agents_workflow/       # Supervisor, specialist agents, tools, and model providers
├── backend/
│   ├── rag_routers/       # PDF knowledge-base API
│   ├── stt_service/       # Speech-to-text API
│   └── tts_service/       # Text-to-speech API
├── frontend/              # React + Vite application
├── laya/                  # Request-complexity routing
├── rag/                   # PDF ingestion and retrieval pipeline
├── agent_workflow.png     # Agent workflow diagram
├── app.py                 # FastAPI app and chat SSE endpoint
├── Dockerfile             # Hugging Face Docker Space image
└── requirements.txt       # Python dependencies
```

## Run locally

### Prerequisites

- Python 3.11 or newer.
- Node.js 18 or newer and npm.
- FFmpeg for audio decoding.
- API credentials for the model providers and services you want to use.
- Pinecone credentials to use PDF knowledge-base features.

### 1. Set up the backend

From the repository root:

```bash
python -m venv .venv
```

Activate the environment (`.venv\Scripts\Activate.ps1` in PowerShell, or `source .venv/bin/activate` on macOS/Linux), then install dependencies:

```bash
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

Create a root `.env` file with the credentials listed under [Configuration](#configuration). Keep it out of source control. Start the API:

```bash
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

The local API is at `http://127.0.0.1:8000`; interactive docs are at `http://127.0.0.1:8000/docs`.

### 2. Set up the frontend

In another terminal:

```bash
cd frontend
npm install
```

Copy `frontend/.env.example` to `frontend/.env` and set the backend base URL. For local development:

```text
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Run the development server:

```bash
npm run dev
```

Open `http://localhost:5173`. To build and preview a production bundle, run `npm run build` and `npm run preview` from `frontend/`.

## Configuration

Set backend values in a local root `.env` file or your hosting provider's secret manager. Never put API secrets in frontend `VITE_` variables or commit them.

| Variable | Used for | Required |
|---|---|---|
| `GROQ_API_KEY` | Groq model requests | When a Groq model is selected |
| `XKIRO_API_KEY` | XKIRO model requests | When an XKIRO model is selected |
| `GOOGLE_API_KEY` | Gemini model requests | When a Gemini model is selected |
| `PINECONE_API_KEY` | PDF vector storage and retrieval | For knowledge-base features |
| `TAVILY_API_KEY` | Tavily web search | Optional; DuckDuckGo search is also available |
| `UNSPLASH_ACCESS_KEY` | Unsplash image search | Optional |
| `NEWS_API_KEY` | News search and headlines | Optional |

The frontend's `VITE_API_BASE_URL` is a public backend URL, not a secret. The repository's production frontend configuration points to `https://junaid17-synapseai.hf.space`; local development can point it at `http://127.0.0.1:8000`. Set the same value in Vercel's project environment settings for the production deployment.

## API overview

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/` | API welcome/status response |
| `GET` | `/health` | Health check |
| `POST` | `/api/chat/stream` | Stream a routed chat response as SSE |
| `POST` | `/stt` | Transcribe uploaded audio; optional translation and language detection |
| `GET` | `/stt/supported_languages` | List supported speech-recognition language codes |
| `POST` | `/tts` | Generate read-aloud audio |
| `GET` | `/tts/available_voices` | List available voices |
| `GET` | `/tts/subtitles/{request_id}` | Retrieve generated speech subtitles |
| `GET` | `/api/knowledge-base/documents` | List PDFs for the supplied browser profile |
| `POST` | `/api/knowledge-base/upload` | Upload and index PDF documents |
| `GET` | `/api/knowledge-base/status` | Check knowledge-base status |
| `POST` | `/api/knowledge-base/search` | Test retrieval against indexed PDFs |
| `DELETE` | `/api/knowledge-base/documents/{document_id}` | Remove one PDF |
| `DELETE` | `/api/knowledge-base/documents` | Remove PDFs for the supplied browser profile |

Knowledge-base endpoints require the `X-Knowledge-Base-User` header. The upload endpoint accepts PDFs up to 20 MB each. Full request and response schemas are available at `/docs`.

## Deployment

### Backend: Hugging Face Spaces

The root Dockerfile configures the backend container to listen on port `7860`. The live backend is [junaid17/SynapseAI](https://huggingface.co/spaces/junaid17/SynapseAI).

1. Create or open a Docker Space and push this repository.
2. Add the required model-provider keys in the Space's **Settings → Variables and secrets**. Add `PINECONE_API_KEY` for PDF retrieval.
3. Wait for the image to build, then check `/health` and `/docs` on the Space domain.
4. Set the production frontend origin in the CORS allowlist in `app.py` before allowing browser requests from Vercel.

### Frontend: Vercel

The live frontend is [aether-ai-iota-sand.vercel.app](https://aether-ai-iota-sand.vercel.app/). Set `VITE_API_BASE_URL` to `https://junaid17-synapseai.hf.space` in Vercel's project environment settings and redeploy after changes. Vite embeds `VITE_` values in the public client bundle, so only use public configuration values there.

**Production CORS:** `app.py` currently lists local development origins. Add `https://aether-ai-iota-sand.vercel.app` (and any other intended frontend origins) to the backend allowlist before expecting the browser app to call the API successfully. Avoid a permissive wildcard for a public deployment.

## Privacy and limitations

- **No authentication:** browser-profile IDs are client-provided and can be impersonated. Do not use the current deployment for confidential legal documents or other sensitive information.
- **External providers:** model prompts, web searches, and uploaded-document retrieval may involve the configured model, search, embedding, reranking, and vector-storage services. Review their policies before sending sensitive or privileged material.
- **Chat memory:** conversation state is held in an in-memory LangGraph checkpointer and is lost when the backend restarts. Chat history shown in the UI is stored locally in the browser; there is no durable server-side account history.
- **PDF persistence and retrieval:** vectors are stored in Pinecone, while BM25 indexing is in process memory. A backend restart clears the BM25 cache; vectors remain in Pinecone.
- **PDF scope:** uploads must be PDFs and are limited to 20 MB each. Text extraction may not work well for scanned/image-only documents.
- **Legal accuracy:** no legal database, jurisdiction-specific verification, or guarantee of current law or citation accuracy is built in. Verify answers with official sources and qualified counsel.
- **Hosting resources:** embedding, reranking, and speech models may require time and memory to download and initialize.
