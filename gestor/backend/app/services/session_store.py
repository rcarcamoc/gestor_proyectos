from abc import ABC, abstractmethod
from typing import List, Dict, Any

class SessionStore(ABC):
    """Interfaz abstracta para el almacenamiento de sesiones de chat."""
    
    @abstractmethod
    def get_history(self, session_id: str) -> List[Dict[str, Any]]:
        """Obtiene el historial de una sesión."""
        pass

    @abstractmethod
    def add_message(self, session_id: str, role: str, text: str):
        """Añade un mensaje a la sesión."""
        pass

    @abstractmethod
    def clear(self, session_id: str):
        """Limpia el historial de la sesión."""
        pass

class InMemorySessionStore(SessionStore):
    """Implementación de SessionStore basada en memoria volátil (dict)."""
    
    def __init__(self):
        self._store: Dict[str, List[Dict[str, Any]]] = {}

    def get_history(self, session_id: str) -> List[Dict[str, Any]]:
        return self._store.get(session_id, [])

    def add_message(self, session_id: str, role: str, text: str):
        if session_id not in self._store:
            self._store[session_id] = []
            
        # Formato estándar plano para ser procesado por AIProvider
        self._store[session_id].append({
            "role": role,
            "content": text
        })

    def clear(self, session_id: str):
        if session_id in self._store:
            del self._store[session_id]
