def test_register_creates_user_and_org(client, db_session):
    response = client.post(
        "/auth/register",
        json={
            "email": "test@example.com",
            "password": "strongPassword123!",
            "full_name": "Test User",
            "organization_name": "Test Org",
            "country": "Chile"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"

    # Verificamos que no se puede crear con el mismo email
    response2 = client.post(
        "/auth/register",
        json={
            "email": "test@example.com",
            "password": "anotherpassword",
            "full_name": "Test User 2",
            "organization_name": "Test Org 2",
            "country": "Argentina"
        }
    )
    assert response2.status_code == 400

def test_login_returns_jwt(client, db_session):
    # First register
    client.post(
        "/auth/register",
        json={
            "email": "login@example.com",
            "password": "loginPassword123!",
            "full_name": "Login User",
            "organization_name": "Login Org",
            "country": "Chile"
        }
    )

    # Then login
    response = client.post(
        "/auth/login",
        json={
            "email": "login@example.com",
            "password": "loginPassword123!"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data

    # Try invalid password
    bad_login = client.post(
        "/auth/login",
        json={
            "email": "login@example.com",
            "password": "wrongPassword!"
        }
    )
    assert bad_login.status_code == 401

def test_protected_endpoint_without_token_returns_401(client):
    # Intentar acceder al dashboard sin token
    response = client.get("/dashboard/summary")
    assert response.status_code == 401
