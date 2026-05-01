from sqlalchemy.orm import Session
from datetime import datetime
import json
from app.models.user import User
from app.models.task import Task, TaskAssignment
from app.models.project import Project
from app.services.tool_registry import Tool, registry

async def get_my_tasks_handler(db: Session, user: User, status: str = None) -> str:
    query = db.query(Task).join(TaskAssignment).filter(TaskAssignment.user_id == user.id)
    if status:
        query = query.filter(Task.status == status)
    
    tasks = query.all()
    if not tasks:
        return "No tienes tareas pendientes."
    
    result = "Tus tareas actuales son:\n"
    for t in tasks:
        deadline_str = t.deadline.strftime("%Y-%m-%d") if t.deadline else "Sin fecha"
        result += f"- [ID: {t.id}] {t.name} (Estado: {t.status}, Prioridad: {t.priority}, Vence: {deadline_str})\n"
    
    return result

async def get_projects_handler(db: Session, user: User, status: str = None) -> str:
    # Si es owner/leader puede ver los de su org
    query = db.query(Project).filter(Project.organization_id == user.organization_id)
    if status:
        query = query.filter(Project.status == status)
        
    projects = query.all()
    if not projects:
        return "No hay proyectos activos."
        
    result = "Tus proyectos son:\n"
    for p in projects:
        result += f"- [ID: {p.id}] {p.name} (Estado: {p.status})\n"
        
    return result

async def create_task_handler(db: Session, user: User, project_id: int, name: str, description: str = None, deadline: str = None, priority: str = "Medium") -> str:
    # Verificar si el proyecto existe
    project = db.query(Project).filter(Project.id == project_id, Project.organization_id == user.organization_id).first()
    if not project:
        return f"Error: No se encontró el proyecto con ID {project_id}."
        
    new_task = Task(
        project_id=project_id,
        name=name,
        description=description,
        priority=priority,
        status="Pending",
        created_by=user.id
    )
    if deadline:
        try:
            new_task.deadline = datetime.strptime(deadline, "%Y-%m-%d").date()
        except ValueError:
            return "Error: La fecha de vencimiento debe estar en formato YYYY-MM-DD."
            
    db.add(new_task)
    db.commit()
    db.refresh(new_task)
    
    # Si es miembro normal, se auto-asigna la tarea
    if user.role == "member":
        assignment = TaskAssignment(
            task_id=new_task.id,
            user_id=user.id,
            assigned_by=user.id
        )
        db.add(assignment)
        db.commit()
        
    return f"Tarea '{name}' creada con éxito (ID: {new_task.id})."

# Registro de Herramientas
tool_get_tasks = Tool(
    name="get_tasks",
    description="Obtiene las tareas asignadas al usuario actual. Puede filtrar por estado.",
    schema={
        "type": "object",
        "properties": {
            "status": {
                "type": "string",
                "description": "Estado de la tarea para filtrar (ej. 'Pending', 'In Progress', 'Completed')",
                "enum": ["Pending", "In Progress", "Blocked", "Completed"]
            }
        }
    },
    handler=get_my_tasks_handler,
    risk_level="Bajo"
)
tool_get_tasks.requires_llm_formatting = False # Evita llamada extra al LLM

tool_get_projects = Tool(
    name="get_projects",
    description="Obtiene los proyectos de la organización. Puede filtrar por estado.",
    schema={
        "type": "object",
        "properties": {
            "status": {
                "type": "string",
                "description": "Estado del proyecto para filtrar (ej. 'Active', 'On Hold', 'Completed')",
                "enum": ["Active", "On Hold", "Completed", "Cancelled"]
            }
        }
    },
    handler=get_projects_handler,
    risk_level="Bajo"
)
tool_get_projects.requires_llm_formatting = False

tool_create_task = Tool(
    name="create_task",
    description="Crea una nueva tarea en un proyecto existente.",
    schema={
        "type": "object",
        "properties": {
            "project_id": {"type": "integer", "description": "ID del proyecto"},
            "name": {"type": "string", "description": "Nombre de la tarea"},
            "description": {"type": "string", "description": "Descripción opcional"},
            "deadline": {"type": "string", "description": "Fecha de vencimiento en formato YYYY-MM-DD"},
            "priority": {"type": "string", "enum": ["Low", "Medium", "High", "Critical"]}
        },
        "required": ["project_id", "name"]
    },
    handler=create_task_handler,
    risk_level="Bajo"
)
tool_create_task.requires_llm_formatting = True # Que el LLM le avise amablemente

def register_all_tools():
    registry.register(tool_get_tasks)
    registry.register(tool_get_projects)
    registry.register(tool_create_task)
