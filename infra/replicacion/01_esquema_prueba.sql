CREATE TABLE public.prueba_replicacion (
    id INTEGER PRIMARY KEY,
    origen CHAR(1) NOT NULL CHECK (origen IN ('A', 'B')),
    descripcion TEXT NOT NULL
);

CREATE PUBLICATION pub_prueba
FOR TABLE public.prueba_replicacion;

SELECT COUNT(*) AS registros_iniciales
FROM public.prueba_replicacion;