from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.notification import Notification
from app.schemas import notification as schemas
from typing import List, Any

router = APIRouter()

@router.get("/", response_model=List[schemas.Notification])
def read_notifications(
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
) -> Any:
    return db.query(Notification).filter(Notification.user_id == current_user.id).order_by(Notification.created_at.desc()).all()

@router.patch("/{notification_id}", response_model=schemas.Notification)
def update_notification(
    notification_id: int,
    data: schemas.NotificationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    notif = db.query(Notification).filter(Notification.id == notification_id, Notification.user_id == current_user.id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notificación no encontrada")
    
    notif.is_read = data.is_read
    db.commit()
    db.refresh(notif)
    return notif

@router.post("/mark-all-read")
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    db.query(Notification).filter(Notification.user_id == current_user.id, Notification.is_read == False).update({"is_read": True})
    db.commit()
    return {"message": "All notifications marked as read"}
