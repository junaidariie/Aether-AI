import ast
import os
from datetime import datetime
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup
from ddgs import DDGS
from dotenv import load_dotenv
from langchain_core.tools import tool
from tavily import TavilyClient

from functools import lru_cache
from rag.rag_pipeline import RagPipeline


load_dotenv()

TIMEOUT = 15
HEADERS = {"User-Agent": "AgenticChatbot/1.0"}


# ==================== WEB SEARCH ====================

@tool
def web_search_tavily(query: str, max_results: int = 5) -> str:
    """Search the web using Tavily. Requires TAVILY_API_KEY."""
    key = os.getenv("TAVILY_API_KEY")
    if not key:
        return "Add TAVILY_API_KEY to your .env file."

    try:
        data = TavilyClient(api_key=key).search(
            query=query, max_results=max(1, min(max_results, 10)),
            search_depth="basic", include_answer=True
        )
        results = [data["answer"]] if data.get("answer") else []
        results += [
            f"- {r.get('title', 'Untitled')}\nURL: {r.get('url', '')}\n{r.get('content', '')}"
            for r in data.get("results", [])
        ]
        return "\n\n".join(results) or "No results found."
    except Exception as e:
        return f"Web search failed: {e}"


@tool
def web_search_free(query: str, max_results: int = 5) -> str:
    """Search the web using DuckDuckGo. No API key required."""
    try:
        results = DDGS().text(query, max_results=max(1, min(max_results, 10)))
        return "\n".join(
            f"- {r.get('title', 'Untitled')}\nURL: {r.get('href', '')}\n{r.get('body', '')}"
            for r in results
        ) or "No results found."
    except Exception as e:
        return f"Web search failed: {e}"


@tool
def wikipedia_search(query: str, max_results: int = 5) -> str:
    """Search Wikipedia pages using DuckDuckGo."""
    try:
        results = DDGS().text(
            f"site:wikipedia.org {query}",
            max_results=max(1, min(max_results, 10))
        )
        return "\n".join(
            f"- {r.get('title', 'Untitled')}\nURL: {r.get('href', '')}\n{r.get('body', '')}"
            for r in results
        ) or "No Wikipedia results found."
    except Exception as e:
        return f"Wikipedia search failed: {e}"


