from app.core.db import engine
from app.models.organization import Base, Organization
from app.models.user import User
from app.models.project import Project
from app.models.task import Task, TaskAssignment, TaskDependency, TaskMetric
from app.models.task_log import TaskLog
from app.models.notification import Notification

print("Imported all models. Starting metadata.create_all...")
Base.metadata.create_all(bind=engine)
print("Tables created/updated successfully")
