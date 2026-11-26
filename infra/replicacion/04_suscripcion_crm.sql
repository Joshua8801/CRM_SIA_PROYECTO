\getenv lab_password POSTGRES_PASSWORD

SELECT format(
    'host=%s port=5432 dbname=crm_replica_lab user=lab_admin password=%s',
    :'nodo_remoto',
    :'lab_password'
) AS conexion
\gset

CREATE SUBSCRIPTION :"nombre_suscripcion"
CONNECTION :'conexion'
PUBLICATION pub_crm_alta
WITH (origin = none, copy_data = false);