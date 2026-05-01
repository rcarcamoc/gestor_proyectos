"""
Construye un contexto enriquecido del usuario para alimentar al LLM.
De este modo, el agente sabe con quién habla, su rol y su estado actual de tareas.
"""
import os
import httpx
from session_service import RedisSession

BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:8000")
session = RedisSession()

async def build_user_context(chat_id: int) -> dict:
    """
    Construye el contexto completo del usuario para alimentar a Gemini.
    Se cachea en Redis por 2 minutos para no golpear el backend en cada mensaje.
    """
    cache_key = f"ctx:{chat_id}"
    cached = session.get_cached(cache_key)
    if cached:
        return cached

    ctx = {
        "chat_id": chat_id,
        "role": "unknown",
        "name": "Usuario",
        "projects": [],
        "tasks": [],
        "overdue_count": 0,
        "is_linked": False
    }

    # Usamos httpx.AsyncClient local para la construcción inicial, o el http_client singleton
    from http_client import get_http_client
    client = get_http_client()

    try:
        # Proyectos activos
        r = await client.get("/telegram/get-projects", params={"chat_id": chat_id})
        if r.status_code == 200:
            ctx["projects"] = r.json()
            ctx["is_linked"] = True

        # Tareas pendientes
        r = await client.get("/telegram/get-tasks", params={"chat_id": chat_id})
        if r.status_code == 200:
            tasks = r.json()
            ctx["tasks"] = tasks
            ctx["overdue_count"] = sum(1 for t in tasks if t.get("status") == "Overdue")

        # Rol del usuario
        r = await client.get("/telegram/user-info", params={"chat_id": chat_id})
        if r.status_code == 200:
            info = r.json()
            ctx["role"] = info.get("role", "member")
            ctx["name"] = info.get("full_name", "Usuario")

    except Exception as e:
        import logging
        logging.error(f"Error building context: {e}")

    # BUG 3 FIX: solo cachear si está vinculado para evitar bloquear
    # nuevos vínculos con contexto vacío por 2 min
    if ctx["is_linked"]:
        session.set_cached(cache_key, ctx, ex=120)

    return ctx