@tool
def fetch_webpage(url: str, max_chars: int = 8000) -> str:
    """Get readable text from a public webpage."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc or parsed.username:
        return "Provide a valid public HTTP/HTTPS URL."

    try:
        response = requests.get(url, timeout=TIMEOUT, headers=HEADERS)
        response.raise_for_status()
        if "text/html" not in response.headers.get("Content-Type", "").lower():
            return "The URL did not return an HTML page."

        soup = BeautifulSoup(response.text, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header", "noscript"]):
            tag.decompose()
        text = " ".join(soup.get_text(" ", strip=True).split())
        return text[:max(500, min(max_chars, 20000))] or "No readable text found."
    except Exception as e:
        return f"Could not fetch webpage: {e}"


# ==================== IMAGE SEARCH ====================

@tool
def image_search_unsplash(query: str, per_page: int = 5) -> str:
    """Search Unsplash photos. Requires UNSPLASH_ACCESS_KEY."""
    key = os.getenv("UNSPLASH_ACCESS_KEY")
    if not key:
        return "Add UNSPLASH_ACCESS_KEY to your .env file."

    try:
        response = requests.get(
            "https://api.unsplash.com/search/photos",
            params={"query": query, "per_page": max(1, min(per_page, 10)),
                    "content_filter": "high"},
            headers={**HEADERS, "Authorization": f"Client-ID {key}"},
            timeout=TIMEOUT
        )
        response.raise_for_status()
        photos = response.json().get("results", [])
        return "\n\n".join(
            f"- {p.get('alt_description') or p.get('description') or query}\n"
            f"Image: {p.get('urls', {}).get('regular', '')}\n"
            f"Photo page: {p.get('links', {}).get('html', '')}\n"
            f"Photographer: {p.get('user', {}).get('name', 'Unknown')}"
            for p in photos
        ) or "No Unsplash photos found."
    except Exception as e:
        return f"Image search failed: {e}"


@tool
def image_search_free(query: str, max_results: int = 5) -> str:
    """Search images using DuckDuckGo. Check usage rights before reuse."""
    try:
        results = DDGS().images(query, max_results=max(1, min(max_results, 10)))
        return "\n".join(
            f"- {r.get('title', 'Untitled')}\nImage: {r.get('image', '')}\nSource: {r.get('url', '')}"
            for r in results
        ) or "No image results found."
    except Exception as e:
        return f"Image search failed: {e}"


# ==================== NEWS ====================

@tool
def search_news(query: str, page_size: int = 5, language: str = "en") -> str:
    """Search recent news. Requires NEWS_API_KEY."""
    key = os.getenv("NEWS_API_KEY")
    if not key:
        return "Add NEWS_API_KEY to your .env file."

    try:
        response = requests.get(
            "https://newsapi.org/v2/everything",
            params={"q": query, "pageSize": max(1, min(page_size, 10)),
                    "language": language, "sortBy": "publishedAt"},
            headers={**HEADERS, "X-Api-Key": key},
            timeout=TIMEOUT
        )
        response.raise_for_status()
        data = response.json()
        if data.get("status") != "ok":
            return f"NewsAPI error: {data.get('message', 'Unknown error')}"

        return "\n\n".join(
            f"- {a.get('title', 'Untitled')} ({(a.get('source') or {}).get('name', 'Unknown')})\n"
            f"Published: {a.get('publishedAt', 'Unknown')}\nURL: {a.get('url', '')}\n"
            f"{a.get('description') or ''}"
            for a in data.get("articles", [])
        ) or "No news articles found."
    except Exception as e:
        return f"News search failed: {e}"


@tool
def get_top_headlines(country: str = "in", category: str = "technology",
                      page_size: int = 5) -> str:
    """Get top news headlines. Requires NEWS_API_KEY."""
    key = os.getenv("NEWS_API_KEY")
    if not key:
        return "Add NEWS_API_KEY to your .env file."

    try:
        response = requests.get(
            "https://newsapi.org/v2/top-headlines",
            params={"country": country.lower(), "category": category.lower(),
                    "pageSize": max(1, min(page_size, 10))},
            headers={**HEADERS, "X-Api-Key": key},
            timeout=TIMEOUT
        )
        response.raise_for_status()
        data = response.json()
        if data.get("status") != "ok":
            return f"NewsAPI error: {data.get('message', 'Unknown error')}"

        return "\n\n".join(
            f"- {a.get('title', 'Untitled')}\n"
            f"Source: {(a.get('source') or {}).get('name', 'Unknown')}\n"
            f"URL: {a.get('url', '')}\nPublished: {a.get('publishedAt', 'Unknown')}"
            for a in data.get("articles", [])
        ) or "No headlines found."
    except Exception as e:
        return f"Headlines lookup failed: {e}"


# ==================== WEATHER ====================

def find_location(location: str):
    """Find a place's latitude and longitude with Open-Meteo."""
    response = requests.get(
        "https://geocoding-api.open-meteo.com/v1/search",
        params={"name": location, "count": 1, "language": "en", "format": "json"},
        timeout=TIMEOUT
    )
    response.raise_for_status()
    places = response.json().get("results", [])
    return places[0] if places else None


@tool
def get_current_weather(location: str) -> str:
    """Get current weather for a city or place."""
    try:
        place = find_location(location)
        if not place:
            return f"Location not found: {location}"

        response = requests.get(
            "https://api.open-meteo.com/v1/forecast",
            params={
                "latitude": place["latitude"],
                "longitude": place["longitude"],
                "current": "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m",
                "timezone": "auto"
            },
            timeout=TIMEOUT
        )
        response.raise_for_status()
        current = response.json().get("current", {})
        return (
            f"Location: {place.get('name')}, {place.get('country', '')}\n"
            f"Time: {current.get('time', 'Unknown')}\n"
            f"Temperature: {current.get('temperature_2m', 'Unknown')} °C\n"
            f"Feels like: {current.get('apparent_temperature', 'Unknown')} °C\n"
            f"Humidity: {current.get('relative_humidity_2m', 'Unknown')}%\n"
            f"Precipitation: {current.get('precipitation', 'Unknown')} mm\n"
            f"Wind: {current.get('wind_speed_10m', 'Unknown')} km/h"
        )
    except Exception as e:
        return f"Weather lookup failed: {e}"


@tool
def get_weather_forecast(location: str, days: int = 3) -> str:
    """Get a daily weather forecast for a city or place."""
    try:
        place = find_location(location)
        if not place:
            return f"Location not found: {location}"

        days = max(1, min(days, 7))
        response = requests.get(
            "https://api.open-meteo.com/v1/forecast",
            params={
                "latitude": place["latitude"],
                "longitude": place["longitude"],
                "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
                "forecast_days": days,
                "timezone": "auto"
            },
            timeout=TIMEOUT
        )
        response.raise_for_status()
        daily = response.json().get("daily", {})
        return "\n".join(
            f"- {date}: low {daily['temperature_2m_min'][i]} °C, "
            f"high {daily['temperature_2m_max'][i]} °C, "
            f"rain chance {daily['precipitation_probability_max'][i]}%"
            for i, date in enumerate(daily.get("time", []))
        ) or "No forecast found."
    except Exception as e:
        return f"Forecast lookup failed: {e}"


