-- =============================================================================
-- Equivalente SQL de la migración Alembic 004_lote_edicion_realizada
-- (PostgreSQL) — solo si la columna aún no existe
-- =============================================================================

ALTER TABLE lote
ADD COLUMN IF NOT EXISTS edicion_realizada boolean NOT NULL DEFAULT false;
