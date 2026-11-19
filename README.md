# CRM-ACADEMICO

Sistema CRM académico para la gestión de clientes, líneas de crédito, cuentas corrientes, alertas, interacciones y conciliación de saldos, desarrollado con React, Vite, Node.js, Express, TypeScript y PostgreSQL 17 mediante Docker Compose.

---

## 1. Instalación Rápida (Escenario A: Instalación Nueva Automática)

Cuando un integrante nuevo parte de un volumen vacío, PostgreSQL 17 ejecuta automáticamente los scripts `database/01_schema.sql`, `database/02_indexes.sql` y `database/03_seed.sql` mediante `/docker-entrypoint-initdb.d/` la primera vez que se inicia el contenedor.

> Si el volumen `crm-cuentas-corrientes_postgres_data` ya contiene una base de datos inicializada, PostgreSQL **omite** `/docker-entrypoint-initdb.d/` y conserva intactos todos los datos existentes.

### 1.1. Requisitos previos
- **Git**
- **Docker Desktop** con **Docker Compose v2**

Verificar en PowerShell:
```powershell
git --version
docker --version
docker compose version
```

### 1.2. Clonar el repositorio
```powershell
git clone <URL_DEL_REPOSITORIO>
cd CRM-ACADEMICO
```

### 1.3. Configurar variables de entorno
Copiar las plantillas de configuración:
```powershell
Copy-Item .env.example .env
Copy-Item backend\.env.example backend\.env
```

Editar **`.env`** (raíz) con una contraseña segura:
```env
POSTGRES_DB=crm_academico
POSTGRES_USER=crm_admin
POSTGRES_PASSWORD=CAMBIAR_POR_UNA_CLAVE_SEGURA
CORS_ORIGIN=http://localhost:5173
```

Editar **`backend/.env`** y definir al menos un `JWT_SECRET` seguro y propio antes de iniciar Docker (no usar valores de ejemplo ni compartir el archivo).

> Para ejecutar con Docker Compose no es necesario crear `frontend/.env`; en Docker el frontend compila con `VITE_API_URL=/api/v1` y consume la API mediante el proxy reverso de Nginx.

### 1.4. Construir e iniciar todos los servicios
Docker Compose crea automáticamente el volumen `crm-cuentas-corrientes_postgres_data` si no existe, o lo reutiliza si ya existe en tu equipo:

```powershell
docker compose up -d --build
```

### 1.5. Comprobar que los contenedores estén saludables
```powershell
docker compose ps
```
Los tres servicios (`crm_postgres17`, `crm_backend`, `crm_frontend`) deben mostrarse en estado **`healthy`**.

### 1.6. Acceder al frontend y verificar la API
- **Frontend:** `http://localhost:5173`
- **API Health:** `http://localhost:5173/api/v1/health` (debe responder `{"status":"ok","service":"crm-academico-api"}`)

**Credenciales de demostración (cargadas automáticamente por `03_seed.sql`, solo uso local):**
- **Administrador:** `admin@crm-t3.edu` / `Admin123*`
- **Analista:** `analista@crm-t3.edu` / `Analista123*`

---

## 2. Comandos Útiles de Docker

| Acción | Comando (PowerShell) |
| :--- | :--- |
| Validar sintaxis de Compose | `docker compose config --quiet` |
| Iniciar servicios | `docker compose up -d` |
| Construir e iniciar | `docker compose up -d --build` |
| Consultar estado y salud | `docker compose ps` |
| Ver logs de todos los servicios | `docker compose logs -f` |
| Ver logs del backend | `docker compose logs -f backend` |
| Ver logs del frontend | `docker compose logs -f frontend` |
| Ver logs de PostgreSQL | `docker compose logs -f postgres` |
| Detener servicios (conservando datos) | `docker compose stop` |
| Detener y quitar contenedores (conservando volumen) | `docker compose down` |

> **Advertencia:** No ejecutar `docker compose down -v` ni `docker volume rm`, ya que eliminarían el volumen persistente de PostgreSQL.

---

## 3. Escenario B: Recuperación desde un Backup Existente (Opcional)

Si necesitas restaurar una copia existente (`backups/crm_academico_backup.sql`, obtenida por un medio seguro fuera de GitHub) en una instalación nueva:

1. **No mezcles** la inicialización automática de `database/*.sql` con la restauración del backup.
2. Si deseas restaurar el backup sobre una base vacía, comenta temporalmente la línea `- ./database:/docker-entrypoint-initdb.d:ro` en `docker-compose.yml` antes de iniciar por primera vez y levanta solo PostgreSQL (Docker Compose creará el volumen vacío automáticamente):
   ```powershell
   docker compose up -d postgres
   ```
