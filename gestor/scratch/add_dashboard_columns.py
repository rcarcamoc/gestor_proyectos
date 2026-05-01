import mysql.connector
import os
from dotenv import load_dotenv

load_dotenv()

def migrate():
    try:
        conn = mysql.connector.connect(
            host=os.getenv("DB_HOST", "localhost"),
            port=os.getenv("DB_PORT", 3306),
            user=os.getenv("DB_USER", "root"),
            password=os.getenv("DB_PASSWORD", "password"),
            database=os.getenv("DB_NAME", "smarttrack")
        )
        cursor = conn.cursor()
        
        print("Añadiendo columna 'color' a tabla 'projects'...")
        try:
            cursor.execute("ALTER TABLE projects ADD COLUMN color VARCHAR(50) NULL AFTER created_at")
            print("OK.")
        except Exception as e:
            print(f"Saltando (posiblemente ya existe): {e}")

        print("Añadiendo columna 'completed_at' a tabla 'tasks'...")
        try:
            cursor.execute("ALTER TABLE tasks ADD COLUMN completed_at DATETIME NULL AFTER created_at")
            print("OK.")
        except Exception as e:
            print(f"Saltando (posiblemente ya existe): {e}")

        conn.commit()
        cursor.close()
        conn.close()
        print("Migración completada exitosamente.")
    except Exception as e:
        print(f"Error en la migración: {e}")

if __name__ == "__main__":
    migrate()
