import pytest
from fastapi.testclient import TestClient

from payments_api.main import app


@pytest.mark.integration
def test_health_endpoint_returns_ok() -> None:
    response = TestClient(app).get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
