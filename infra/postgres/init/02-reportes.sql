-- Corre como superusuario al crear la base. Cierra funciones peligrosas en `reportes`
-- para todos los roles sin privilegios, incluido mcp_lector. Es una barrera más,
-- además de la guardia de SQL, la transacción de solo lectura y la seguridad por fila.
\connect reportes
REVOKE EXECUTE ON FUNCTION pg_catalog.set_config(text, text, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION pg_catalog.pg_sleep(double precision) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION pg_catalog.pg_sleep_for(interval) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION pg_catalog.pg_sleep_until(timestamp with time zone) FROM PUBLIC;
