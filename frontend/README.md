# Aether AI — React frontend

A Gemini-inspired chat interface for the FastAPI multi-agent backend (Laya routing → supervisor → specialist agents → tools), including PDF knowledge-base management.

## 1. Prerequisites
- Node.js 18+ and npm
- The FastAPI backend running on `http://127.0.0.1:8000`

## 2. Install
```bash
cd frontend
npm install
```

## 3. Environment
```bash
cp .env.example .env
```
`VITE_API_BASE_URL` (default `http://127.0.0.1:8000`) is read once in `src/services/api.js`; every request uses it.
The backend's CORS list only allows `http://localhost:5173` and `http://127.0.0.1:5173`, so the dev server is pinned to port 5173 (`strictPort`). If you change the port or host, add the new origin to the backend's CORS list yourself.

## 4. Start the frontend
```bash
npm run dev        # http://localhost:5173
```

## 5. Start the backend (separate terminal, from the backend project root)
```bash
uvicorn app:app --reload      # http://127.0.0.1:8000
```

## 6. How the frontend talks to the API
| Purpose | Request |
|---|---|
| Health | `GET /health` (polled every 30 s) |
| Chat | `POST /api/chat/stream` `{message, thread_id, profile_name, knowledge_base_available, knowledge_base_user_id}` → SSE |
| Speech-to-text | `POST /stt` multipart, file field **`file_path`**, query `translation`, `language_detection` → `{segments: [...], detected_language?, translated?}` |
| Text-to-speech | `POST /tts` `{text, voice, rate: "+25%", volume: "+0%"}` → `audio/mpeg` |
| Voices | `GET /tts/available_voices` → `{Voices: [{Voice, Gender}]}` |
| Knowledge-base documents | `GET /api/knowledge-base/documents` with `X-Knowledge-Base-User` → this browser profile's indexed PDFs |
| Upload PDFs | `POST /api/knowledge-base/upload` with `X-Knowledge-Base-User`, multipart field **`files`** (PDFs up to 20 MB each), with browser upload progress |
| Remove one PDF | `DELETE /api/knowledge-base/documents/{document_id}` with `X-Knowledge-Base-User` |

These contracts come from `app.py`, `stt_service/router.py`, `tts_service/router.py`, and `backend/rag_routers/documents.py`.

## 7. How SSE streaming works
`EventSource` cannot send a POST body, so `src/services/chatService.js` uses `fetch()` and reads `response.body` with a `ReadableStream` reader. `src/utils/parseSSE.js` buffers decoded text (UTF-8 safe), splits on blank lines, joins multi-line `data:` fields, and parses JSON per event. Parsing errors never crash the chat. An `AbortController` cancels the request (Stop button, switching conversations).

Events handled: `routing`, `status`, `agent`, `tool`, `token`, `tool_result`, `done`, `error`. The reducer (`applyEvent` in `src/hooks/useChat.js`) updates only the assistant message that owns the stream, so events can never attach to another conversation. If the stream closes without `done`/`error`, the message is marked as an error and the partial text is kept. The frontend never re-invokes the model to recover a stream.

## 8. STT and TTS
- **Mic button** records with `MediaRecorder` (WebM/Opus where available, otherwise MP4/Ogg), uploads to `/stt`, and appends the transcript to the composer so you can edit it before sending. "Translate to English" is an optional toggle in Settings → Speech-to-text (off by default); only translations from non-English speech are labeled.
- **Read aloud** posts the answer (Markdown stripped, code blocks omitted) to `/tts` and plays the returned MP3 via `HTMLAudioElement`. Object URLs are revoked on stop/finish. The voice list is fetched from the backend when Settings is first opened; speed maps to edge-tts `rate`.
- Settings → Technical shows whether each service responds.

## 9. Known limitations
- **No authentication.** Knowledge-base documents are partitioned by a random ID stored in local storage for each browser profile. This prevents accidental cross-profile listing, retrieval, and deletion, but is not an authentication boundary: users who can modify requests can impersonate another profile. Add authenticated server-side identities before treating uploaded documents as private in a multi-user deployment.
- **Knowledge-base listing is on demand.** Opening the plus menu does not fetch document data. Clicking Add PDFs (or Refresh) loads the current browser profile's library; uploaded files are indexed under that profile ID.
- **History is local.** The backend has no history endpoint and keeps state in memory (`MemorySaver`). After a backend restart your saved chats still appear, but the assistant no longer remembers them.
- **Tool outputs arrive after the answer.** The backend buffers `tool_result` events until the graph finishes, so tool cards show "Running/Completed" live and their output appears at the end.
- **Agent "Completed" is inferred.** The backend only emits agent `working` events (once per agent); agents are shown as completed when `done` arrives and as failed on `error`. Tool events do not say which agent called them, so tools are listed in arrival order rather than nested under agents.
- **Regenerate** re-sends the previous user message on the same `thread_id`; the backend will have both attempts in its memory.
- Feedback (👍/👎) is stored locally only.
- Voice input relies on the browser's `MediaRecorder` and microphone permission (HTTPS or localhost).
- The STT endpoint saves uploads with a `.wav` suffix; faster-whisper detects the real container, but verify WebM/MP4 uploads work on your server (ffmpeg available).

## 10. Production build
```bash
npm run build      # outputs dist/
npm run preview    # serves dist/ on http://localhost:4173
```
Serve `dist/` from any static host and add that origin to the backend's CORS list.
