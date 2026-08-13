import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.db import init_db
from app.routers import ai, auth, chat, listings, stats, uploads, users, wishlist
from app.routers import swaps as swaps_router

logger = logging.getLogger("campus-marketplace")
settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    if settings.seed_on_startup:
        from app.seed import seed_if_empty

        created = seed_if_empty()
        if created:
            logger.info("Seeded %s demo listings", created)
    yield


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="APIs for a student-run campus marketplace: listings, barter rings and price intelligence.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=None if settings.cors_origin_list != ["*"] else ".*",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

media_path = Path(settings.media_dir)
media_path.mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=str(media_path)), name="media")

for module in (auth, users, listings, wishlist, chat, swaps_router, ai, stats, uploads):
    app.include_router(module.router)


@app.get("/healthz", tags=["meta"])
def healthz() -> dict:
    return {"status": "ok", "service": settings.app_name}
