import datetime
from sqlalchemy.orm import Session
from app.core.db import SessionLocal
from app.models.skill import Skill
from app.models.holiday import Holiday
from app.models.config import SystemConfig

def seed_data():
    db = SessionLocal()
    try:
        # 1. Skills
        skills = [
            ("Python", "Backend"), ("FastAPI", "Backend"), ("JavaScript", "Frontend"),
            ("TypeScript", "Frontend"), ("React", "Frontend"), ("Docker", "DevOps"),
            ("SQL", "Backend"), ("MySQL", "Backend"), ("Git", "DevOps"),
            ("REST APIs", "Backend"), ("QA Testing", "QA"), ("Project Management", "Gestión"),
            ("UX/UI Design", "Diseño"), ("Data Engineering", "Datos"), ("Business Analysis", "Gestión"),
            ("Agile/Scrum", "Gestión"), ("Linux/Bash", "DevOps"), ("Cloud (GCP/AWS)", "DevOps"),
            ("CI/CD", "DevOps"), ("Security", "DevOps")
        ]
        for name, cat in skills:
            if not db.query(Skill).filter(Skill.name == name).first():
                db.add(Skill(name=name, category=cat))

        # 2. Holidays Chile 2025 (Permanentes y fijos)
        holidays = [
            ("2025-01-01", "Año Nuevo"),
            ("2025-04-18", "Viernes Santo"),
            ("2025-04-19", "Sábado Santo"),
            ("2025-05-01", "Día del Trabajo"),
            ("2025-05-21", "Día de las Glorias Navales"),
            ("2025-06-20", "Día Nacional de los Pueblos Indígenas"),
            ("2025-06-29", "San Pedro y San Pablo"),
            ("2025-07-16", "Día de la Virgen del Carmen"),
            ("2025-08-15", "Asunción de la Virgen"),
            ("2025-09-18", "Fiestas Patrias"),
            ("2025-09-19", "Glorias del Ejército"),
            ("2025-10-12", "Encuentro de Dos Mundos"),
            ("2025-10-31", "Día de las Iglesias Evangélicas"),
            ("2025-11-01", "Día de Todos los Santos"),
            ("2025-12-08", "Inmaculada Concepción"),
            ("2025-12-25", "Navidad")
        ]
        for h_date, name in holidays:
            date_obj = datetime.datetime.strptime(h_date, "%Y-%m-%d").date()
            if not db.query(Holiday).filter(Holiday.date == date_obj, Holiday.country_code == "CL").first():
                db.add(Holiday(country_code="CL", date=date_obj, name=name))

        # 3. System Config
        configs = [
            ("engine_basic_hours_per_day", "8", "Horas por defecto nivel BASIC"),
            ("engine_degraded_hours_per_day", "6", "Horas por defecto nivel DEGRADED"),
            ("engine_default_task_hours", "4", "Estimación por defecto cuando no hay historial"),
            ("emergency_rollback_window_hours", "2", "Ventana de rollback en horas")
        ]
        for key, val, desc in configs:
            if not db.query(SystemConfig).filter(SystemConfig.key == key).first():
                db.add(SystemConfig(key=key, value=val, description=desc))

        db.commit()
        print("Seed data inserted successfully.")
    except Exception as e:
        print(f"Error seeding data: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()
