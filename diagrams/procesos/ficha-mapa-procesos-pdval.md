# Ficha y mapa de procesos — PDVAL (pyllren)

Sistema de **inventario de almacén** (SPA React + API FastAPI): registro de cargas por lote, catálogo de productos, proveedores y fabricantes, reportes y administración de usuarios.

## 1. Alcance y actores

| Actor | Rol en el proceso |
|-------|-------------------|
| Usuario operativo | Recepciona lotes, consulta lotes/productos, gestiona proveedores/fabricantes según permisos. |
| Administrador (superusuario) | Alta/edición de usuarios y alcance; acceso completo a módulos. |
| Sistema | Valida JWT, aplica reglas de negocio (edición única de lote, cierre, auditoría). |

## 2. Mapa macro (navegación)

Archivo fuente: [`mapa-macro-flujo.mmd`](./mapa-macro-flujo.mmd).

```mermaid
flowchart TB
    subgraph acceso["Acceso"]
        INI([Inicio])
        INI --> AUTH{¿Usuario autenticado?}
        AUTH -->|No| LOGIN[Pantalla login / recuperación de contraseña]
        AUTH -->|Sí| APP[Aplicación — layout principal]
        LOGIN --> AUTH
    end

    subgraph modulos["Módulos operativos"]
        APP --> DASH[Inicio / Dashboard]
        APP --> REC[Recepción de lotes]
        APP --> LOT[Gestión de lotes]
        APP --> PRD[Productos]
        APP --> PRV[Proveedores]
        APP --> FAB[Fabricantes]
        APP --> REP[Reportes PDF/Excel]
        APP --> CFG[Configuración]
    end

    subgraph admin["Solo superusuario"]
        APP --> ADM[Administración de usuarios]
    end
```

## 3. Flujo — Recepción de lotes

Archivo fuente: [`flujo-recepcion-lote.mmd`](./flujo-recepcion-lote.mmd).

```mermaid
flowchart TB
    A([Inicio]) --> B[Seleccionar proveedor]
    B --> C[Completar datos del lote — observaciones]
    C --> D[Agregar líneas de producto]
    D --> E{¿Proveedor y al menos un producto válido?}
    E -->|No| D
    E -->|Sí| F[Calcular peso total de la carga]
    F --> G[Enviar POST /api/v1/lotes/recepcion]
    G --> H{¿Respuesta OK?}
    H -->|No| I[Mostrar error — corregir formulario]
    I --> D
    H -->|Sí| J[Lote y productos guardados]
    J --> K([Fin — consulta en Lotes / Productos])
```

## 4. Flujo — Gestión de lotes

Archivo fuente: [`flujo-gestion-lotes.mmd`](./flujo-gestion-lotes.mmd).

```mermaid
flowchart TB
    A([Inicio]) --> B[Listar y filtrar lotes]
    B --> C[Ver detalle del lote y productos]
    B --> D{¿Acción sobre el lote?}

    D -->|Edición única| E{¿Activo y sin edición previa?}
    E -->|Sí| F[Editar número, proveedor y productos una sola vez]
    F --> G[PUT edición única + registro auditoría]
    E -->|No| B

    D -->|Cerrar lote| H[Marcar lote cerrado]
    D -->|Eliminar| I[Eliminación forzada si aplica]
    D -->|Solo consulta| C

    C --> J([Fin])
    G --> J
    H --> J
    I --> J
```

## 5. Referencia rápida de módulos (frontend)

Definición del menú: `frontend/src/components/Common/SidebarItems.tsx`. Rutas bajo `frontend/src/routes/_layout/`.

| Módulo | Descripción breve |
|--------|-------------------|
| Inicio | Resumen y estadísticas. |
| Recepción de lotes | Alta de lote con líneas de producto. |
| Lotes | Listado, detalle, edición única, cierre. |
| Productos | Catálogo y stock por producto. |
| Proveedores | ABM de proveedores. |
| Fabricantes | ABM de fabricantes. |
| Reportes | Exportación PDF/Excel. |
| Configuración | Preferencias de usuario. |
| Administración | Usuarios (solo superusuario). |

## 6. Cómo visualizar los diagramas

- **Mermaid Live Editor**: pegar el contenido de los `.mmd` en [https://mermaid.live](https://mermaid.live).
- **VS Code / Cursor**: extensión “Mermaid” o vista previa Markdown de este archivo.
- **Secuencias técnicas** (API, transacciones): `diagrams/sequences/`.
