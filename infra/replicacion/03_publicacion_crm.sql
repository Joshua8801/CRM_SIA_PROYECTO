ALTER TABLE public.mae_cliente
    ALTER COLUMN id_cliente SET INCREMENT BY 2;

ALTER TABLE public.mae_cliente
    ALTER COLUMN id_cliente RESTART WITH :id_inicial;

ALTER TABLE public.mae_cuenta_corriente
    ALTER COLUMN id_cuenta SET INCREMENT BY 2;

ALTER TABLE public.mae_cuenta_corriente
    ALTER COLUMN id_cuenta RESTART WITH :id_inicial;

ALTER TABLE public.trs_auditoria
    ALTER COLUMN id_auditoria SET INCREMENT BY 2;

ALTER TABLE public.trs_auditoria
    ALTER COLUMN id_auditoria RESTART WITH :id_inicial;

CREATE PUBLICATION pub_crm_alta
FOR TABLE
    public.mae_cliente,
    public.mae_cuenta_corriente,
    public.trs_auditoria;