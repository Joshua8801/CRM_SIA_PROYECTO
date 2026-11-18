# CRM de Cuentas Corrientes — Tema T3 (`CRM-ACADEMICO`)

Prototipo académico funcional para la gestión integral de clientes, líneas de crédito, cuentas corrientes, alertas de exceso de crédito, seguimiento de interacciones y conciliación de saldos por período.

---

## A. Presentación

- **Problema que resuelve:** El control manual o disperso de cuentas corrientes de clientes genera inconsistencias en los saldos por cobrar, dificultad para detectar excesos sobre la línea de crédito asignada y falta de trazabilidad en las gestiones de cobranza.
- **Objetivo del sistema:** Proveer una aplicación web cliente-servidor con integridad relacional en PostgreSQL donde los saldos se calculen directamente a partir de movimientos confirmados y aplicaciones de pago, evitando redundancia y errores de sincronización.
- **Alcance funcional:** Gestión completa de cartera de clientes (personas naturales y jurídicas), operación de cuentas corrientes en línea, emisión imprimible de estados de cuenta, alertas automáticas de crédito, bitácora de interacciones y conciliación frente a cálculos manuales.

---

## B. Funcionalidades Implementadas

1. **Registro de clientes naturales y jurídicos:** Validación por tipo de persona (`NATURAL` con `nombre_completo`, `JURIDICA` con `razon_social`) y unicidad por tipo y número de documento.
2. **Segmentación y línea de crédito:** Clasificación en segmentos (`CORPORATIVO`, `PYME`, `MINORISTA`) con asignación y actualización de línea de crédito.
3. **Gestión de cuentas corrientes:** Creación automática de cuenta corriente al registrar un cliente y consulta de saldos calculados en línea.
4. **Registro de cargos y abonos:** Registro transaccional de facturas, notas de débito, pagos, notas de crédito y ajustes, además de anulación controlada.
5. **Aplicación parcial y completa de pagos:** Vinculación de abonos contra cargos pendientes mediante `trs_aplicacion_pago` con bloqueos `FOR UPDATE` y validación estricta de saldos disponibles.
6. **Cálculo de saldos sin redundancia:** Saldos actuales, totales de cargos/abonos y saldos pendientes calculados mediante vistas y funciones SQL (`vw_cuenta_saldo`, `vw_movimiento_saldo`, `fn_resumen_periodo_cuenta`).
7. **Estado de cuenta por período:** Reporte cronológico con saldo inicial, cargos, abonos, saldo final y soporte de impresión (`@media print`).
8. **Alertas de crédito:** Generación y resolución automática de alertas `EXCESO_LINEA` y `PROXIMO_LIMITE` (umbral del 85 % de la línea de crédito) sin duplicados activos.
9. **Historial de interacciones:** Bitácora por cliente con canal de contacto, resultado y fecha de próximo seguimiento.
10. **Conciliación de saldos (producto diferenciador):** Comparación lado a lado entre el cálculo automático del sistema y el cálculo manual ingresado para un período, validando coherencia matemática (`Saldo final = Saldo inicial + Cargos - Abonos`) y registrando diferencias.
11. **Auditoría inmutable:** Registro histórico en `trs_auditoria` con `JSONB` (`datos_anteriores`, `datos_nuevos`) protegido contra modificaciones o eliminaciones mediante trigger.
12. **Dashboard ejecutivo:** Indicadores clave de cartera, resumen por segmento, alertas activas recientes y próximos seguimientos.

---

## C. Tecnologías

| Capa | Tecnologías y versiones reales (`package.json`) |
| :--- | :--- |
| **Frontend** | React `^18.3.1`, TypeScript `^5.6.3`, Vite `^6.0.1`, Tailwind CSS `^4.0.0`, React Router `^6.28.0`, Axios `^1.7.7`, Lucide React `^0.460.0` |
| **Backend** | Node.js, Express `^4.21.1`, TypeScript `^5.6.3`, `pg` `^8.13.1`, `jsonwebtoken` `^9.0.2`, `bcrypt` `^5.1.1`, `cors` `^2.8.5`, `dotenv` `^16.4.5` |
| **Base de datos** | PostgreSQL 17+ (esquema SQL puro, sin ORM) |

---

## D. Arquitectura

El proyecto sigue una arquitectura cliente-servidor modular dividida en cuatro directorios principales:

