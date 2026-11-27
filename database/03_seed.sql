-- ============================================================================
-- CRM DE CUENTAS CORRIENTES - TEMA T3
-- Script 03: Datos Semilla (Ficticios para Evaluación Académica)
-- Motor objetivo: PostgreSQL 17+
-- ============================================================================

-- 1. Catálogos base
INSERT INTO tipo_documento (codigo, nombre, longitud_exacta) VALUES
('RUC', 'Registro Único de Contribuyentes', 11),
('DNI', 'Documento Nacional de Identidad', 8),
('CE',  'Carné de Extranjería', NULL),
('PAS', 'Pasaporte', NULL);

INSERT INTO tipo_moneda (codigo, nombre, simbolo) VALUES
('PEN', 'Soles Peruanos', 'S/'),
('USD', 'Dólares Americanos', '$');

INSERT INTO cat_segmento_cliente (codigo, nombre, descripcion, linea_credito_sugerida, dias_plazo_defecto) VALUES
('CORPORATIVO', 'Corporativo', 'Empresas de alta facturación y volumen', 50000.00, 45),
('PYME',        'Pequeña y Mediana Empresa', 'Empresas en crecimiento con crédito estándar', 15000.00, 30),
('MINORISTA',   'Minorista / Persona Natural', 'Clientes de consumo o microempresas', 5000.00, 15);

INSERT INTO tipo_movimiento_cuenta (codigo, nombre, naturaleza, requiere_vencimiento) VALUES
('CARGO_FACTURA',   'Cargo por Factura',       'C', TRUE),
('CARGO_NOTA_DEB',  'Cargo por Nota de Débito','C', TRUE),
('ABONO_PAGO',      'Abono por Pago Recibido', 'A', FALSE),
('ABONO_NOTA_CRED', 'Abono por Nota de Crédito','A', FALSE),
('AJUSTE_CARGO',    'Ajuste Deudor',           'C', FALSE),
('AJUSTE_ABONO',    'Ajuste Acreedor',         'A', FALSE);

INSERT INTO tipo_interaccion (codigo, nombre) VALUES
('LLAMADA',  'Llamada Telefónica'),
('CORREO',   'Correo Electrónico'),
('REUNION',  'Reunión Presencial / Virtual'),
('WHATSAPP', 'WhatsApp'),
('VISITA',   'Visita de Cobranza');

INSERT INTO tipo_estado_movimiento (codigo, nombre, es_final) VALUES
('PENDIENTE', 'Pendiente', FALSE),
('PARCIAL',   'Parcialmente Aplicado', FALSE),
('PAGADO',    'Pagado', TRUE),
('APLICADO',  'Aplicado', TRUE),
('ANULADO',   'Anulado', TRUE);

-- 2. Usuarios de prueba (contraseñas reales hasheadas con bcrypt)
-- admin@crm.example    -> Admin123*
-- analista@crm.example -> Analista123*
INSERT INTO mae_usuario (nombre_completo, email, password_hash, rol) VALUES
('Administrador del Sistema', 'admin@crm.example', '$2b$10$8sKBFauXzeZDcer/x4z5xugVquOsqipQDxM54Jl3dCygo9T5/cy6e', 'ADMIN'),
('Analista de Créditos',      'analista@crm.example', '$2b$10$TUMocD4mRuXj2w3/hpx2O./OnTp6VgvIEa5ksQGcECE2Uvx2NpFcu', 'ANALISTA');

-- 3. Clientes ficticios (Personas Jurídicas y Personas Naturales)
INSERT INTO mae_cliente (
    tipo_persona, id_tipo_documento, numero_documento,
    nombre_completo, razon_social, nombre_comercial,
    id_segmento, email, telefono, direccion, estado, id_usuario_registro
) VALUES
('JURIDICA', 1, '20512345671', NULL, 'Comercializadora Andina S.A.C.', 'Andina SAC', 1, 'finanzas@andina.example.com', '987654321', 'Av. Javier Prado Este 1420, Lima', 'ACTIVO', 1),
('JURIDICA', 1, '20609876542', NULL, 'Distribuidora Pacífico E.I.R.L.', 'Pacífico EIRL', 2, 'cuentas@pacifico.example.com', '984112233', 'Jr. Unión 450, Lima', 'ACTIVO', 1),
('NATURAL',  2, '45678912',    'María Elena Quispe Torres', NULL, 'Bodega Quispe', 3, 'mquispe@example.com', '991223344', 'Av. Los Próceres 310, Lima', 'ACTIVO', 2),
('JURIDICA', 1, '20481122334', NULL, 'Constructora Horizonte S.A.', 'Horizonte SA', 1, 'tesoreria@horizonte.example.com', '999888777', 'Calle Las Begonias 780, Lima', 'BLOQUEADO', 1);

-- 4. Cuentas corrientes iniciales (sin saldo_actual redundante; se calcula en vw_cuenta_saldo)
INSERT INTO mae_cuenta_corriente (id_cliente, id_tipo_moneda, numero_cuenta, linea_credito, estado) VALUES
(1, 1, 'CC-00001-PEN', 50000.00, 'ACTIVA'),
(2, 1, 'CC-00002-PEN', 15000.00, 'ACTIVA'),
(3, 1, 'CC-00003-PEN',  5000.00, 'ACTIVA'),
(4, 1, 'CC-00004-PEN', 40000.00, 'SUSPENDIDA');

