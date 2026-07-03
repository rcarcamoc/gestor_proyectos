import os
import string
import secrets
import random
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.user import User
from app.models.telegram import VinculationToken, TelegramAccount, AlertaEnviada, ConversationLog
from app.models.task import Task, TaskAssignment
from app.models.project import Project
from app.models.team import Team, TeamMembership
from app.models.skill import Skill
from app.models.user import UserSkill
from app.models.availability import UserAvailability

logger = logging.getLogger(__name__)

def get_linked_user(telegram_chat_id: int, db: Session) -> User:
    """Resuelve el User completo vinculado al chat_id. Lanza Exception si no existe."""
    acc = db.query(TelegramAccount).filter(
        TelegramAccount.telegram_chat_id == telegram_chat_id,
        TelegramAccount.activo == True
    ).first()
    if not acc:
        raise ValueError("Usuario no vinculado a Telegram")
    user = db.query(User).filter(User.id == acc.user_id).first()
    if not user:
        raise ValueError("Usuario asociado no encontrado")
    return user

def send_telegram_message(chat_id: int, text: str):
    """Envía un mensaje directamente al chat de Telegram sin pasar por el bot."""
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    if not token:
        logger.warning("TELEGRAM_BOT_TOKEN no configurado — no se pudo enviar mensaje push")
        return
    import requests as _requests
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    try:
        _requests.post(url, json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"}, timeout=5)
    except Exception as e:
        logger.error(f"Error enviando mensaje Telegram push: {e}")

class TelegramService:
    @staticmethod
    def generate_vinculation_token(user_id: int, db: Session) -> Dict[str, Any]:
        # Eliminar tokens anteriores del mismo usuario
        db.query(VinculationToken).filter(VinculationToken.user_id == user_id).delete()

        # Generar token de 6 caracteres (mayúsculas y números)
        token_chars = string.ascii_uppercase + string.digits
        token = ''.join(secrets.choice(token_chars) for _ in range(6))
        expires_at = datetime.now() + timedelta(minutes=10)

        db_token = VinculationToken(
            token=token,
            user_id=user_id,
            expira_en=expires_at
        )
        db.add(db_token)
        db.commit()
        db.refresh(db_token)
        return {
            "token": db_token.token,
            "expires_at": db_token.expira_en
        }

    @staticmethod
    def link_account(token: str, telegram_chat_id: int, db: Session) -> User:
        token_db = db.query(VinculationToken).filter(
            VinculationToken.token == token,
            VinculationToken.usado == False,
            VinculationToken.expira_en > datetime.now()
        ).first()

        if not token_db:
            return None

        # Verificar si el chat_id ya está vinculado
        existing_account = db.query(TelegramAccount).filter(
            TelegramAccount.telegram_chat_id == telegram_chat_id
        ).first()

        if existing_account:
            existing_account.user_id = token_db.user_id
            existing_account.activo = True
        else:
            new_account = TelegramAccount(
                user_id=token_db.user_id,
                telegram_chat_id=telegram_chat_id,
                activo=True
            )
            db.add(new_account)

        token_db.usado = True
        db.commit()

        # Obtener info del usuario para confirmación
        return db.query(User).filter(User.id == token_db.user_id).first()

    @staticmethod
    def get_status(user_id: int, db: Session) -> Dict[str, Any]:
        account = db.query(TelegramAccount).filter(
            TelegramAccount.user_id == user_id,
            TelegramAccount.activo == True
        ).first()
        return {
            "is_linked": account is not None,
            "telegram_chat_id": account.telegram_chat_id if account else None
        }

    @staticmethod
    def get_linked_accounts(db: Session, roles: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        query = db.query(TelegramAccount)
        if roles:
            query = query.join(User).filter(User.role.in_(roles))
        accounts = query.filter(TelegramAccount.activo == True).all()
        return [{"telegram_chat_id": acc.telegram_chat_id, "user_id": acc.user_id} for acc in accounts]

    @staticmethod
    def get_pending_alerts(db: Session) -> List[Dict[str, Any]]:
        now = datetime.now()
        limit_48h = now + timedelta(hours=48)
        
        tasks = db.query(Task).filter(
            Task.status != "Completed",
            Task.deadline != None,
            Task.deadline <= limit_48h.date()
        ).all()
        
        alerts_to_send = []
        for task in tasks:
            days_left = (task.deadline - now.date()).days
            tipo = None
            if days_left == 2:
                tipo = "48h"
            elif days_left == 1:
                tipo = "24h"
            elif days_left == 0:
                tipo = "dia_vencimiento"
                
            if not tipo:
                continue
                
            # Verificar si ya se envió esta alerta
            already_sent = db.query(AlertaEnviada).filter(
                AlertaEnviada.task_id == task.id,
                AlertaEnviada.tipo_alerta == tipo
            ).first()
            
            if already_sent:
                continue
                
            # Obtener responsables vinculados
            assignments = db.query(TaskAssignment).filter(TaskAssignment.task_id == task.id).all()
            for ass in assignments:
                acc = db.query(TelegramAccount).filter(
                    TelegramAccount.user_id == ass.user_id,
                    TelegramAccount.activo == True
                ).first()
                
                if acc:
                    alerts_to_send.append({
                        "id": task.id,
                        "task_id": task.id,
                        "telegram_chat_id": acc.telegram_chat_id,
                        "project_name": task.project.name if task.project else "Sin Proyecto",
                        "task_name": task.name,
                        "deadline_human": task.deadline.strftime("%d/%m/%Y"),
                        "tipo": tipo
                    })
        return alerts_to_send

    @staticmethod
    def mark_alert_sent(task_id: int, tipo: str, chat_id: int, db: Session):
        db_alert = AlertaEnviada(
            task_id=task_id,
            tipo_alerta=tipo,
            telegram_chat_id=chat_id
        )
        db.add(db_alert)
        db.commit()

    @staticmethod
    def get_stalled_tasks(db: Session) -> List[Dict[str, Any]]:
        limit = datetime.now() - timedelta(days=3)
        stalled = db.query(Task).filter(
            Task.status == "In Progress",
            Task.created_at <= limit
        ).all()
        
        results = []
        for task in stalled:
            assignments = db.query(TaskAssignment).filter(TaskAssignment.task_id == task.id).all()
            for ass in assignments:
                acc = db.query(TelegramAccount).filter(
                    TelegramAccount.user_id == ass.user_id,
                    TelegramAccount.activo == True
                ).first()
                if acc:
                    results.append({
                        "telegram_chat_id": acc.telegram_chat_id,
                        "task_name": task.name
                    })
        return results

    @staticmethod
    def create_project(telegram_chat_id: int, name: str, description: str, deadline_str: str, db: Session) -> int:
        user = get_linked_user(telegram_chat_id, db)
        if user.role not in ["owner", "leader"]:
            raise PermissionError("Acción no permitida para el rol de usuario")

        try:
            deadline_date = datetime.strptime(deadline_str, "%Y-%m-%d").date()
        except Exception:
            deadline_date = datetime.now().date() + timedelta(days=30)

        team = db.query(Team).filter(Team.organization_id == user.organization_id).first()
        team_id = team.id if team else None

        db_project = Project(
            name=name,
            description=description,
            deadline=deadline_date,
            created_by=user.id,
            status="Planned",
            start_date=datetime.now().date(),
            organization_id=user.organization_id,
            team_id=team_id
        )
        db.add(db_project)
        db.commit()
        db.refresh(db_project)
        return db_project.id

    @staticmethod
    def create_task(telegram_chat_id: int, project_id: int, name: str, description: Optional[str],
                    deadline_str: Optional[str], start_date_str: Optional[str], priority: str,
                    estimated_hours: Optional[float], status: str, recurrence_type: str,
                    assignee_id: Optional[int], db: Session) -> int:
        acc = db.query(TelegramAccount).filter(
            TelegramAccount.telegram_chat_id == telegram_chat_id,
            TelegramAccount.activo == True
        ).first()
        if not acc:
            raise ValueError("Usuario no vinculado")
            
        user_id = acc.user_id
        
        deadline_date = None
        if deadline_str:
            try:
                deadline_date = datetime.strptime(deadline_str, "%Y-%m-%d").date()
            except:
                pass

        start_date_obj = None
        if start_date_str:
            try:
                start_date_obj = datetime.strptime(start_date_str, "%Y-%m-%d").date()
            except:
                pass

        db_task = Task(
            project_id=project_id,
            name=name,
            description=description,
            deadline=deadline_date,
            start_date=start_date_obj,
            priority=priority,
            estimated_hours=estimated_hours,
            created_by=user_id,
            status=status,
            recurrence_type=recurrence_type
        )
        db.add(db_task)
        db.commit()
        db.refresh(db_task)
        
        target_user_id = assignee_id if assignee_id else user_id
        assignment = TaskAssignment(
            task_id=db_task.id,
            user_id=target_user_id,
            assigned_by=user_id
        )
        db.add(assignment)
        db.commit()
        return db_task.id

    @staticmethod
    def update_user_skills(telegram_chat_id: int, skills: List[str], db: Session):
        acc = db.query(TelegramAccount).filter(
            TelegramAccount.telegram_chat_id == telegram_chat_id,
            TelegramAccount.activo == True
        ).first()
        if not acc:
            raise ValueError("Usuario no vinculado")
            
        user_id = acc.user_id
        for skill_name in skills:
            db_skill = db.query(Skill).filter(Skill.name.ilike(f"%{skill_name}%")).first()
            if db_skill:
                exists = db.query(UserSkill).filter(
                    UserSkill.user_id == user_id,
                    UserSkill.skill_id == db_skill.id
                ).first()
                if not exists:
                    new_user_skill = UserSkill(
                        user_id=user_id,
                        skill_id=db_skill.id,
                        level="Intermediate",
                        source="self_declared"
                    )
                    db.add(new_user_skill)
        db.commit()

    @staticmethod
    def update_user_availability(telegram_chat_id: int, hours_per_day: float, db: Session):
        acc = db.query(TelegramAccount).filter(
            TelegramAccount.telegram_chat_id == telegram_chat_id,
            TelegramAccount.activo == True
        ).first()
        if not acc:
            raise ValueError("Usuario no vinculado")
            
        user_id = acc.user_id
        for day in range(7):
            db_avail = db.query(UserAvailability).filter(
                UserAvailability.user_id == user_id,
                UserAvailability.day_of_week == day
            ).first()
            
            if db_avail:
                db_avail.hours_available = hours_per_day
            else:
                new_avail = UserAvailability(
                    user_id=user_id,
                    day_of_week=day,
                    hours_available=hours_per_day,
                    effective_from=datetime.now().date()
                )
                db.add(new_avail)
        db.commit()

    @staticmethod
    def recover_password(telegram_chat_id: int, email: str, db: Session) -> Dict[str, Any]:
        from passlib.context import CryptContext
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

        acc = db.query(TelegramAccount).filter(
            TelegramAccount.telegram_chat_id == telegram_chat_id,
            TelegramAccount.activo == True
        ).first()
        if not acc:
            raise ValueError("Tu cuenta de Telegram no está vinculada. No puedes recuperar la contraseña por aquí.")

        user = db.query(User).filter(User.id == acc.user_id, User.email == email).first()
        if not user:
            raise ValueError("El correo proporcionado no coincide con tu cuenta vinculada.")

        temp_password = ''.join(random.choices(string.ascii_letters + string.digits, k=12))
        user.password_hash = pwd_context.hash(temp_password)
        user.must_change_password = True
        db.commit()

        message_sent = False
        try:
            send_telegram_message(
                telegram_chat_id,
                f"🔐 <b>Contraseña restablecida</b>\n\n"
                f"Tu nueva contraseña temporal es:\n<code>{temp_password}</code>\n\n"
                f"⚠️ Por seguridad, cámbiala desde la configuración de tu cuenta lo antes posible."
            )
            message_sent = True
        except Exception as e:
            logger.error(f"Error enviando contraseña por Telegram: {e}")

        return {
            "status": "success",
            "message": "Contraseña restablecida.",
            "message_sent": message_sent,
        }

    @staticmethod
    def link_team(link_code: str, telegram_chat_id: int, db: Session) -> str:
        team = db.query(Team).filter(Team.link_code == link_code).first()
        if not team:
            raise ValueError("Código de equipo inválido")
            
        team.telegram_chat_id = str(telegram_chat_id)
        db.commit()
        return team.name

    @staticmethod
    def get_user_info(chat_id: int, db: Session) -> Dict[str, Any]:
        acc = db.query(TelegramAccount).filter(
            TelegramAccount.telegram_chat_id == chat_id,
            TelegramAccount.activo == True
        ).first()
        if not acc:
            raise ValueError("No vinculado")
        user = db.query(User).filter(User.id == acc.user_id).first()
        if not user:
            raise ValueError("Usuario no encontrado")
        return {
            "full_name": user.full_name,
            "role": user.role,
            "email": user.email,
            "organization_id": user.organization_id
        }

    @staticmethod
    def log_conversation(telegram_chat_id: int, user_message: Optional[str],
                         intent_detected: Optional[str], bot_response: Optional[str],
                         processing_time_ms: Optional[int], db: Session):
        log_entry = ConversationLog(
            telegram_chat_id=telegram_chat_id,
            user_message=user_message,
            intent_detected=intent_detected,
            bot_response=bot_response,
            processing_time_ms=processing_time_ms
        )
        db.add(log_entry)
        db.commit()

    @staticmethod
    def get_user_projects(chat_id: int, db: Session) -> List[Dict[str, Any]]:
        acc = db.query(TelegramAccount).filter(
            TelegramAccount.telegram_chat_id == chat_id,
            TelegramAccount.activo == True
        ).first()
        if not acc:
            return []

        active_statuses = ["Planned", "In Progress", "Active"]
        member_projects = (
            db.query(Project)
            .join(TeamMembership, TeamMembership.team_id == Project.team_id)
            .filter(
                TeamMembership.user_id == acc.user_id,
                Project.status.in_(active_statuses)
            )
            .all()
        )

        if not member_projects:
            member_projects = db.query(Project).filter(
                Project.created_by == acc.user_id,
                Project.status.in_(active_statuses)
            ).all()

        return [
            {
                "id": p.id,
                "name": p.name,
                "status": p.status,
                "deadline": str(p.deadline) if p.deadline else "No definida"
            }
            for p in member_projects
        ]

    @staticmethod
    def get_user_tasks(chat_id: int, db: Session) -> List[Dict[str, Any]]:
        acc = db.query(TelegramAccount).filter(
            TelegramAccount.telegram_chat_id == chat_id,
            TelegramAccount.activo == True
        ).first()
        if not acc:
            return []
        
        assignments = db.query(TaskAssignment).filter(TaskAssignment.user_id == acc.user_id).all()
        task_ids = [a.task_id for a in assignments]
        if not task_ids:
            return []
            
        tasks = db.query(Task).filter(Task.id.in_(task_ids), Task.status != "Completed", Task.status != "Done").all()
        return [
            {
                "name": t.name,
                "project": t.project.name if t.project else "Sin proyecto",
                "status": t.status,
                "deadline": str(t.deadline)
            }
            for t in tasks
        ]

    @staticmethod
    def assign_task(telegram_chat_id: int, task_name: str, assignee_name: str, db: Session) -> Dict[str, Any]:
        requester = get_linked_user(telegram_chat_id, db)
        if requester.role not in ["owner", "leader"]:
            raise PermissionError("Acción no permitida para el rol de usuario")

        task = db.query(Task).filter(Task.name.ilike(f"%{task_name}%")).first()
        user_target = db.query(User).filter(User.full_name.ilike(f"%{assignee_name}%")).first()
        if not task or not user_target:
            return {"status": "error", "message": "No se encontró tarea o usuario"}

        assignment = TaskAssignment(task_id=task.id, user_id=user_target.id, assigned_by=requester.id)
        db.add(assignment)
        db.commit()

        # Notificar proactivamente al asignado
        target_acc = db.query(TelegramAccount).filter(
            TelegramAccount.user_id == user_target.id,
            TelegramAccount.activo == True
        ).first()
        if target_acc:
            send_telegram_message(
                target_acc.telegram_chat_id,
                f"📋 <b>Nueva tarea asignada</b>\n\n"
                f"Se te ha asignado la tarea <b>{task.name}</b>\n"
                f"Asignada por: {requester.full_name}"
            )

        return {"status": "success", "message": f"Tarea '{task.name}' asignada a {user_target.full_name}"}

    @staticmethod
    def update_task_status(telegram_chat_id: int, task_name: str, status: str, db: Session) -> Dict[str, Any]:
        requester = get_linked_user(telegram_chat_id, db)
        task = db.query(Task).filter(Task.name.ilike(f"%{task_name}%")).first()
        if not task:
            return {"status": "error", "message": "Tarea no encontrada"}

        if requester.role == "member":
            is_assigned = db.query(TaskAssignment).filter(
                TaskAssignment.task_id == task.id,
                TaskAssignment.user_id == requester.id
            ).first()
            if not is_assigned:
                raise PermissionError("Solo puedes actualizar el estado de tareas que te están asignadas.")

        status_map = {"completada": "Completed", "en progreso": "In Progress", "bloqueada": "Blocked", "pendiente": "Pending"}
        st = status_map.get(status.lower(), status)
        task.status = st
        db.commit()
        return {"status": "success", "message": f"Estado de '{task.name}' actualizado a {st}"}

    @staticmethod
    def update_deadline(telegram_chat_id: int, project_or_task_name: str, deadline_str: str, db: Session) -> Dict[str, Any]:
        acc = db.query(TelegramAccount).filter(
            TelegramAccount.telegram_chat_id == telegram_chat_id,
            TelegramAccount.activo == True
        ).first()
        if not acc:
            raise ValueError("Usuario no vinculado")
        
        try:
            new_date = datetime.strptime(deadline_str, "%Y-%m-%d").date()
        except:
            return {"status": "error", "message": "Formato de fecha inválido"}

        task = db.query(Task).filter(Task.name.ilike(f"%{project_or_task_name}%")).first()
        if task:
            task.deadline = new_date
            db.commit()
            return {"status": "success", "message": f"Fecha de tarea '{task.name}' actualizada"}
            
        project = db.query(Project).filter(Project.name.ilike(f"%{project_or_task_name}%")).first()
        if project:
            project.deadline = new_date
            db.commit()
            return {"status": "success", "message": f"Fecha de proyecto '{project.name}' actualizada"}
            
        return {"status": "error", "message": "No se encontró el elemento"}

    @staticmethod
    def get_projects_at_risk(db: Session) -> List[Dict[str, Any]]:
        now = datetime.now().date()
        projects = db.query(Project).filter(Project.status != "Completed", Project.deadline != None).all()
        risk = [p for p in projects if p.deadline and (p.deadline - now).days <= 3]
        return [{"name": p.name, "deadline": str(p.deadline), "status": p.status} for p in risk]

    @staticmethod
    def get_project_metrics(project_name: str, db: Session) -> Dict[str, Any]:
        project = db.query(Project).filter(Project.name.ilike(f"%{project_name}%")).first()
        if not project:
            return {"error": "No encontrado"}
        total_estimated = db.query(func.sum(Task.estimated_hours)).filter(Task.project_id == project.id).scalar() or 0
        total_actual = db.query(func.sum(Task.actual_hours)).filter(Task.project_id == project.id).scalar() or 0
        return {"project": project.name, "estimated_hours": total_estimated, "actual_hours": total_actual}

    @staticmethod
    def reassign_tasks(telegram_chat_id: int, from_user: str, to_user: str, db: Session) -> Dict[str, Any]:
        requester = get_linked_user(telegram_chat_id, db)
        if requester.role not in ["owner"]:
            raise PermissionError("Solo el propietario puede reasignar todas las tareas.")

        user1 = db.query(User).filter(User.full_name.ilike(f"%{from_user}%")).first()
        user2 = db.query(User).filter(User.full_name.ilike(f"%{to_user}%")).first()
        if not user1 or not user2:
            return {"status": "error", "message": "No se encontró uno o ambos usuarios"}

        if user1.organization_id != requester.organization_id or user2.organization_id != requester.organization_id:
            raise PermissionError("Solo puedes reasignar usuarios de tu organización.")

        assignments = db.query(TaskAssignment).filter(TaskAssignment.user_id == user1.id).all()
        task_names = []
        for a in assignments:
            a.user_id = user2.id
            t = db.query(Task).filter(Task.id == a.task_id).first()
            if t:
                task_names.append(t.name)
        db.commit()

        target_acc = db.query(TelegramAccount).filter(
            TelegramAccount.user_id == user2.id,
            TelegramAccount.activo == True
        ).first()
        if target_acc and task_names:
            task_list = "\n".join(f"  • {n}" for n in task_names[:10])
            suffix = f"\n  _...y {len(task_names) - 10} más_" if len(task_names) > 10 else ""
            send_telegram_message(
                target_acc.telegram_chat_id,
                f"🔄 <b>Tareas reasignadas</b>\n\n"
                f"Se te han reasignado {len(assignments)} tarea(s) de <b>{user1.full_name}</b>:\n"
                f"{task_list}{suffix}\n\n"
                f"Reasignación realizada por: {requester.full_name}"
            )

        return {"status": "success", "reassigned_count": len(assignments)}

    @staticmethod
    def get_team_blockers(db: Session) -> List[Dict[str, Any]]:
        blocked = db.query(Task).filter(Task.status == "Blocked").all()
        return [{"task": t.name, "project": t.project.name if t.project else "N/A"} for t in blocked]

    @staticmethod
    def get_next_action(chat_id: int, db: Session) -> List[Dict[str, Any]]:
        acc = db.query(TelegramAccount).filter(TelegramAccount.telegram_chat_id == chat_id, TelegramAccount.activo == True).first()
        if not acc:
            return []
        assignments = db.query(TaskAssignment).filter(TaskAssignment.user_id == acc.user_id).all()
        task_ids = [a.task_id for a in assignments]
        task = db.query(Task).filter(Task.id.in_(task_ids), Task.status != "Completed").order_by(Task.deadline.asc(), Task.priority.desc()).first()
        if task:
            return [{"name": task.name, "priority": task.priority, "deadline": str(task.deadline)}]
        return []

    @staticmethod
    def request_help(task_name: str, db: Session) -> bool:
        task = db.query(Task).filter(Task.name.ilike(f"%{task_name}%")).first()
        if task:
            task.status = "Blocked"
            db.commit()
            return True
        return False

    @staticmethod
    def log_time(task_name: str, hours: float, db: Session) -> bool:
        task = db.query(Task).filter(Task.name.ilike(f"%{task_name}%")).first()
        if task:
            task.actual_hours = (task.actual_hours or 0) + hours
            db.commit()
            return True
        return False
