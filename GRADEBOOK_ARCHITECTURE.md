# Arquitectura de Flujo de Datos — Gradebook

## Visión General

El gradebook implementa un patrón de **caching + re-transformación dinámica**. Los datos se cargan UNA SOLA VEZ del API, se guardan en caché, y se re-transforman cuando cambian:
- La **ruta de navegación** (classid, unidid, lessonid, etc.)
- La **vista actual** (parámetros de visualización vía query params)

---

## Flujo de Datos

```
┌─────────────────────────────────────────────────────────────┐
│                    GradebookLayoutComponent                  │
│                    (orquestador central)                     │
└──────────────┬──────────────────────────────┬────────────────┘
               │                              │
    [ngOnInit] │                              │ [ngOnInit]
               ↓                              ↓
    ┌──────────────────┐           ┌──────────────────┐
    │ GradebookApiService          │ ActivatedRoute   │
    │ (HTTP GET /api/gradebook)    │ (sync params)    │
    └──────────────┬───────────────┴────────────────┬─┘
                   │                                │
        [datos DTO crudos]                 [params de ruta]
                   │                                │
                   ↓                                ↓
    ┌────────────────────────────────────────────────────┐
    │         GradebookStateService                      │
    │  • rawData (caché — no se re-pide)                │
    │  • routeParams (classid, unidid, lessonid...)     │
    └────────────────┬──────────────────────────────────┘
                     │
        ┌────────────┴──────────────┐
        │                           │
        │    [effect en Layout]     │
        │                           │
        ↓                           ↓
    [rawData changed]      [routeParams changed]
        │                           │
        └────────────────┬──────────┘
                         │
                         ↓
    ┌────────────────────────────────────────────────────┐
    │       GradebookViewService                         │
    │  • viewParams (desde query params de URL)         │
    │    Ej: ?viewMode=schedule&sortBy=name             │
    └────────────────┬──────────────────────────────────┘
                     │
        ┌────────────┴──────────────┐
        │                           │
        │   [effect en Layout]      │
        │                           │
        ↓                           ↓
    [viewParams changed]   [effect triggered]
        │                           │
        └────────────────┬──────────┘
                         │
                         ↓
    ┌────────────────────────────────────────────────────┐
    │      GradebookDataService.transform()              │
    │  (transform(rawData, routeParams, viewParams))     │
    │                                                     │
    │  • Filtra/agrupa datos según routeParams          │
    │  • Cambia formato según viewParams.viewMode       │
    │  • Genera cellClasses dinámicamente                │
    │  • Añade collapsed: false a grupos                 │
    │  • Calcula totales (studentCount, totalCols)      │
    └────────────────┬──────────────────────────────────┘
                     │
           [datos procesados]
                     │
                     ↓
    ┌────────────────────────────────────────────────────┐
    │  GradebookStateService.updateProcessedData()       │
    │  • headerRows                                       │
    │  • groups (con collapsed)                          │
    │  • cellClasses                                      │
    │  • totalCols, studentCount                         │
    └────────────────┬──────────────────────────────────┘
                     │
                     ↓
    ┌────────────────────────────────────────────────────┐
    │            Componentes Visuales                     │
    │  • GradebookTableComponent (consume state)         │
    │  • GradebookHeaderComponent                         │
    │  • GradebookFooterComponent                         │
    └────────────────────────────────────────────────────┘
```

---

## Ciclos de Vida

### 1️⃣ Inicialización (ngOnInit)

```typescript
// 1. Cargar datos del API UNA SOLA VEZ
this.api.load()
  .subscribe(rawData => {
    this.state.rawData.set(rawData);  // Guardar en caché
  });

// 2. Leer parámetros de ruta
this.route.paramMap.subscribe(paramMap => {
  this.state.routeParams.set({ classid, unidid, ... });
});

// 3. Leer query params (parámetros de vista)
this.route.queryParamMap.subscribe(queryParamMap => {
  this.viewService.setViewParams({ viewMode, ... });
});
```

### 2️⃣ Effect — Re-transformación Automática

```typescript
effect(() => {
  const rawData = this.state.rawData();           // Signal 1
  const routeParams = this.state.routeParams();   // Signal 2
  const viewParams = this.viewService.viewParams(); // Signal 3

  // Se ejecuta automáticamente cuando ANY signal cambia
  const processed = this.dataService.transform(rawData, routeParams, viewParams);

  // Actualizar estado con datos procesados
  this.state.updateProcessedData(processed);
});
```

**Cuándo se ejecuta:**
- ✅ Primera carga (rawData pasa de null → datos)
- ✅ Navegas a otra ruta (routeParams cambia)
- ✅ Activas un switch en footer (viewParams cambia)

**Cuándo NO se ejecuta:**
- ❌ Collapse/expand de grupo (ese cambio es local, no dispara re-transformación)

---

## Ejemplo: Usuario Navega