-- 5. Movimientos de ejemplo (sin saldo_pendiente ni saldo_resultante redundantes)
-- Cuenta 1 (CC-00001-PEN): Cargo 25000 - Abono 6500 = Saldo 18500
INSERT INTO trs_movimiento_cuenta (id_cuenta, id_tipo_movimiento, id_estado_movimiento, numero_documento_ref, fecha_movimiento, fecha_vencimiento, monto, glosa, id_usuario_registro) VALUES
(1, 1, 2, 'F001-000101', CURRENT_DATE - INTERVAL '20 days', CURRENT_DATE + INTERVAL '25 days', 25000.00, 'Venta de mercadería lote A', 1),
(1, 3, 4, 'OP-77412',    CURRENT_DATE - INTERVAL '10 days', NULL,                              6500.00, 'Pago parcial transferencia BCP', 2);

INSERT INTO trs_aplicacion_pago (id_movimiento_abono, id_movimiento_cargo, monto_aplicado, id_usuario_registro) VALUES
(2, 1, 6500.00, 2);

-- Cuenta 2 (CC-00002-PEN): Cargo 16800 (excede línea de 15000)
INSERT INTO trs_movimiento_cuenta (id_cuenta, id_tipo_movimiento, id_estado_movimiento, numero_documento_ref, fecha_movimiento, fecha_vencimiento, monto, glosa, id_usuario_registro) VALUES
(2, 1, 1, 'F001-000205', CURRENT_DATE - INTERVAL '12 days', CURRENT_DATE + INTERVAL '18 days', 16800.00, 'Despacho de insumos industriales', 1);

-- Cuenta 3 (CC-00003-PEN): Cargo 4400 (88% de 5000 -> próximo al límite)
INSERT INTO trs_movimiento_cuenta (id_cuenta, id_tipo_movimiento, id_estado_movimiento, numero_documento_ref, fecha_movimiento, fecha_vencimiento, monto, glosa, id_usuario_registro) VALUES
(3, 1, 1, 'B001-000890', CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE + INTERVAL '10 days', 4400.00, 'Pedido semanal abarrotes', 2);

-- Cuenta 4 (CC-00004-PEN): Cargo 45200 (excede línea de 40000)
INSERT INTO trs_movimiento_cuenta (id_cuenta, id_tipo_movimiento, id_estado_movimiento, numero_documento_ref, fecha_movimiento, fecha_vencimiento, monto, glosa, id_usuario_registro) VALUES
(4, 1, 1, 'F001-000310', CURRENT_DATE - INTERVAL '35 days', CURRENT_DATE - INTERVAL '5 days', 45200.00, 'Suministro de materiales obra norte', 1);

-- 6. Alertas de crédito iniciales
INSERT INTO trs_alerta_credito (id_cuenta, id_movimiento_origen, tipo_alerta, linea_credito_momento, saldo_momento, monto_excedido, mensaje, estado) VALUES
(2, 3, 'EXCESO_LINEA',   15000.00, 16800.00, 1800.00, 'Cuenta CC-00002-PEN excedió su línea de crédito por 1800.00.', 'ACTIVA'),
(3, 4, 'PROXIMO_LIMITE',  5000.00,  4400.00,    0.00, 'Cuenta CC-00003-PEN alcanzó el 88.0% de su línea de crédito.', 'ACTIVA'),
(4, 5, 'EXCESO_LINEA',   40000.00, 45200.00, 5200.00, 'Cuenta CC-00004-PEN excedió su línea de crédito por 5200.00.', 'ACTIVA');

-- 7. Interacciones y seguimiento
INSERT INTO trs_interaccion_cliente (id_cliente, id_tipo_interaccion, id_usuario, asunto, detalle, resultado, fecha_proximo_seguimiento) VALUES
(2, 1, 2, 'Recordatorio por exceso de línea', 'Se comunicó al área contable sobre el exceso de S/ 1,800.00 en la cuenta.', 'COMPROMISO_PAGO', CURRENT_DATE + INTERVAL '3 days'),
(4, 2, 1, 'Notificación de factura vencida F001-000310', 'Se envió estado de cuenta y aviso de suspensión temporal por exceso de línea.', 'CONTACTADO', CURRENT_DATE + INTERVAL '2 days'),
(1, 3, 2, 'Revisión mensual de línea corporativa', 'Cliente conforme con su línea actual de S/ 50,000.00.', 'CONTACTADO', CURRENT_DATE + INTERVAL '15 days');

-- 8. Conciliación de ejemplo (producto diferenciador)
INSERT INTO trs_conciliacion_cuenta (
    id_cuenta, fecha_inicio, fecha_fin,
    saldo_inicial_sistema, total_cargos_sistema, total_abonos_sistema, saldo_final_sistema,
    saldo_inicial_manual, total_cargos_manual, total_abonos_manual, saldo_final_manual,
    estado, observaciones, id_usuario_concilia
) VALUES (
    1,
    (CURRENT_DATE - INTERVAL '30 days')::date,
    CURRENT_DATE,
    0.00, 25000.00, 6500.00, 18500.00,
    0.00, 25000.00, 6500.00, 18500.00,
    'CONCILIADO',
    'Cierre mensual verificado contra registro auxiliar contable sin diferencias.',
    2
);