# ==================== UTILITIES ====================

@tool
def calculator(expression: str) -> str:
    """Calculate basic arithmetic such as (25 * 4) + 10."""

    def calculate(node):
        if isinstance(node, ast.Constant) and type(node.value) in (int, float):
            return node.value

        if isinstance(node, ast.UnaryOp):
            value = calculate(node.operand)
            if isinstance(node.op, ast.USub):
                return -value
            if isinstance(node.op, ast.UAdd):
                return value

        if isinstance(node, ast.BinOp):
            left, right = calculate(node.left), calculate(node.right)
            if isinstance(node.op, ast.Add):
                return left + right
            if isinstance(node.op, ast.Sub):
                return left - right
            if isinstance(node.op, ast.Mult):
                return left * right
            if isinstance(node.op, ast.Div):
                return left / right
            if isinstance(node.op, ast.FloorDiv):
                return left // right
            if isinstance(node.op, ast.Mod):
                return left % right
            if isinstance(node.op, ast.Pow):
                if abs(right) > 10:
                    raise ValueError("Exponent must be between -10 and 10.")
                return left ** right

        raise ValueError("Use numbers and basic arithmetic operators only.")

    try:
        if len(expression) > 200:
            return "Expression too long."
        result = calculate(ast.parse(expression, mode="eval").body)
        return f"{expression} = {result}"
    except Exception as e:
        return f"Calculation failed: {e}"

@tool
def get_current_datetime() -> str:
    """Get the current date and time on the machine running the app."""
    return datetime.now().astimezone().isoformat()


@tool
def convert_units(value: float, from_unit: str, to_unit: str) -> str:
    """Convert length, mass, or temperature units."""
    source, target = from_unit.lower().strip(), to_unit.lower().strip()
    length = {"m": 1, "km": 1000, "cm": 0.01, "mi": 1609.344, "ft": 0.3048}
    mass = {"kg": 1, "g": 0.001, "lb": 0.45359237}

    if source in length and target in length:
        result = value * length[source] / length[target]
    elif source in mass and target in mass:
        result = value * mass[source] / mass[target]
    elif source in ("c", "f") and target in ("c", "f"):
        celsius = value if source == "c" else (value - 32) * 5 / 9
        result = celsius if target == "c" else celsius * 9 / 5 + 32
    else:
        return "Unsupported units. Length: m/km/cm/mi/ft; mass: kg/g/lb; temperature: C/F."

    return f"{value} {from_unit} = {result:.4f} {to_unit}"


# ==================== RAG ====================


@lru_cache(maxsize=1)
def get_rag_pipeline() -> RagPipeline:
    """
    Lazily initialize the RAG pipeline once per process.

    This avoids loading the embedding and reranker models when the application
    starts if the current conversation never uses RAG.
    """
    return RagPipeline()


def _search_knowledge_base(query: str, owner_id: str) -> dict:
    if not query or not query.strip():
        return {
            "found": False,
            "query": query,
            "context": "",
            "sources": [],
            "reason": "Empty query.",
        }

    try:
        rag = get_rag_pipeline()
        result = rag.retrieve(query.strip(), owner_id=owner_id)

        context = (result.get("context") or "").strip()
        sources = result.get("sources") or []

        found = bool(
            result.get("success")
            and result.get("has_documents")
            and context
        )

        if not found:
            return {
                "found": False,
                "query": query,
                "context": "",
                "sources": sources,
                "reason": (
                    "No relevant information was found in the "
                    "knowledge base."
                ),
            }

        return {
            "found": True,
            "query": query,
            "context": context,
            "sources": sources,
            "count": result.get("count", len(sources)),
        }

    except Exception as exc:
        return {
            "found": False,
            "query": query,
            "context": "",
            "sources": [],
            "reason": f"RAG execution failed: {exc}",
        }


def make_search_knowledge_base_tool(owner_id: str):
    """Bind document search to the current browser profile, not model input."""
    @tool("search_knowledge_base")
    def search_knowledge_base(query: str) -> dict:
        """
        Search the current user's uploaded PDFs for relevant information.

        Returns whether relevant context was found, grounded document context,
        and source/page metadata.
        """
        return _search_knowledge_base(query, owner_id)

    return search_knowledge_base