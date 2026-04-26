# Guía: edición única de lotes y registro de auditoría

Esta guía describe el flujo por fases para desplegar, probar y mantener la funcionalidad de **una sola edición por lote** (nombre, proveedor, productos) y el **registro visible** debajo de la tabla en Gestión de Lotes.

## Fase 1 — Base de datos

1. Asegurar que la migración que añade `lote.edicion_realizada` (por ejemplo `004_lote_edicion_realizada`) esté aplicada:
   - `cd backend && alembic upgrade head`
2. Comprobar que los lotes existentes tienen `edicion_realizada = false` por defecto.

## Fase 2 — Backend

1. **GET** `/api/v1/lotes/{id}` devuelve `edicion_realizada`, `registro_edicion` (auditoría `EDICION_UNICA` cuando aplica) y productos.
2. **PUT** `/api/v1/lotes/{id}/edicion-unica` aplica cambios una sola vez: valida lote activo, proveedor, número único, mismo conjunto de `id_producto`, recalcula peso total y escribe **Auditoría**.
3. **PUT** `/api/v1/lotes/{id}` rechaza cambios sensibles si `edicion_realizada` es verdadero (según implementación actual).

## Semántica de peso (recepción y lotes)

- En cada producto, **`cantidad_kg`** y **`cantidad_tm`** son **por unidad física** (no el total de la línea).
- **Peso de línea (kg)** = `cantidad_kg × unidades`.
- **Peso total del lote** = suma de las líneas. Al editar kg o TM en un ítem, el otro se sincroniza (kg ↔ tm por unidad).

Los lotes o productos cargados antes de este criterio pueden requerir revisión manual de datos.

## Fase 3 — Frontend (Gestión de Lotes)

1. El listado muestra **Editar** solo si el lote está **Activo** y `!edicion_realizada`.
2. El diálogo llama a `LotesService.edicionUnicaLote` y, al guardar, invalida queries de lotes y estadísticas.
3. Debajo de la tabla, el panel **Registro de edición única** lista lotes de la página actual con edición y muestra usuario, ID, fecha, resumen y variación de peso (desde `detalle.peso_kg`).

## Fase 4 — Verificación manual

1. **Recepción** (`/recepciones`): crear un lote nuevo; debe seguir funcionando; el nuevo lote debe poder editarse una vez desde Lotes.
2. En **Lotes**: editar un lote activo, guardar; el botón Editar debe desaparecer y el registro debe mostrar la auditoría.
3. Intentar editar de nuevo (no debe aparecer el botón o el API debe rechazar).

## Fase 5 — Comprobación cruzada con recepciones

- La ruta `frontend/src/routes/_layout/recepciones.tsx` solo monta `RecepcionLotes`; no depende de `edicion_realizada`.
- Si algo falla, revisar que el cliente OpenAPI esté regenerado si cambian los esquemas (`npm run generate-client` en `frontend`).
