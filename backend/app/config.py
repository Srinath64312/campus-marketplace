from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Campus Marketplace API"
    database_url: str = "sqlite:///./campus_marketplace.db"
    jwt_secret: str = "dev-secret-change-me-before-deploying-anywhere-real"
    jwt_algorithm: str = "HS256"
    access_token_ttl_minutes: int = 60 * 24 * 14
    cors_origins: str = "*"
    media_dir: str = "./media"
    max_upload_bytes: int = 5 * 1024 * 1024
    seed_on_startup: bool = True

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
