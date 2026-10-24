import os
import random
from dataclasses import dataclass
from typing import Literal

from langchain_core.language_models import BaseChatModel
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_groq import ChatGroq
from langchain_openai import ChatOpenAI


Provider = Literal["groq", "xkiro", "gemini"]


@dataclass(frozen=True)
class ModelOption:
    provider: Provider
    model: str

    @property
    def model_id(self) -> str:
        return f"{self.provider}:{self.model}"


MODEL_POOLS: dict[str, tuple[ModelOption, ...]] = {
    "simple": (
        ModelOption("groq", "openai/gpt-oss-20b"),
        ModelOption("xkiro", "qwen/qwen3.8-omni-flash:free"),
        ModelOption("gemini", "gemini-3.5-flash-lite"),
    ),
    "complex": (
        ModelOption("groq", "openai/gpt-oss-120b"),
        ModelOption("xkiro", "mistralai/mistral-medium-3.5"),
        ModelOption("gemini", "gemini-3.8-flash"),
    ),
}

_MODELS_BY_ID = {
    option.model_id: option
    for pool in MODEL_POOLS.values()
    for option in pool
}


def select_model(task: str) -> ModelOption:
    """Choose one provider/model uniformly from the pool for this task."""
    try:
        pool = MODEL_POOLS[task]
    except KeyError as exc:
        raise ValueError(f"Unsupported task complexity: {task!r}") from exc
    return random.choice(pool)


def _required_api_key(variable_name: str) -> str:
    api_key = os.getenv(variable_name)
    if not api_key:
        raise RuntimeError(
            f"{variable_name} is required for the selected model. "
            "Add it to the backend environment."
        )
    return api_key


def create_chat_model(model_id: str, temperature: float = 0.0) -> BaseChatModel:
    """Create a LangChain chat model from a provider-qualified ID."""
    option = _MODELS_BY_ID.get(model_id)
    if option is None and ":" not in model_id:
        # Keep compatibility with existing callers that pass a Groq model name.
        option = ModelOption("groq", model_id)
    if option is None:
        raise ValueError(f"Unknown provider/model ID: {model_id!r}")

    if option.provider == "groq":
        return ChatGroq(
            model=option.model,
            api_key=_required_api_key("GROQ_API_KEY"),
            temperature=temperature,
        )
    if option.provider == "xkiro":
        return ChatOpenAI(
            model=option.model,
            api_key=_required_api_key("XKIRO_API_KEY"),
            base_url="https://api.xkiro.com/v1",
            temperature=temperature,
        )
    return ChatGoogleGenerativeAI(
        model=option.model,
        api_key=_required_api_key("GOOGLE_API_KEY"),
        temperature=temperature,
    )
