from payments_api.health import health_status


def test_health_status_is_ok() -> None:
    assert health_status() == {"status": "ok"}
