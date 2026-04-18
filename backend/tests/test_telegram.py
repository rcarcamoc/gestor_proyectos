from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_telegram_status_unauthorized():
    response = client.get("/telegram/status")
    assert response.status_code == 401

def test_telegram_link_invalid_token():
    response = client.post("/telegram/link", json={"token": "INVALID", "telegram_chat_id": 123456})
    assert response.status_code == 404
