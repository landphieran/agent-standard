"""Existing FastAPI entry point."""

from fastapi import FastAPI

from payments_api.health import health_status

app = FastAPI(title="Payments API")


@app.get("/health")
def health() -> dict[str, str]:
    return health_status()
