# SmartTrack — MVP v2.0

SmartTrack es una plataforma inteligente de gestión de proyectos y carga de trabajo diseñada para equipos operativos. Su diferenciador principal es un motor de scheduling que funciona incluso con datos incompletos, degradando con transparencia.

## 🚀 Instalación desde cero (Docker Local)

Sigue estos pasos para levantar el entorno completo de desarrollo en menos de 5 minutos.

### 1. Requisitos previos
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado y corriendo.
- [Docker Compose](https://docs.docker.com/compose/install/) (incluido en Docker Desktop).

### 2. Clonar el repositorio
```bash
git clone <url-del-repositorio>
cd smarttrack
```

### 3. Configurar variables de entorno
El sistema utiliza un archivo `.env` para la configuración. Crea una copia del ejemplo:
```bash
cp .env.example .env
```
*Nota: Los valores por defecto en `.env.example` ya están optimizados para funcionar con Docker Compose.*

### 4. Levantar el sistema
Ejecuta el siguiente comando en la raíz del proyecto:
```bash
docker compose up --build
```
Este comando realizará las siguientes acciones:
- Levantará la base de datos **MySQL 8.4**.
- Construirá e iniciará el **Backend (FastAPI)** con hot-reload.
- Construirá e iniciará el **Frontend (React 19 + Tailwind 4)**.
- Levantará **Adminer** para gestión visual de la BD.

### 5. Inicializar la base de datos (Migraciones y Semillas)
Una vez que los contenedores estén corriendo, abre una nueva terminal y ejecuta:
```bash
# Aplicar esquema de tablas
docker compose exec backend alembic upgrade head

# Cargar datos iniciales (Skills, Feriados Chile, Configuración)
docker compose exec backend python app/seed.py
```

---

## 🌐 Acceso a los Servicios

| Servicio | URL | Descripción |
| :--- | :--- | :--- |
| **Frontend** | [http://localhost:5173](http://localhost:5173) | Interfaz de usuario (React) |
| **Backend API** | [http://localhost:8000](http://localhost:8000) | Documentación interactiva Swagger en `/docs` |
| **API Health** | [http://localhost:8000/health](http://localhost:8000/health) | Verificación de estado de la API |
| **Adminer** | [http://localhost:8080](http://localhost:8080) | UI de base de datos (MySQL) |

---

## 🛠 Estructura del Monorepo

- `/frontend`: React 19, Vite, TypeScript, Tailwind CSS 4, TanStack Query.
- `/backend`: FastAPI, Python 3.12, SQLAlchemy 2.0, Alembic, JWT.
- `/docker-compose.yml`: Orquestación de contenedores y redes internas.

## 🔑 Credenciales de Prueba (Adminer)
- **Sistema:** MySQL
- **Servidor:** `db`
- **Usuario:** `user` (según `.env`)
- **Contraseña:** `pass` (según `.env`)
- **Base de datos:** `smarttrack`

---

## 💡 Flujo de Primer Uso
1. Ve a [http://localhost:5173/register](http://localhost:5173/register).
2. Completa el **Onboarding de 5 pasos**.
3. Explora el **Dashboard** y prueba el **Timer** en una tarea.
4. Experimenta con el **Modo Emergencia** (solo líderes/owners) desde el botón en el dashboard.

---
© 2026 SmartTrack MVP Team.
