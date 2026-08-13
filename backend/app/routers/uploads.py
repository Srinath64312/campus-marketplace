import secrets
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile

from app.config import get_settings
from app.models import User
from app.schemas import UploadResponse
from app.security import get_current_user

router = APIRouter(prefix="/api", tags=["uploads"])

ALLOWED_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp", ".gif"}


@router.post("/uploads", response_model=UploadResponse, status_code=201)
async def upload_image(
    request: Request,
    file: UploadFile = File(...),
    _: User = Depends(get_current_user),
) -> UploadResponse:
    settings = get_settings()
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_SUFFIXES:
        raise HTTPException(status_code=400, detail=f"Unsupported image type '{suffix or 'unknown'}'")

    payload = await file.read()
    if len(payload) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail="Image must be smaller than 5 MB")

    media_dir = Path(settings.media_dir)
    media_dir.mkdir(parents=True, exist_ok=True)
    name = f"{secrets.token_hex(12)}{suffix}"
    (media_dir / name).write_bytes(payload)

    return UploadResponse(url=str(request.url_for("media", path=name)))