3. Restaura el respaldo SQL cuando `crm_postgres17` esté `healthy`:
   ```powershell
   Get-Content -Raw backups\crm_academico_backup.sql | docker exec -i crm_postgres17 psql -U crm_admin -d crm_academico
   ```
4. Verifica las 15 tablas y levanta el resto del stack:
   ```powershell
   docker exec crm_postgres17 psql -U crm_admin -d crm_academico -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';"
   docker compose up -d --build
   ```

> **Importante:** Nunca restaures un backup sobre una base de datos que ya contenga información sin autorización y una copia de seguridad previa.

---

## 4. Arquitectura, Puertos y Personalización

- **Frontend (`crm_frontend`):** React + Vite servido por Nginx en `http://localhost:${FRONTEND_PORT}` (por defecto `5173`; proxy reverso `/api/` -> `http://backend:4000`).
- **Backend (`crm_backend`):** Node.js 22 + Express + TypeScript en puerto interno `4000` dentro de `crm_network` (no se publica al host), conectado a PostgreSQL mediante `postgres:5432`.
- **Base de datos (`crm_postgres17`):** PostgreSQL 17 en `localhost:${POSTGRES_PORT}` (por defecto `5433`, interno `5432`), con persistencia en el volumen `crm-cuentas-corrientes_postgres_data` (administrado por Docker Compose).

### Cambiar puertos si `5173` o `5433` están ocupados

1. **Comprobar en PowerShell si los puertos están ocupados:**
   ```powershell
   Get-NetTCPConnection -LocalPort 5173, 5433 -ErrorAction SilentlyContinue | Select-Object LocalPort, State, OwningProcess
   ```

2. **Configurar puertos personalizados en `.env` (raíz):**
   Si cambias `FRONTEND_PORT`, actualiza también `CORS_ORIGIN` para que coincida con la URL del navegador. Por ejemplo, usando `5174` y `5434`:
   ```env
   POSTGRES_PORT=5434
   FRONTEND_PORT=5174
   CORS_ORIGIN=http://localhost:5174
   ```
   *(La conexión interna del backend dentro de Docker sigue siendo `postgres:5432`; no uses `POSTGRES_PORT` en `DATABASE_URL` dentro de Docker.)*

3. **Aplicar los cambios de `.env` sin perder datos:**
   ```powershell
   docker compose up -d
   ```

4. **Ejemplos de acceso con puertos personalizados:**
   - Aplicación web: `http://localhost:5174`
   - API Health: `http://localhost:5174/api/v1/health`
   - PostgreSQL desde el host (DBeaver / `psql` / modo dev): `localhost:5434`

---

## 5. Ejecución en Modo Desarrollo (Fuera de Docker)

También es posible ejecutar backend y frontend localmente con PostgreSQL disponible en `localhost:5433`:

```powershell
# Backend
npm install --prefix backend
npm run dev --prefix backend

# Frontend (requiere frontend/.env con VITE_API_URL=http://localhost:4000/api/v1)
npm install --prefix frontend
npm run dev --prefix frontend
```

---

## 6. Estructura del Proyecto

```text
CRM-ACADEMICO/
├── backend/                  # API REST (Node.js + Express + TypeScript)
│   ├── src/
│   ├── tests/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── .env.example
│   ├── package.json
│   └── package-lock.json
├── database/                 # Scripts de inicialización automática (PostgreSQL)
│   ├── 01_schema.sql
│   ├── 02_indexes.sql
│   └── 03_seed.sql
├── docs/                     # Documentación técnica y diccionario de datos
│   ├── README.md
│   └── diccionario_datos.md
├── frontend/                 # SPA React + Vite + Nginx
│   ├── src/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── nginx.conf
│   ├── .env.example
│   ├── package.json
│   └── package-lock.json
├── backups/                  # Respaldos locales (excluido de Git)
├── .env.example
├── .gitignore
├── docker-compose.yml
└── README.md
```

---

## 7. Seguridad y Documentación Adicional

- No subir archivos `.env` reales, contraseñas, `JWT_SECRET` ni respaldos de `backups/` a GitHub (protegidos por `.gitignore`).
- Para despliegue en servidor universitario, revisar [Guía Técnica Complementaria](docs/README.md) y [Diccionario de Datos](docs/diccionario_datos.md).
