-- =============================================================================
-- Recalculación de peso total de lotes (PostgreSQL)
-- =============================================================================
-- Criterio alineado con la aplicación:
--   - cantidad_kg = kg **por unidad física**
--   - Peso de línea (kg) = cantidad_kg * unidades (solo si unidades > 0)
--   - peso_total_recibido del lote = SUM(peso de línea) de sus productos
--   - cantidad_tm = cantidad_kg / 1000 (TM por unidad)
--
-- Ejecutar contra la misma base que usa el backend, por ejemplo:
--   psql "$DATABASE_URL" -f backend/scripts/recalc_peso_total_lotes.sql
-- =============================================================================

BEGIN;

-- 1) Sincronizar TM por unidad desde kg por unidad (coherencia kg ↔ tm)
UPDATE producto
SET cantidad_tm = ROUND((COALESCE(cantidad_kg, 0) / 1000.0)::numeric, 6);

-- 2) Actualizar peso total de cada lote que tenga al menos un producto
UPDATE lote AS l
SET peso_total_recibido = COALESCE(s.peso_calc, 0)
FROM (
    SELECT
        id_lote,
        ROUND(
            SUM(
                CASE
                    WHEN COALESCE(unidades, 0) > 0 THEN
                        COALESCE(cantidad_kg, 0)::numeric * unidades::numeric
                    ELSE 0::numeric
                END
            ),
            6
        ) AS peso_calc
    FROM producto
    GROUP BY id_lote
) AS s
WHERE l.id_lote = s.id_lote;

-- 3) Lotes sin productos: peso total en 0
UPDATE lote AS l
SET peso_total_recibido = 0
WHERE NOT EXISTS (
    SELECT 1 FROM producto p WHERE p.id_lote = l.id_lote
);

COMMIT;

-- =============================================================================
-- OPCIONAL (NO EJECUTAR sin revisar): datos antiguos donde cantidad_kg era
-- el peso **total de la línea** (no por unidad). Descomenta solo si aplica.
-- Convierte a kg por unidad: cantidad_kg_nuevo = cantidad_kg / unidades
-- =============================================================================
-- BEGIN;
-- UPDATE producto
-- SET
--   cantidad_kg = ROUND((COALESCE(cantidad_kg, 0) / NULLIF(unidades, 0))::numeric, 6),
--   cantidad_tm = ROUND(
--     ((COALESCE(cantidad_kg, 0) / NULLIF(unidades, 0)) / 1000.0)::numeric,
--     6
--   )
-- WHERE COALESCE(unidades, 0) > 0;
-- COMMIT;
-- Luego vuelve a ejecutar el bloque principal de este archivo (pasos 1–3).
