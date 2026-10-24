import json
import os
from typing import Any, AsyncIterator
from uuid import UUID
import importlib.util

from starlette.concurrency import run_in_threadpool

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from agents_workflow.main import get_supervisor
from backend.tts_service.router import router as tts_router
from backend.stt_service.router import router as stt_router

from backend.rag_routers.documents import router as documents_router


LAYA_ROUTER_PATH = os.path.join(os.path.dirname(__file__), "laya", "laya_router.py")
_laya_spec = importlib.util.spec_from_file_location("project_laya_router", LAYA_ROUTER_PATH)
if _laya_spec is None or _laya_spec.loader is None:
    raise ImportError(f"Could not load Laya router from {LAYA_ROUTER_PATH}")
_laya_module = importlib.util.module_from_spec(_laya_spec)
_laya_spec.loader.exec_module(_laya_module)
route = _laya_module.route


app = FastAPI(
    title="Aether AI Assistant API",
    description="API for the multi-agent chatbot and document knowledge base",
    version="1.0.0",
)

# Convenient for local development. Restrict this to your frontend origin in production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:8000",
        "http://localhost:8000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tts_router)
app.include_router(stt_router)
app.include_router(documents_router)


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=20_000)
    thread_id: str = Field(default="local-demo", min_length=1, max_length=200)
    profile_name: str = Field(default="", max_length=40)
    knowledge_base_available: bool = False
    knowledge_base_user_id: UUID



async def _run_laya(message: str) -> dict[str, Any]:
    # Laya's router is synchronous, so do not block FastAPI's event loop.
    result = await run_in_threadpool(route, message)
    task = str(result["task"]).strip().lower()
    if task not in {"simple", "complex"}:
        raise ValueError(f"Unexpected task returned by Laya: {task}")
    return {
        "model": result["model"],
        "task": task,
        "confidence": result["confidence"],
    }


def sse_event(event: str, data: dict[str, Any]) -> str:
    """Encode one Server-Sent Event."""
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False, default=str)}\n\n"


def _content_to_text(content: Any) -> str:
    """Extract text from common LangChain message content formats."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text":
                parts.append(str(item.get("text", "")))
            elif isinstance(item, str):
                parts.append(item)
        return "".join(parts)
    return str(content) if content is not None else ""


@app.get("/")
async def root():
    """Report that the API is running; the React frontend runs separately."""
    return {"status": "ok", "message": "API is live and running."}


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/api/chat/stream")
async def chat_stream(request: ChatRequest):
    """Route with Laya, then stream supervisor/agent/tool events in one SSE response."""
    async def generate() -> AsyncIterator[str]:
        try:
            routing = await _run_laya(request.message)
        except Exception as exc:
            yield sse_event(
                "error",
                {
                    "message": f"Laya routing failed: {exc}",
                    "hint": "Check that the Laya package is installed and its Router initializes correctly.",
                },
            )
            return

        selected_model = routing["model"]
        selected_task = routing["task"]
        try:
            selected_supervisor = get_supervisor(
                selected_model,
                request.profile_name.strip(),
                request.knowledge_base_available,
                str(request.knowledge_base_user_id),
            )
        except Exception as exc:
            yield sse_event(
                "error",
                {
                    "message": f"Model initialization failed: {exc}",
                    "hint": "Check the selected provider's API key, model ID, and installed LangChain integration.",
                },
            )
            return

        config = {
            "configurable": {
                "thread_id": request.thread_id,
            }
        }
        inputs = {
            "messages": [
                {"role": "user", "content": request.message}
            ]
        }

        # Tool outputs are deliberately buffered and sent only after the graph
        # finishes. Status events (agent/tool names) can be shown immediately.
        buffered_tool_results: list[dict[str, Any]] = []
        seen_agent_starts: set[str] = set()
        final_text_parts: list[str] = []
        final_text_streamed = False
        last_graph_output: dict[str, Any] | None = None

        yield sse_event(
            "routing",
            {
                "model": selected_model,
                "task": selected_task,
                "confidence": routing["confidence"],
                "reason": (
                    "Classified as simple using Laya's task-complexity criteria."
                    if selected_task == "simple"
                    else "Classified as complex using Laya's task-complexity criteria."
                ),
            },
        )
        yield sse_event("status", {"message": "Supervisor is analyzing your request."})

        try:
            async for event in selected_supervisor.astream_events(
                inputs,
                config=config,
                version="v2",
            ):
                event_type = event.get("event", "")
                event_name = str(event.get("name", ""))
                metadata = event.get("metadata") or {}
                node_name = str(metadata.get("langgraph_node", ""))

                # Keep the most recent graph output as a fallback if this
                # LangGraph version does not tag supervisor token events as expected.
                if event_type == "on_chain_end":
                    event_output = (event.get("data") or {}).get("output")
                    if isinstance(event_output, dict) and isinstance(event_output.get("messages"), list):
                        last_graph_output = event_output

                # Report specialist agent starts in real time. The graph's
                # node metadata normally contains the node/agent name.
                if event_type == "on_chain_start":
                    possible_agent = node_name or event_name
                    known_agents = {
                        "web_search_agent",
                        "image_search_agent",
                        "news_agent",
                        "weather_agent",
                        "utility_agent",
                        "chat_agent",
                        "knowledge_base_agent",
                    }
                    if possible_agent in known_agents and possible_agent not in seen_agent_starts:
                        seen_agent_starts.add(possible_agent)
                        yield sse_event(
                            "agent",
                            {"name": possible_agent, "status": "working"},
                        )

                # Report tool use immediately, but do not stream tool outputs yet.
                if event_type == "on_tool_start":
                    tool_name = event_name or "unknown_tool"
                    yield sse_event(
                        "tool",
                        {"name": tool_name, "status": "running"},
                    )

                if event_type == "on_tool_end":
                    buffered_tool_results.append(
                        {
                            "name": event_name or "unknown_tool",
                            "output": str((event.get("data") or {}).get("output", "")),
                        }
                    )
                    yield sse_event(
                        "tool",
                        {"name": event_name or "unknown_tool", "status": "finished"},
                    )

                # Stream only the supervisor's model tokens, avoiding a mixture
                # of private/intermediate specialist-agent text and final text.
                if event_type == "on_chat_model_stream":
                    chunk = (event.get("data") or {}).get("chunk")
                    chunk_content = getattr(chunk, "content", None)
                    token_text = _content_to_text(chunk_content)
                    if token_text and node_name in {"supervisor", "supervisor_node"}:
                        final_text_streamed = True
                        final_text_parts.append(token_text)
                        yield sse_event("token", {"text": token_text})

            # Some versions/configurations may not tag supervisor token events
            # as expected. Recover the final answer from the output already
            # observed in the event stream (do not invoke the graph a second time).
            if not final_text_streamed and last_graph_output:
                messages = last_graph_output.get("messages", [])
                if messages:
                    answer = _content_to_text(getattr(messages[-1], "content", ""))
                    if answer:
                        final_text_parts = [answer]
                        yield sse_event("token", {"text": answer})

            # Tool outputs are revealed only after the answer has finished.
            for result in buffered_tool_results:
                yield sse_event("tool_result", result)

            yield sse_event(
                "done",
                {
                    "thread_id": request.thread_id,
                    "answer": "".join(final_text_parts),
                },
            )

        except Exception as exc:
            yield sse_event(
                "error",
                {
                    "message": str(exc),
                    "hint": "Check the selected model provider's API key/model, tool API keys, imports, and package versions.",
                },
            )

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
