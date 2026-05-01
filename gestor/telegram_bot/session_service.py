import redis
import json
import os
import logging


class RedisSession:
    """
    Wrapper de Redis con fallback en memoria para entornos sin Redis (desarrollo).
    BUG 12 FIX: el constructor ya no crashea si Redis no está disponible.
    """

    def __init__(self):
        redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
        try:
            self.r = redis.from_url(redis_url, decode_responses=True)
            self.r.ping()  # verificar conexión real
            logging.info("Redis conectado correctamente.")
        except Exception as e:
            logging.warning(f"Redis no disponible: {e}. Usando fallback en memoria.")
            self.r = None
            self._memory = {}

    # ------------------------------------------------------------------
    # Helpers internos
    # ------------------------------------------------------------------

    def _set(self, key: str, value: str, ex: int = None):
        if self.r:
            self.r.set(key, value, ex=ex)
        else:
            self._memory[key] = value

    def _get(self, key: str):
        if self.r:
            return self.r.get(key)
        return self._memory.get(key)

    def _delete(self, key: str):
        if self.r:
            self.r.delete(key)
        else:
            self._memory.pop(key, None)

    # ------------------------------------------------------------------
    # API pública
    # ------------------------------------------------------------------

    def set_state(self, chat_id, state_data, ex=3600):
        self._set(f"session:{chat_id}", json.dumps(state_data), ex=ex)

    def get_state(self, chat_id):
        data = self._get(f"session:{chat_id}")
        return json.loads(data) if data else None

    def clear_state(self, chat_id):
        self._delete(f"session:{chat_id}")

    def set_user_token(self, chat_id, token, ex=86400):
        self._set(f"user_token:{chat_id}", token, ex=ex)

    def get_user_token(self, chat_id):
        return self._get(f"user_token:{chat_id}")

    # ------------------------------------------------------------------
    # Perf 3: Cache genérico para resultados frecuentes (get-tasks, get-projects, etc.)
    # ------------------------------------------------------------------

    def get_cached(self, key: str):
        """Devuelve dato cacheado o None si no existe / expirado."""
        data = self._get(f"cache:{key}")
        return json.loads(data) if data else None

    def set_cached(self, key: str, data, ex: int = 30):
        """Cachea dato con TTL en segundos (defecto: 30s para datos de usuario)."""
        self._set(f"cache:{key}", json.dumps(data), ex=ex)

    def invalidate_cache(self, key: str):
        """Invalida un dato cacheado (llamar tras escribir en el backend)."""
        self._delete(f"cache:{key}")
