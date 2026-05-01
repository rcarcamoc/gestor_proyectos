from app.core.db import engine
from app.models.task_log import TaskLog
from app.models.notification import Notification
from app.models.organization import Base

print("Connecting to engine...")
Base.metadata.create_all(bind=engine)
print("Tables created successfully")
