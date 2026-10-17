import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.core.config import settings
from app.core.logging import setup_logging
from app.routers import categories, health, internal, products

setup_logging(settings.LOG_LEVEL)
logger = logging.getLogger("product-service")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("product-service starting (env=%s)", settings.APP_ENV)
    yield
    logger.info("product-service stopping")


app = FastAPI(title="product-service", lifespan=lifespan)
app.include_router(health.router)
app.include_router(categories.router)
app.include_router(products.router)
app.include_router(internal.router)
