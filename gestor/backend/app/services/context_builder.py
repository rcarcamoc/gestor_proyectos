import datetime
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Dict, Any

from app.models.user import User
from app.models.task import Task, TaskAssignment
from app.models.project import Project

class ContextBuilder:
    def __init__(self, db: Session):
        self.db = db

    def build_user_context(self, user: User) -> Dict[str, Any]:
        """
        Construye el contexto del usuario según los criterios definidos en el plan.
        Contexto dinámico corto: 5-10 tareas relevantes (In Progress, Blocked, deadline < 7 days).
        """
        today = datetime.date.today()
        in_7_days = today + datetime.timedelta(days=7)

        # Buscar tareas asignadas al usuario que cumplan los criterios (máximo 10)
        tasks_query = self.db.query(Task).join(TaskAssignment).filter(
            TaskAssignment.user_id == user.id,
            or_(
                Task.status.in_(["In Progress", "Blocked"]),
                (Task.deadline != None) & (Task.deadline <= in_7_days) & (~Task.status.in_(["Completed", "Archived"]))
            )
        ).limit(10).all()

        tasks_list = []
        for t in tasks_query:
            tasks_list.append({
                "id": t.id,
                "name": t.name,
                "project_id": t.project_id,
                "status": t.status,
                "priority": t.priority,
                "deadline": str(t.deadline) if t.deadline else None,
            })

        return {
            "user": {
                "id": user.id,
                "name": user.full_name,
                "role": user.role,
                "email": user.email,
                "timezone": "America/Santiago"  # TODO: Obtener del perfil si existe
            },
            "relevant_tasks": tasks_list
        }

    def format_context_for_prompt(self, context_dict: Dict[str, Any]) -> str:
        """Formatea el diccionario a un texto inyectable en el System Prompt."""
        import json
        return f"""
<USER_CONTEXT>
{json.dumps(context_dict, indent=2, ensure_ascii=False)}
</USER_CONTEXT>
"""
