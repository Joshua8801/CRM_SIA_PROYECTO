# Guía Técnica Complementaria — CRM de Cuentas Corrientes (Tema T3)

Para la presentación general, requisitos e instalación desde cero en una computadora nueva, consulta el [README principal](../README.md).

---

## 1. Endpoints de la API REST (`/api/v1`)

| Módulo | Ruta Base | Descripción |
| :--- | :--- | :--- |
| Salud | `GET /api/v1/health` | Verificación de estado del servicio |
| Autenticación | `POST /api/v1/auth/login`, `GET /api/v1/auth/me` | Inicio de sesión JWT y perfil autenticado |
| Catálogos | `GET /api/v1/catalogos` | Carga de los 6 catálogos activos |
| Dashboard | `GET /api/v1/dashboard` | KPIs de cartera, alertas activas y seguimientos |
| Clientes | `GET/POST/PUT /api/v1/clientes` | Gestión de personas naturales/jurídicas y segmento |
| Cuentas | `GET/PATCH /api/v1/cuentas`, `GET /api/v1/cuentas/:id/estado-cuenta` | Saldos calculados en línea y estado de cuenta por período |
| Movimientos | `POST /api/v1/movimientos`, `POST /api/v1/movimientos/aplicar-pago`, `POST /api/v1/movimientos/:id/anular` | Cargos, abonos, aplicación parcial/total y anulación |
| Alertas | `GET /api/v1/alertas`, `PATCH /api/v1/alertas/:id/estado` | Bandeja de alertas de crédito (`EXCESO_LINEA`, `PROXIMO_LIMITE`) |
| Interacciones | `GET/POST /api/v1/interacciones` | Bitácora de interacciones y próximos seguimientos |
| Conciliaciones | `GET/POST /api/v1/conciliaciones`, `GET /api/v1/conciliaciones/preview` | Comparación sistema vs. cálculo manual por período |

---

## 2. Recreación del Esquema en `crm_academico`

Si durante el desarrollo necesitas limpiar y recrear únicamente el esquema de **`crm_academico`** (sin afectar otras bases de datos):

```powershell
psql -h localhost -p 5433 -U crm_admin -d crm_academico -f database\01_schema.sql
psql -h localhost -p 5433 -U crm_admin -d crm_academico -f database\02_indexes.sql
psql -h localhost -p 5433 -U crm_admin -d crm_academico -f database\03_seed.sql
```

### Actualización de bases existentes (Migración `04_fix_conciliacion_constraint.sql`)

Para bases de datos ya creadas anteriormente, ejecuta la migración de conciliación:

```powershell
Get-Content -Raw database\04_fix_conciliacion_constraint.sql | docker exec -i crm_postgres17 psql -U crm_admin -d crm_academico
```

Esta migración reclasifica automáticamente a `CON_DIFERENCIA` cualquier conciliación histórica marcada como `CONCILIADO` que presente diferencias compensadas en `saldo_inicial`, `total_cargos`, `total_abonos` o `saldo_final`, conservando intactos todos los importes guardados, y actualiza la restricción `chk_trs_concil_estado_coherente`.

## 3. Comandos de Compilación y Verificación

```powershell
# Compilar backend (tsc)
npm run build --prefix backend

# Compilar frontend (tsc -b && vite build)
npm run build --prefix frontend

# Ejecutar suite de 13 pruebas de integración contra crm_academico
npm run test:verify --prefix backend
```

---

## 4. Modelo de Datos y Diagrama ER

Consulta el detalle de las 15 tablas, restricciones, vistas (`vw_movimiento_saldo`, `vw_cuenta_saldo`), función (`fn_resumen_periodo_cuenta`) y diagrama entidad-relación en [diccionario_datos.md](diccionario_datos.md).
