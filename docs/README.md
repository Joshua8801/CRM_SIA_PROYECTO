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

### Actualización de alertas y comprobantes

Con Docker, un volumen existente requiere ejecutar las migraciones de forma explícita. Aplique los scripts en orden y verifique que el primero termine correctamente antes de ejecutar el siguiente.

```powershell
Get-Content -Raw database\05_fix_alertas_abiertas.sql | docker exec -i crm_postgres17 psql -U crm_admin -d crm_academico -v ON_ERROR_STOP=1
Get-Content -Raw database\06_comprobantes_vigentes.sql | docker exec -i crm_postgres17 psql -U crm_admin -d crm_academico -v ON_ERROR_STOP=1
```

Para una instalación manual nueva, ejecute el script 06 después de la semilla de catálogos. Docker ejecuta los archivos ordenados en un volumen nuevo. Si la migración identifica duplicados, informa las cuentas y los identificadores de los registros afectados y revierte la transacción.

Las alertas activas y revisadas se consideran abiertas. Para facturas, notas de débito y notas de crédito, el número de comprobante es obligatorio en el registro. La unicidad considera cuenta, tipo y número sin espacios ni distinción de mayúsculas. Un comprobante anulado conserva su historial y libera el número para un nuevo registro. Los ajustes y pagos sin referencia siguen siendo válidos. El estado imprimible muestra las aplicaciones registradas al momento de consultar cada abono del período. El pago se cuenta una sola vez en los totales.

## 3. Comandos de Compilación y Verificación

```powershell
# Compilar backend (tsc)
npm run build --prefix backend

# Compilar frontend (tsc -b && vite build)
npm run build --prefix frontend

# Ejecutar la suite de integración contra una base de pruebas
npm run test:verify --prefix backend
```

---

## 4. Modelo de Datos y Diagrama ER

Consulta el detalle de las 15 tablas, restricciones, vistas (`vw_movimiento_saldo`, `vw_cuenta_saldo`), función (`fn_resumen_periodo_cuenta`) y diagrama entidad-relación en [diccionario_datos.md](diccionario_datos.md).
