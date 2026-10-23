import shutil
import tempfile
from faster_whisper import WhisperModel
from faster_whisper.tokenizer import _LANGUAGE_CODES
from fastapi import APIRouter, HTTPException, UploadFile, File, Query

router = APIRouter(prefix="/stt", tags=["STT"])

model = WhisperModel("base", device="cpu", compute_type="int8")


def transcribe_audio(file_path: str, translation: bool = False, language_detection: bool = False):
    try:
        task_type = "translate" if translation else "transcribe"
        segments, info = model.transcribe(file_path, task=task_type, beam_size=3, vad_filter=True)
        result = {"segments": [segment.text for segment in segments]}
        if language_detection:
            result["detected_language"] = info.language
            result["language_probability"] = info.language_probability
            result["translated"] = translation and info.language != "en"
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"error transcribing audio: {str(e)}")


@router.get("/supported_languages")
async def stt_supported_languages():
    try:
        return {
            "Total Languages": len(_LANGUAGE_CODES),
            "Supported Languages": sorted(_LANGUAGE_CODES),
        }
    except Exception:
        raise HTTPException(status_code=500, detail="error fetching supported languages")


@router.post("")
async def stt(
    file_path: UploadFile = File(...),
    translation: bool = Query(False),
    language_detection: bool = Query(False),
):
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp:
            shutil.copyfileobj(file_path.file, temp)
            temp_path = temp.name
        return transcribe_audio(file_path=temp_path, translation=translation, language_detection=language_detection)
    except Exception:
        raise HTTPException(status_code=500, detail="error generating captions")
