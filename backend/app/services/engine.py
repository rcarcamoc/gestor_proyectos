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
        from app.models.task import TaskAssignment

        level_info = self.evaluate_level(user_id)
        current_task = self.db.query(Task).filter(Task.id == task_id).first()

        if not current_task:
            return {"error": "Task not found"}

        # Get system defaults
        basic_hours = float(self.configs.get("engine_basic_hours_per_day", 8))
        degraded_hours = float(self.configs.get("engine_degraded_hours_per_day", 6))
        default_task_hours = float(self.configs.get("engine_default_task_hours", 4))

        # Determine user daily capacity based on motor level
        if level_info["level"] == "FULL":
            # For FULL, we should ideally sum UserAvailability. For MVP simplicity, we use 8 if not found
            availability = self.db.query(UserAvailability).filter(UserAvailability.user_id == user_id).all()
            daily_capacity = sum([a.hours_available for a in availability]) / len(availability) if availability else 8.0
        elif level_info["level"] == "HIGH":
            daily_capacity = 8.0
        elif level_info["level"] == "BASIC":
            daily_capacity = basic_hours
        else:
            daily_capacity = degraded_hours

        # Estimate task duration if missing
        task_hours = current_task.estimated_hours or default_task_hours
        task_start = current_task.start_date or date.today()
        task_end = current_task.deadline or (task_start + timedelta(days=max(1, int(task_hours / daily_capacity))))

        # Check for overlaps and load
        # Get all tasks assigned to the user that overlap with this period
        other_assignments = self.db.query(TaskAssignment).filter(
            TaskAssignment.user_id == user_id,
            TaskAssignment.task_id != task_id
        ).all()

        conflicts = []
        total_load_in_period = 0.0

        for assignment in other_assignments:
            other_task = self.db.query(Task).filter(Task.id == assignment.task_id).first()
            if not other_task or not other_task.start_date:
                continue

            o_start = other_task.start_date
            o_end = other_task.deadline or (o_start + timedelta(days=1))

            # Check overlap
            if not (task_end < o_start or task_start > o_end):
                # Simple load calculation: spread estimated hours over days
                days = (o_end - o_start).days or 1
                load_per_day = (other_task.estimated_hours or default_task_hours) / days
                total_load_in_period += load_per_day

        # Check if new task pushes user over capacity
        new_task_days = (task_end - task_start).days or 1
        new_task_load_per_day = task_hours / new_task_days

        if (total_load_in_period + new_task_load_per_day) > daily_capacity:
            conflicts.append({
                "type": "OVERLOAD",
                "message": f"Sobrecarga detectada: Carga diaria estimada ({total_load_in_period + new_task_load_per_day:.1f}h) excede capacidad ({daily_capacity}h)."
            })

        has_conflicts = len(conflicts) > 0

        return {
            "has_conflicts": has_conflicts,
            "conflicts": conflicts,
            "motor_confidence": level_info,
            "suggestion": "Intentar mover fechas o reasignar." if has_conflicts else "Carga balanceada.",
            "warnings": ["Usando duraciones estimadas por falta de fechas"] if not current_task.deadline else [],
            "daily_capacity": daily_capacity,
            "total_load_in_period": total_load_in_period,
            "new_task_load_per_day": new_task_load_per_day
        }

    def suggest_assignees(self, task_id: int, team_id: int) -> Dict[str, Any]:
        from app.models.team import TeamMembership
        members = self.db.query(TeamMembership).filter(TeamMembership.team_id == team_id).all()
        
        candidates = []
        for member in members:
            # Check conflicts for each member
            eval_result = self.check_conflicts(task_id, member.user_id)
            if "error" in eval_result:
                continue
            
            # Additional metric: how much capacity is left
            capacity_left = eval_result["daily_capacity"] - eval_result.get("total_load_in_period", 0)
            
            # Find user full_name and skills (basic matching for MVP)
            user = self.db.query(User).filter(User.id == member.user_id).first()
            user_skills_db = self.db.query(UserSkill).filter(UserSkill.user_id == member.user_id).all()
            skills = [s.skill_id for s in user_skills_db]
            
            candidates.append({
                "user_id": user.id,
                "name": user.full_name,
                "has_conflicts": eval_result["has_conflicts"],
                "capacity_left": capacity_left,
                "motor_level": eval_result["motor_confidence"]["level"],
                "skills_count": len(skills),
                "is_recommended": not eval_result["has_conflicts"] and capacity_left > 0
            })
            
        # Rank: recommended first, then by capacity left descending
        candidates.sort(key=lambda x: (x["is_recommended"], x["capacity_left"]), reverse=True)
        return {"task_id": task_id, "team_id": team_id, "candidates": candidates}
