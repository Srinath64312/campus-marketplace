from collections.abc import Generator

from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app.config import get_settings

settings = get_settings()

_connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
_kwargs = {}
if settings.database_url == "sqlite://":
    _kwargs["poolclass"] = StaticPool

engine = create_engine(settings.database_url, connect_args=_connect_args, **_kwargs)


def init_db() -> None:
    from app import models  # noqa: F401  (ensure models are registered)

    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
