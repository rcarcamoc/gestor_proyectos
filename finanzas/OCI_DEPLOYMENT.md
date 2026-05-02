# Guía de Despliegue en Oracle Cloud Infrastructure (OCI)

Esta guía detalla los pasos para desplegar la plataforma en el Free Tier de OCI.

## 1. Preparación de la Instancia (Compute)
1. En la consola de OCI, ve a **Compute > Instances**.
2. Haz clic en **Create Instance**.
3. Elige **Oracle Linux 8** o **Ubuntu 22.04**.
4. **Shape:** Selecciona \`VM.Standard.A1.Flex\` (ARM Ampere) si está disponible, o \`VM.Standard.E2.1.Micro\` (AMD).
5. Descarga tu llave privada SSH.

## 2. Instalación de Docker
Conéctate por SSH a tu instancia y ejecuta:
```bash
# Para Ubuntu
sudo apt update
sudo apt install docker.io docker-compose-v2 -y
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
# Cierra sesión y vuelve a entrar para aplicar cambios de grupo
```

## 3. Configuración de Red (VCN)
Para que la app sea accesible:
1. En OCI, ve a la **VCN** de tu instancia.
2. En **Security Lists**, agrega una **Ingress Rule**:
   - **Source CIDR:** 0.0.0.0/0
   - **Protocol:** TCP
   - **Destination Port Range:** 80 (Portal), 3306 (MySQL opcional)

## 4. Despliegue del Portal Unificado
El portal utiliza Docker Compose para levantar todos los servicios (Base de Datos, Redis, Backend, Frontend).

1. Clona el repositorio:
   ```bash
   git clone https://github.com/rcarcamoc/gestor_proyectos.git portal
   cd portal
   ```
2. Configura los archivos `.env` necesarios.
3. Despliega con Docker Compose V2:
   ```bash
   docker compose up -d --build
   ```

## 6. Configuración de Inbound Email (Mailgun)
1. En Mailgun, ve a **Receiving > Routes**.
2. Crea una ruta:
   - **Expression:** \`match_recipient("tus-finanzas@tu-dominio.com")\`
   - **Action:** \`forward("https://tu-ip-o-dominio:3000/api/import/mailgun")\`
   - **Description:** Forward to Finance Web App.
3. Asegúrate de configurar el \`MAILGUN_API_KEY\` en tu \`.env\` para la validación de firmas.