### Escenario: De `/gradebook/123` a `/gradebook/123/456`

```
Estado inicial:
  rawData: { headerRows, groups[] }  ← ya cacheado
  routeParams: { classid: '123' }

Usuario hace click en Unit 456
  ↓
URL cambia a /gradebook/123/456
  ↓
route.paramMap emite nuevo evento
  ↓
this.state.routeParams.set({ classid: '123', unidid: '456' })
  ↓
Effect se dispara (routeParams cambió)
  ↓
transform(rawData, { classid: '123', unidid: '456' }, viewParams)
  ↓
Retorna datos filtrados/procesados para ese contexto
  ↓
updateProcessedData() actualiza estado
  ↓
GradebookTableComponent re-renderiza (automático por signals)

✅ TODO sin hacer GET nuevamente al API
✅ TODO en <100ms (transformación es rápida)
```

---

## Ejemplo: Usuario Activa un Switch

### Escenario: Cambiar de `viewMode=grades` a `viewMode=schedule`

```
Estado actual:
  rawData: { ... }  ← mismos datos
  routeParams: { classid: '123' }  ← misma ruta
  viewParams: {}  ← vacío

Usuario hace click en "Schedule Mode" switch en footer
  ↓
FooterComponent hace router.navigate(..., { queryParams: { viewMode: 'schedule' } })
  ↓
URL cambia a /gradebook/123?viewMode=schedule
  ↓
route.queryParamMap emite nuevo evento
  ↓
this.viewService.setViewParams({ viewMode: 'schedule' })
  ↓
Effect se dispara (viewParams cambió)
  ↓
transform(rawData, routeParams, { viewMode: 'schedule' })
  ↓
Retorna datos con estructura diferente según viewMode
  ↓
updateProcessedData() actualiza estado
  ↓
GradebookTableComponent re-renderiza con nuevo formato

✅ TODO sin hacer GET nuevamente al API
✅ rawData intacto, solo se re-procesa
✅ Histórico del navegador funciona (queryParams en URL)
```

---

## Responsabilidades por Servicio

| Servicio | Responsabilidad | Signals | Métodos |
|----------|-----------------|---------|---------|
| **GradebookApiService** | Llamar HTTP | (ninguno) | `load(): Observable<DTO>` |
| **GradebookStateService** | Guardar estado global | rawData, routeParams, headerRows, groups, etc. | `updateProcessedData()`, `toggleGroup()` |
| **GradebookViewService** | Guardar parámetros de vista | viewParams | `setViewParams()`, `updateViewParam()`, `reset()` |
| **GradebookDataService** | Transformar datos | (ninguno) | `transform(raw, route, view): Processed` |
| **GradebookLayoutComponent** | Orquestar todo | (inyecta servicios) | Effect + ngOnInit + suscripciones |

---

## Ventajas de esta Arquitectura

| Aspecto | Ventaja |
|--------|---------|
| **Caching** | API se llama UNA sola vez, sin re-peticiones |
| **Flexibilidad** | Mismos datos, múltiples vistas sin cambiar API |
| **Reactividad** | Cambios en ruta/vista actualizan tabla automáticamente |
| **Separación** | Cada servicio tiene responsabilidad clara |
| **Testable** | Fácil mockear servicios y probar transformaciones |
| **Bookmarkeable** | QueryParams en URL permiten compartir vistas |
| **Historial** | Navegador back/forward funciona correctamente |

---

## TODO Pendientes de Implementación

### En `GradebookDataService.transform()`

```typescript
// Actualmente solo copia datos del DTO
// TODO: Implementar lógica según routeParams y viewParams

// Ejemplo:
if (routeParams.unidid) {
  // Filtrar solo grupos de esa unidad
}

if (viewParams.viewMode === 'schedule') {
  // Cambiar formato de celdas a botones de programación
} else if (viewParams.viewMode === 'grades') {
  // Mantener formato de calificaciones (actual)
}

if (viewParams.sortBy === 'name') {
  // Ordenar alumnos alfabéticamente
}
```

### En `GradebookFooterComponent`

```typescript
// TODO: Agregar switches/botones para:
// - viewMode: grades | schedule | (futuros)
// - sortBy: name | score | (futuros)
// - filterBy: active | all | (futuros)

// Al hacer click:
this.router.navigate([], {
  relativeTo: this.route,
  queryParams: { viewMode: 'schedule' },
  queryParamsHandling: 'merge'
});
```

---

## Notas Importantes

1. **rawData es inmutable** — No se modifica, solo se re-transforma
2. **viewParams son opcionales** — Si no hay query params, viewParams = {}
3. **Effect es automático** — No necesitas llamar manualmente a transform()
4. **Query params son persistentes** — Usuario comparte URL → vista se reproduce
5. **Collapse/expand es local** — No dispara re-transformación (está en state.groups ya procesados)
