from pydantic import Field, ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=None, extra="ignore")

    APP_ENV: str = "dev"
    LOG_LEVEL: str = "INFO"
    DATABASE_URL: str
    ADMIN_API_KEY: str = Field(min_length=16)


def load_settings() -> Settings:
    try:
        return Settings()  # type: ignore[call-arg]
    except ValidationError as exc:
        # Print only variable names: pydantic's own message would echo values (secrets).
        names = ", ".join(sorted({str(e["loc"][0]) for e in exc.errors()}))
        raise SystemExit(f"Invalid configuration, check these env vars: {names}") from None


settings = load_settings()
