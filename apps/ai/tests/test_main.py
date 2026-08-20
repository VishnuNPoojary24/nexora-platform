from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_health():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_chat_placeholder():
    response = client.post("/api/v1/ai/chat", json={"message": "Hello"})

    assert response.status_code == 200
    assert response.json()["success"] is True
