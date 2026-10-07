from fastapi import APIRouter

router = APIRouter(prefix="/api/user-service", tags=["ping"])


@router.get("/ping")
def ping() -> dict[str, str]:
    return {"status": "ok"}
