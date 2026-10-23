import uuid
import edge_tts
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

router = APIRouter(prefix="/tts", tags=["TTS"])

subtitle_cache = {}


class TTS_REQUEST(BaseModel):
    text: str
    voice: str = "en-GB-SoniaNeural"
    rate: str = "+0%"
    volume: str = "+0%"


async def audio_generator(request_id, text, voice, volume, rate):
    try:
        communicate = edge_tts.Communicate(text=text, voice=voice, volume=volume, rate=rate)
        submaker = edge_tts.SubMaker()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                yield chunk["data"]
            elif chunk["type"] in ("WordBoundary", "SentenceBoundary"):
                submaker.feed(chunk)
        subtitle_cache[request_id] = submaker.get_srt()
    except Exception as e:
        raise HTTPException(status_code=500, detail="error generating audio")


@router.post("")
async def tts(tts_params: TTS_REQUEST):
    try:
        request_id = str(uuid.uuid4())
        return StreamingResponse(
            audio_generator(
                request_id=request_id,
                text=tts_params.text,
                voice=tts_params.voice,
                volume=tts_params.volume,
                rate=tts_params.rate,
            ),
            media_type="audio/mpeg",
            headers={"X-Request-ID": request_id},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail="error generating audio")


@router.get("/subtitles/{request_id}")
async def get_subtitles(request_id: str):
    try:
        srt = subtitle_cache.pop(request_id, None)
        if srt is None:
            raise HTTPException(status_code=404, detail="Subtitles not ready")
        return {"request_id": request_id, "subtitles": srt}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="error generating subtitles")


@router.get("/available_voices")
async def available_voices():
    try:
        voices = await edge_tts.list_voices()
        simplified = [{"Voice": v["ShortName"], "Gender": v["Gender"]} for v in voices]
        return {"Available Voices": len(voices), "Voices": simplified}
    except Exception:
        raise HTTPException(status_code=500, detail="error fetching available voices")
