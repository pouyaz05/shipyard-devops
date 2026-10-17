import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.core.config import settings
from app.core.logging import setup_logging
from app.routers import health

setup_logging(settings.LOG_LEVEL)
logger = logging.getLogger("order-service")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("order-service starting (env=%s)", settings.APP_ENV)
    yield
    logger.info("order-service stopping")


app = FastAPI(title="order-service", lifespan=lifespan)
app.include_router(health.router)
