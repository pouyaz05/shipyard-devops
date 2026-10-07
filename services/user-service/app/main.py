import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.core.config import settings
from app.core.logging import setup_logging
from app.routers import auth, health, ping, users

setup_logging(settings.LOG_LEVEL)
logger = logging.getLogger("user-service")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("user-service starting (env=%s)", settings.APP_ENV)
    yield
    logger.info("user-service stopping")


app = FastAPI(title="user-service", lifespan=lifespan)
app.include_router(health.router)
app.include_router(ping.router)
app.include_router(auth.router)
app.include_router(users.router)
