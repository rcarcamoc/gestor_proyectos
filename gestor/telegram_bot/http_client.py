"""
Singleton de httpx.AsyncClient compartido entre todos los handlers del bot.
Evita crear y destruir un cliente HTTP (+ TCP handshake + SSL) por cada mensaje.

Perf 1: sustituye el patrón `async with httpx.AsyncClient() as client:` en cada handler.
"""
import os
import httpx

_client: httpx.AsyncClient | None = None


def get_http_client() -> httpx.AsyncClient:
    """Devuelve el cliente HTTP singleton, creándolo si es necesario."""
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            base_url=os.getenv("BACKEND_URL", "http://backend:8000"),
            timeout=httpx.Timeout(10.0, connect=3.0),
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
        )
    return _client


async def close_http_client():
    """Cierra el cliente limpiamente en el shutdown del bot."""
    global _client
    if _client and not _client.is_closed:
        await _client.aclose()