- **`frontend/`**: Interfaz de usuario SPA en React + TypeScript. Se comunica exclusivamente con el backend mediante peticiones HTTP/JSON usando Axios (`VITE_API_URL`) e interceptor de token Bearer JWT.
- **`backend/`**: API REST en Express (`/api/v1/*`). Es el único componente que se conecta directamente a PostgreSQL mediante `pg.Pool` (`DATABASE_URL`), gestiona autenticación JWT, reglas de negocio, transacciones SQL y auditoría.
- **`database/`**: Scripts SQL de definición de tablas, restricciones, triggers, vistas, funciones, índices y datos semilla.
- **`docs/`**: Diccionario de datos, diagrama ER y guía técnica complementaria.

---

## E. Requisitos Previos

- **Node.js** `>= 20` LTS y **npm** (verificado en entorno con Node `v24.18.0` y npm `11.16.0`).
- **PostgreSQL 17+** (instancia local o servidor universitario) con cliente `psql` disponible.
- **Git** para clonar y colaborar en el repositorio.

---

## F. Instalación desde Cero (PowerShell)

1. **Clonar el repositorio:**
   ```powershell
   git clone <URL_DEL_REPOSITORIO>
   cd CRM-ACADEMICO
   ```

2. **Instalar dependencias del backend:**
   ```powershell
   npm install --prefix backend
   ```

3. **Instalar dependencias del frontend:**
   ```powershell
   npm install --prefix frontend
   ```

4. **Crear y configurar los archivos `.env`:**
   ```powershell
   Copy-Item backend\.env.example backend\.env
   Copy-Item frontend\.env.example frontend\.env
   ```
   Edita `backend/.env` y configura tu `DATABASE_URL` y un `JWT_SECRET` propio:
   ```env
   PORT=4000
   DATABASE_URL=postgresql://crm_admin:TU_PASSWORD@localhost:5433/crm_academico
   DB_SSL=false
   JWT_SECRET=genera_un_secreto_seguro_local
   JWT_EXPIRES_IN=8h
   CORS_ORIGIN=http://localhost:5173
   ```
   Verifica `frontend/.env`:
   ```env
   VITE_API_URL=http://localhost:4000/api/v1
   ```

5. **Crear una base de datos PostgreSQL independiente:**
   ```powershell
   psql -h localhost -p 5433 -U postgres -c "CREATE DATABASE crm_academico;"
   ```
   *(Asegúrate de usar el usuario `crm_admin` con permisos sobre `crm_academico` o tu usuario local configurado en `backend/.env`.)*

6. **Ejecutar los scripts SQL en el orden correcto:**
   ```powershell
   psql -h localhost -p 5433 -U crm_admin -d crm_academico -f database\01_schema.sql
   psql -h localhost -p 5433 -U crm_admin -d crm_academico -f database\02_indexes.sql
   psql -h localhost -p 5433 -U crm_admin -d crm_academico -f database\03_seed.sql
   ```

7. **Iniciar el backend (en una terminal):**
   ```powershell
   npm run dev --prefix backend
   ```

8. **Iniciar el frontend (en otra terminal):**
   ```powershell
   npm run dev --prefix frontend
   ```

9. **Acceder desde el navegador:**
   Abrir `http://localhost:5173`.

---

## G. Base de Datos

- **Motor:** PostgreSQL 17+.
- **Base de datos de referencia:** `crm_academico`.
- **15 tablas exactas:**
  - **Catálogos (6):** `tipo_documento`, `tipo_moneda`, `cat_segmento_cliente`, `tipo_movimiento_cuenta`, `tipo_interaccion`, `tipo_estado_movimiento`.
  - **Maestras (3):** `mae_usuario`, `mae_cliente`, `mae_cuenta_corriente`.
  - **Transaccionales (6):** `trs_movimiento_cuenta`, `trs_aplicacion_pago`, `trs_alerta_credito`, `trs_interaccion_cliente`, `trs_conciliacion_cuenta`, `trs_auditoria`.
- **Orden y función de los scripts (`database/`):**
  1. `01_schema.sql`: Crea las 15 tablas, restricciones `CHECK`/`UNIQUE`, trigger de inmutabilidad en `trs_auditoria`, vistas `vw_movimiento_saldo` y `vw_cuenta_saldo`, y la función `fn_resumen_periodo_cuenta`.
  2. `02_indexes.sql`: Crea los índices de rendimiento e índice único parcial `uq_trs_alerta_activa_unica`.
  3. `03_seed.sql`: Inserta catálogos base, usuarios de demostración y datos ficticios iniciales.
  4. `00_reset_schema.sql`: Script auxiliar para limpiar y recrear únicamente el esquema de `crm_academico` en caso de necesitar reiniciar el entorno desde cero.

