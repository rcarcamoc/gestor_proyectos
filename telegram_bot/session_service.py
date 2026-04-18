import redis
import json
import os

class RedisSession:
    def __init__(self):
        redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
        self.r = redis.from_url(redis_url, decode_responses=True)

    def set_state(self, chat_id, state_data, ex=3600):
        self.r.set(f"session:{chat_id}", json.dumps(state_data), ex=ex)

    def get_state(self, chat_id):
        data = self.r.get(f"session:{chat_id}")
        return json.loads(data) if data else None

    def clear_state(self, chat_id):
        self.r.delete(f"session:{chat_id}")

    def set_user_token(self, chat_id, token, ex=86400):
        # Para guardar el JWT del usuario vinculado
        self.r.set(f"user_token:{chat_id}", token, ex=ex)

    def get_user_token(self, chat_id):
        return self.r.get(f"user_token:{chat_id}")
