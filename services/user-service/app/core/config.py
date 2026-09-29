from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=None, extra="ignore")

    APP_ENV: str = "dev"
    LOG_LEVEL: str = "INFO"


settings = Settings()