---

## H. Pruebas

El backend incluye una suite de verificación funcional de **13 casos de integración** (`backend/tests/verify_t3.ts`) que valida registro de personas naturales/jurídicas, cuentas, cargos, abonos, aplicación parcial, rechazo por exceso de saldo disponible, cálculo de saldos, alertas (85 % y exceso), estado de cuenta por período y conciliaciones (exacta y con diferencia).

Para ejecutarla contra tu base de datos `crm_academico` configurada en `backend/.env`:

```powershell
npm run test:verify --prefix backend
```

> **Nota:** Durante el desarrollo se diseñaron y prepararon los 13 casos de integración; cada integrante puede ejecutar el comando anterior en su propio entorno local una vez aplicada la base de datos y configurado `backend/.env`.

---

## I. Credenciales de Demostración

El script `database/03_seed.sql` crea dos usuarios ficticios con hashes `bcrypt` válidos exclusivamente para pruebas locales:

| Rol | Correo | Contraseña |
| :--- | :--- | :--- |
| `ADMIN` | `admin@crm-t3.edu` | `Admin123*` |
| `ANALISTA` | `analista@crm-t3.edu` | `Analista123*` |

> **Advertencia:** Son credenciales locales de demostración con datos ficticios y **no deben utilizarse en entornos productivos**.

---

## J. Estructura del Proyecto

```text
CRM-ACADEMICO/
├── backend/
│   ├── src/
│   │   ├── config/          # Pool pg y transacciones (db.ts)
│   │   ├── controllers/     # Controladores Express por módulo
│   │   ├── middlewares/     # Autenticación JWT y manejo de errores
│   │   ├── routes/          # Rutas /api/v1/*
│   │   ├── services/        # Lógica de negocio y consultas SQL
│   │   ├── types/           # Tipos TypeScript
│   │   ├── utils/           # Registro de auditoría
│   │   ├── app.ts
│   │   └── server.ts
│   ├── tests/
│   │   └── verify_t3.ts     # Suite de 13 pruebas de integración
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
├── database/
│   ├── 00_reset_schema.sql
│   ├── 01_schema.sql
│   ├── 02_indexes.sql
│   └── 03_seed.sql
├── docs/
│   ├── README.md
│   └── diccionario_datos.md
├── frontend/
│   ├── src/
│   │   ├── components/      # Layout general
│   │   ├── context/         # AuthContext (JWT y catálogos)
│   │   ├── pages/           # Vistas del CRM
│   │   ├── services/        # Cliente Axios
│   │   ├── types/           # Interfaces TypeScript
│   │   ├── utils/           # Formateo de moneda y fechas
│   │   ├── App.tsx
│   │   ├── index.css
│   │   └── main.tsx
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
├── .gitignore
└── README.md
```

---

## K. Seguridad y Configuración

- **Archivos `.env` excluidos:** `.gitignore` protege `.env`, `.env.local` y `**/.env` para evitar subir contraseñas, `DATABASE_URL` o `JWT_SECRET` a GitHub, manteniendo versionadas únicamente las plantillas `.env.example`.
- **Secretos locales:** Cada integrante debe generar su propio `JWT_SECRET` y usar su contraseña local en `backend/.env`.
- **Datos ficticios:** Todos los clientes, documentos, montos y movimientos del seed son ficticios.
- **Despliegue en servidor universitario:** Actualizar `DATABASE_URL` con el host/puerto institucional, activar `DB_SSL=true` si el servidor exige SSL y restringir `CORS_ORIGIN` al dominio del frontend.

---

## L. Trabajo Colaborativo con Git

1. Clonar el repositorio (usando la URL asignada en GitHub) y crear una rama por funcionalidad o corrección:
   ```powershell
   git checkout -b feat/nombre-tarea
   ```
2. Antes de subir cambios, actualizar la rama principal y verificar compilación:
   ```powershell
   git pull origin main
   npm run build --prefix backend
   npm run build --prefix frontend
   ```
3. Confirmar que `git status` no incluya archivos `.env`, `node_modules/` ni `dist/` antes de hacer `git commit` y `git push`.

---

## M. Documentación Adicional

- [Diccionario de Datos y Diagrama ER](docs/diccionario_datos.md)
- [Guía Técnica Complementaria](docs/README.md)
