from sqlalchemy.orm import Session
from app.models.user import User
from app.models.skill import UserSkill
from app.models.availability import UserAvailability
from app.models.task import Task
from app.models.config import SystemConfig
from datetime import date, timedelta
from typing import Dict, Any

class SmartEngine:
    def __init__(self, db: Session):
        self.db = db
        self.configs = {c.key: c.value for c in db.query(SystemConfig).all()}

    def evaluate_level(self, user_id: int) -> Dict[str, Any]:
        has_skills = self.db.query(UserSkill).filter(UserSkill.user_id == user_id).first() is not None
        has_availability = self.db.query(UserAvailability).filter(UserAvailability.user_id == user_id).first() is not None
        has_history = self.db.query(Task).filter(Task.status == "Completed").join(Task.project).first() is not None # Lógica simple historial
        
        if has_availability and has_skills and has_history:
            return {"level": "FULL", "percentage": 95, "label": "Precisión máxima", "is_estimated": False}
        elif has_availability and has_skills:
            return {"level": "HIGH", "percentage": 80, "label": "Alta precisión", "is_estimated": True}
        elif has_skills or has_availability:
            return {"level": "BASIC", "percentage": 55, "label": "Estimación parcial", "is_estimated": True}
        else:
            return {"level": "DEGRADED", "percentage": 30, "label": "Datos mínimos", "is_estimated": True}

    def check_conflicts(self, task_id: int, user_id: int) -> Dict[str, Any]:
        # En MVP: Detección simple basada en el nivel del motor
        level_info = self.evaluate_level(user_id)
        
        # Simulación: Si el usuario ya tiene 3 tareas activas, hay conflicto
        active_tasks_count = self.db.query(Task).filter(Task.status == "In Progress").count()
        
        has_conflicts = active_tasks_count >= 3
        conflicts = []
        if has_conflicts:
            conflicts.append({
                "type": "OVERLOAD",
                "message": f"El usuario ya tiene {active_tasks_count} tareas en curso."
            })
            
        return {
            "has_conflicts": has_conflicts,
            "conflicts": conflicts,
            "motor_confidence": level_info,
            "suggestion": "Considerar reasignar a un miembro con menos carga." if has_conflicts else "Viabilidad confirmada.",
            "warnings": ["Faltan datos de disponibilidad real"] if level_info["level"] in ["BASIC", "DEGRADED"] else []
        }
