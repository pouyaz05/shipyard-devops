import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.core.config import settings
from app.core.logging import setup_logging
from app.routers import cart, health

setup_logging(settings.LOG_LEVEL)
logger = logging.getLogger("cart-service")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("cart-service starting (env=%s)", settings.APP_ENV)
    yield
    logger.info("cart-service stopping")


app = FastAPI(title="cart-service", lifespan=lifespan)
app.include_router(health.router)
app.include_router(cart.router)
