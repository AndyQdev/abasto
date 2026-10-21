-- Una instancia de PostgreSQL, una base por dueño. Contraseñas solo para desarrollo.
-- Ningún servicio puede entrar a la base de otro.

CREATE ROLE pedidos LOGIN PASSWORD 'pedidos';
CREATE ROLE cobros LOGIN PASSWORD 'cobros' CREATEDB; -- CREATEDB: Prisma Migrate usa una base sombra en desarrollo
CREATE ROLE reportes LOGIN PASSWORD 'reportes';
CREATE ROLE keycloak LOGIN PASSWORD 'keycloak';

-- El MCP del Asistente entra con este rol: solo lectura, 5 segundos como máximo.
CREATE ROLE mcp_lector LOGIN PASSWORD 'mcp_lector';
ALTER ROLE mcp_lector SET default_transaction_read_only = on;
ALTER ROLE mcp_lector SET statement_timeout = '5s';

CREATE DATABASE pedidos OWNER pedidos;
CREATE DATABASE cobros OWNER cobros;
CREATE DATABASE reportes OWNER reportes;
CREATE DATABASE keycloak OWNER keycloak;

REVOKE ALL ON DATABASE pedidos FROM PUBLIC;
REVOKE ALL ON DATABASE cobros FROM PUBLIC;
REVOKE ALL ON DATABASE reportes FROM PUBLIC;
REVOKE ALL ON DATABASE keycloak FROM PUBLIC;

GRANT CONNECT ON DATABASE reportes TO mcp_lector;
