# Integración del Gradebook Table System en Angular 20

Este documento explica cómo integrar el sistema de tabla tipo gradebook en un proyecto Angular 20
ya existente. Cubre la separación en componentes (header, tabla, footer), el servicio de estado
con signals, la llamada al backend y toda la estrategia de estilos.

---

## Tabla de Contenidos

1. [Estructura del Módulo](#1-estructura-del-módulo)
2. [Ruta sin shell (layout exclusivo)](#2-ruta-sin-shell-layout-exclusivo)
3. [Modelos de Datos](#3-modelos-de-datos)
4. [Arquitectura de Componentes](#4-arquitectura-de-componentes)
5. [Servicio de Estado](#5-servicio-de-estado)
6. [Servicio de API](#6-servicio-de-api)
7. [Estrategia de Estilos: `:host` en lugar de `:root`](#7-estrategia-de-estilos-host-en-lugar-de-root)
8. [Estrategia de Clipping del Scrollbar](#8-estrategia-de-clipping-del-scrollbar)
9. [Sincronización del Scroll](#9-sincronización-del-scroll)
10. [Posicionamiento Sticky mediante CSS (sin JS)](#10-posicionamiento-sticky-mediante-css-sin-js)
11. [Colapso/Expansión de Grupos](#11-colapsoexpansión-de-grupos)
12. [Codificación de Color de Notas](#12-codificación-de-color-de-notas)
13. [Listado Completo de Archivos](#13-listado-completo-de-archivos)

---

## 1. Estructura del Módulo

```
src/app/modules/gradebook/
  gradebook.module.ts
  models/
    gradebook.models.ts
  services/
    gradebook-state.service.ts     ← estado global (signals)
    gradebook-api.service.ts       ← llamada HTTP → actualiza estado
  components/
    gradebook/                     ← componente shell (layout + carga de datos)
      gradebook.component.ts
      gradebook.component.html
      gradebook.component.scss
    gradebook-header/
      gradebook-header.component.ts
      gradebook-header.component.scss
    gradebook-footer/
      gradebook-footer.component.ts
      gradebook-footer.component.scss
    gradebook-table/               ← main-content: scrollbar + tabla
      gradebook-table.component.ts
      gradebook-table.component.html
      gradebook-table.component.scss
```

Assets en `src/assets/imgs/`:

```
src/assets/imgs/expand_close.svg
src/assets/imgs/expand_open.svg
```

---

## 2. Ruta sin shell (layout exclusivo)

El gradebook se registra **fuera del shell principal** del router para que ocupe
la pantalla completa sin menú, header ni footer global:

### `src/app/app.routes.ts` (modificar)

```typescript
export const routes: Routes = [
  {
    path: '',
    component: AppShellComponent,   // shell existente de la app
    children: [
      // ...rutas existentes...
    ],
  },
  {
    path: 'gradebook',
    loadComponent: () =>
      import('./modules/gradebook/components/gradebook/gradebook.component')
        .then(m => m.GradebookComponent),
  },
];
```

> Si `app.component.html` tiene más que un `<router-outlet />`, asegúrate de que
> el outlet raíz no esté anidado dentro del shell. El outlet raíz renderizará
> directamente `GradebookComponent` en la ruta `/gradebook`.

---

## 3. Modelos de Datos

`src/app/modules/gradebook/models/gradebook.models.ts`:

```typescript
// Estado de un grupo en la UI (collapsed es estado local, no viene del API)
export interface StudentGroup {
  name: string;
  rows: (string | number)[][];
  averagesRow: (string | number)[];
  collapsed: boolean;
}

export interface GradebookConfig {
  topRows: { lines: 1 | 2 }[];
  fixedRightCols: number;
}

export interface CellClasses {
  [colIndex: number]: string;
}

// DTO que devuelve el backend (sin `collapsed`, que es estado UI)
export interface GradebookApiResponse {
  headerRows: string[][];
  groups: Omit<StudentGroup, 'collapsed'>[];
}
```

---

## 4. Arquitectura de Componentes

```
GradebookComponent (shell)
  ├── GradebookHeaderComponent   → <header> estático
  ├── GradebookTableComponent    → scrollbar + <table> reactiva
  └── GradebookFooterComponent   → <footer> con stats (y futuros botones)

GradebookStateService            → señales compartidas entre todos
GradebookApiService              → GET /gradebook → actualiza el estado
```

**Flujo de datos:**

1. `GradebookComponent.ngOnInit` llama a `GradebookApiService.load()`.
2. El servicio de API hace el GET y actualiza las signals de `GradebookStateService`.
3. Cada componente hijo **inyecta `GradebookStateService` directamente** — no hay
   `@Input()` ni `@Output()` entre componentes. El estado es la única fuente de verdad.

**División de responsabilidades:**

| Componente / Servicio | Responsabilidad |
|---|---|
| `GradebookComponent` | Layout `.page`, carga inicial, estados loading/error |
| `GradebookHeaderComponent` | `<header>` con título |
| `GradebookFooterComponent` | `<footer>` con stats y futuros botones |
| `GradebookTableComponent` | Scrollbar superior, `<table>`, lógica de sticky/scroll |
| `GradebookStateService` | Signals (`groups`, `headerRows`, …) + `toggleGroup()` |
| `GradebookApiService` | HTTP GET → transforma DTO → actualiza estado |

---

## 5. Servicio de Estado

`src/app/modules/gradebook/services/gradebook-state.service.ts`:

```typescript
import { Injectable, signal, computed } from '@angular/core';
import { CellClasses, GradebookConfig, StudentGroup } from '../models/gradebook.models';

@Injectable({ providedIn: 'root' })
export class GradebookStateService {

  // Configuración estática (puede hacerse signal si el backend la devuelve)
  readonly config: GradebookConfig = {
    topRows: [{ lines: 2 }],
    fixedRightCols: 2,
  };

  // ---- Signals de datos ----
  readonly headerRows = signal<string[][]>([]);
  readonly groups     = signal<StudentGroup[]>([]);
  readonly cellClasses = signal<CellClasses>({});
  readonly totalCols   = signal(0);
  readonly studentCount = signal(0);

  // ---- Signals de UI ----
  readonly loading = signal(false);
  readonly error   = signal<string | null>(null);

  // ---- Computed ----
  readonly footerText = computed(() =>
    `${this.studentCount()} alumnos · ${this.totalCols()} columnas`
  );

  // ---- Acciones ----
  toggleGroup(index: number): void {
    this.groups.update(gs =>
      gs.map((g, i) => i === index ? { ...g, collapsed: !g.collapsed } : g)
    );
  }
}
```

---

## 6. Servicio de API

`src/app/modules/gradebook/services/gradebook-api.service.ts`:

```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { GradebookApiResponse, CellClasses } from '../models/gradebook.models';
import { GradebookStateService } from './gradebook-state.service';

@Injectable({ providedIn: 'root' })
export class GradebookApiService {
  private http  = inject(HttpClient);
  private state = inject(GradebookStateService);

  load(): void {
    this.state.loading.set(true);
    this.state.error.set(null);

    this.http
      .get<GradebookApiResponse>(`${environment.apiUrl}/gradebook`)
      .subscribe({
        next: (data) => {
          const totalCols = data.headerRows[0]?.length ?? 0;

          const cellClasses: CellClasses = {};
          for (let c = 1; c < totalCols; c++) cellClasses[c] = 'score-cell';

          this.state.headerRows.set(data.headerRows);
          this.state.groups.set(
            data.groups.map(g => ({ ...g, collapsed: false }))
          );
          this.state.totalCols.set(totalCols);
          this.state.studentCount.set(
            data.groups.reduce((sum, g) => sum + g.rows.length, 0)
          );
          this.state.cellClasses.set(cellClasses);
          this.state.loading.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.state.error.set(err.message ?? 'Error al cargar el gradebook');
          this.state.loading.set(false);
        },
      });
  }
}
```

> **Requisito:** `provideHttpClient()` debe estar en `app.config.ts`:
> ```typescript
> export const appConfig: ApplicationConfig = {
>   providers: [provideHttpClient(), /* ... */],
> };
> ```

---

## 7. Estrategia de Estilos: `:host` en lugar de `:root`

### Por qué no se puede usar `:root` en el CSS de un componente Angular

Angular con `ViewEncapsulation.Emulated` (el modo por defecto) añade atributos
de identificación a los selectores para aislarlos. El selector `:root` siempre
apunta a `<html>` y no puede ser encapsulado, por lo que Angular lo ignoraría.

La alternativa correcta es **`:host`**, que se mapea al elemento host del
componente (`<app-gradebook>` en el DOM). Las variables CSS definidas en `:host`
son accesibles por **todos sus descendientes** mediante herencia CSS, incluyendo
los elementos dentro de los componentes hijos — exactamente igual que `:root`.

### Cómo ocupar toda la pantalla sin tocar `styles.scss`

```scss
// gradebook.component.scss
:host {
  display: block;
  position: fixed;
  inset: 0;        // top:0; right:0; bottom:0; left:0
  overflow: hidden;
  // ...todas las variables CSS aquí...
}
```

`position: fixed; inset: 0` ancla el componente al viewport completo sin importar
dónde esté el router outlet, y sin modificar `html`, `body` ni `styles.scss`.

### CSS variables accesibles en componentes hijos

Las variables definidas en `:host` de `app-gradebook` se heredan automáticamente
a `app-gradebook-header`, `app-gradebook-table` y `app-gradebook-footer` porque
son elementos DOM hijos de `app-gradebook`. Cada componente hijo puede usar
`var(--color-header-bg)` etc. sin redeclararlas.

### Nota sobre `font-family: Inter`

Inter ya está declarada globalmente en la app. No hay que repetir `@font-face`.
Se referencia directamente en la variable:

```scss
--font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
               'Helvetica Neue', Arial, sans-serif;
```

---

## 8. Estrategia de Clipping del Scrollbar

```
+------------------------------------------------+
|  app-gradebook (:host → position:fixed;inset:0)|
|  .page (flex column; height:100%)              |
|  +--------------------------------------------+|
|  | app-gradebook-header (flex-shrink:0)        ||
|  |   <header>...</header>                      ||
|  +--------------------------------------------+|
|  | app-gradebook-table (flex-grow:1; ovf:h)   ||  ← host ES el main-content
|  |   .top-scrollbar-container                  ||  ← scrollbar h. personalizado
|  |   .table-container-wrapper (ovf:hidden)     ||  ← recorta scrollbar h. nativo
|  |     .table-container (ovf:auto)             ||  ← único ancestro de scroll
|  |       <table>                               ||
|  +--------------------------------------------+|
|  | app-gradebook-footer (flex-shrink:0)        ||
|  |   <footer>...</footer>                      ||
|  +--------------------------------------------+|
+------------------------------------------------+
```

**Reglas clave:**
- `app-gradebook-table` tiene en su `:host`: `flex-grow: 1; overflow: hidden; min-height: 0`.
  El host sustituye al antiguo `.main-content` — no hace falta ese div extra.
- `min-height: 0` es **crítico**: los flex items tienen `min-height: auto` por defecto,
  lo que impediría que el contenido haga scroll. Sin esto la tabla se expande infinitamente.
- `.table-container-wrapper` tiene `overflow: hidden` → no es ancestro de scroll,
  por lo que `position: sticky` dentro de la tabla funciona correctamente.
- `.table-container` tiene `overflow: auto` + `height: calc(100% + 15px)` → los 15 px
  extra empujan el scrollbar horizontal nativo fuera del área visible.

---

## 9. Sincronización del Scroll

Se usa un flag `isSyncing` para evitar bucles infinitos (asignar `scrollLeft`
dispara el evento `scroll`). La lógica vive en `ngAfterViewInit` de
`GradebookTableComponent`. El `GradebookTableComponent` solo se renderiza cuando
los datos están disponibles (el shell controla esto con `@if`), así que los
`@ViewChild` refs siempre son válidos en `ngAfterViewInit`.

---

## 10. Posicionamiento Sticky mediante CSS (sin JS)

Todos los offsets sticky usan **matemática de variables CSS**, sin
`getBoundingClientRect`.

### Filas de cabecera

```html
<th
  [style.top]="headerGeometry().topOffsets[ri]"
  [style.height]="headerGeometry().heightValues[ri]"
  [class.sticky-left]="ci === 0"
  [class.sticky-right]="ci >= firstFixedRight"
  [class.sub-header]="ri > 0"
  [style.right]="ci >= firstFixedRight ? stickyRightStyle(ci) : null"
  [style.width]="ci !== 0 ? 'var(--col-width-default)' : null"
>
```

### Celdas de cuerpo

```html
<td
  [ngClass]="cellClass(ci, cell)"
  [class.sticky-left]="ci === 0"
  [class.sticky-right]="ci >= firstFixedRight"
  [style.right]="ci >= firstFixedRight ? stickyRightStyle(ci) : null"
  [style.width]="ci !== 0 ? 'var(--col-width-default)' : null"
>{{ cell }}</td>
```

### Capas Z-Index

| z-index | Elementos |
|---------|-----------|
| 1 | Celdas `<td>` en scroll normal |
| 2 | Sticky simple: `.sticky-left`, `.sticky-right`, `thead th` |
| 3 | Esquinas cruzadas: `thead th.sticky-left`, `thead th.sticky-right` |

---

## 11. Colapso/Expansión de Grupos

`toggleGroup` vive en el **servicio de estado** — cualquier componente puede
llamarlo. El estado actualiza el array de grupos de forma inmutable:

```typescript
// gradebook-state.service.ts
toggleGroup(index: number): void {
  this.groups.update(gs =>
    gs.map((g, i) => i === index ? { ...g, collapsed: !g.collapsed } : g)
  );
}
```

En `GradebookTableComponent`:

```typescript
toggleGroup(index: number): void {
  this.state.toggleGroup(index);
}

groupContentRows(group: StudentGroup): (string | number)[][] {
  return group.collapsed ? [] : group.rows;
}
```

`groupContentRows` devuelve un array vacío cuando el grupo está colapsado,
y el `@for` loop no renderiza nada → Angular elimina esas filas del DOM.

---

## 12. Codificación de Color de Notas

```typescript
// gradebook-table.component.ts
cellClass(col: number, val: string | number): string {
  const base = this.state.cellClasses()[col] ?? '';
  const num = typeof val === 'number' ? val : parseFloat(val as string);
  if (!isNaN(num)) {
    return `${base} ${num < 60 ? 'score-fail' : 'score-pass'}`;
  }
  return base;
}
```

```scss
// gradebook-table.component.scss
td.score-fail { color: #990000; }
td.score-pass { color: #009900; }
```

---

## 13. Listado Completo de Archivos

### `gradebook.models.ts`

```typescript
export interface StudentGroup {
  name: string;
  rows: (string | number)[][];
  averagesRow: (string | number)[];
  collapsed: boolean;
}

export interface GradebookConfig {
  topRows: { lines: 1 | 2 }[];
  fixedRightCols: number;
}

export interface CellClasses {
  [colIndex: number]: string;
}

export interface GradebookApiResponse {
  headerRows: string[][];
  groups: Omit<StudentGroup, 'collapsed'>[];
}
```

---

### `gradebook-state.service.ts`

```typescript
import { Injectable, signal, computed } from '@angular/core';
import { CellClasses, GradebookConfig, StudentGroup } from '../models/gradebook.models';

@Injectable({ providedIn: 'root' })
export class GradebookStateService {

  readonly config: GradebookConfig = {
    topRows: [{ lines: 2 }],
    fixedRightCols: 2,
  };

  readonly headerRows   = signal<string[][]>([]);
  readonly groups       = signal<StudentGroup[]>([]);
  readonly cellClasses  = signal<CellClasses>({});
  readonly totalCols    = signal(0);
  readonly studentCount = signal(0);
  readonly loading      = signal(false);
  readonly error        = signal<string | null>(null);

  readonly footerText = computed(() =>
    `${this.studentCount()} alumnos · ${this.totalCols()} columnas`
  );

  toggleGroup(index: number): void {
    this.groups.update(gs =>
      gs.map((g, i) => i === index ? { ...g, collapsed: !g.collapsed } : g)
    );
  }
}
```

---

### `gradebook-api.service.ts`

```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { GradebookApiResponse, CellClasses } from '../models/gradebook.models';
import { GradebookStateService } from './gradebook-state.service';

@Injectable({ providedIn: 'root' })
export class GradebookApiService {
  private http  = inject(HttpClient);
  private state = inject(GradebookStateService);

  load(): void {
    this.state.loading.set(true);
    this.state.error.set(null);

    this.http
      .get<GradebookApiResponse>(`${environment.apiUrl}/gradebook`)
      .subscribe({
        next: (data) => {
          const totalCols = data.headerRows[0]?.length ?? 0;

          const cellClasses: CellClasses = {};
          for (let c = 1; c < totalCols; c++) cellClasses[c] = 'score-cell';

          this.state.headerRows.set(data.headerRows);
          this.state.groups.set(
            data.groups.map(g => ({ ...g, collapsed: false }))
          );
          this.state.totalCols.set(totalCols);
          this.state.studentCount.set(
            data.groups.reduce((sum, g) => sum + g.rows.length, 0)
          );
          this.state.cellClasses.set(cellClasses);
          this.state.loading.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.state.error.set(err.message ?? 'Error al cargar el gradebook');
          this.state.loading.set(false);
        },
      });
  }
}
```

---

### `gradebook.component.ts`

```typescript
import { Component, OnInit, inject } from '@angular/core';
import { GradebookApiService } from '../../services/gradebook-api.service';
import { GradebookStateService } from '../../services/gradebook-state.service';
import { GradebookHeaderComponent } from '../gradebook-header/gradebook-header.component';
import { GradebookTableComponent } from '../gradebook-table/gradebook-table.component';
import { GradebookFooterComponent } from '../gradebook-footer/gradebook-footer.component';

@Component({
  selector: 'app-gradebook',
  standalone: true,
  imports: [GradebookHeaderComponent, GradebookTableComponent, GradebookFooterComponent],
  templateUrl: './gradebook.component.html',
  styleUrl: './gradebook.component.scss',
})
export class GradebookComponent implements OnInit {
  private api = inject(GradebookApiService);
  protected state = inject(GradebookStateService);

  ngOnInit(): void {
    this.api.load();
  }
}
```

### `gradebook.component.html`

```html
<div class="page">
  <app-gradebook-header />

  @if (state.loading()) {
    <div class="status-overlay">Cargando...</div>
  } @else if (state.error()) {
    <div class="status-overlay status-overlay--error">{{ state.error() }}</div>
  } @else {
    <app-gradebook-table />
  }

  <app-gradebook-footer />
</div>
```

### `gradebook.component.scss`

```scss
// ============================================================
//  Variables CSS del módulo Gradebook
//  Definidas en :host para que se hereden a todos los
//  componentes hijos via cascada CSS normal.
// ============================================================
:host {
  display: block;
  position: fixed;
  inset: 0;
  overflow: hidden;

  // ---- Sizing estructural ----
  --col-width-default: 100px;
  --row-height-1line: 40px;
  --row-height-2lines: 60px;

  // ---- Colores ----
  --color-bg: #ffffff;
  --color-header-bg: #4e555d;
  --color-hscroll-bg: #f7f8fa;
  --color-th-bg: #4e555d;
  --color-border: #ffffff;
  --color-border-footer: #aba8a8;
  --color-text: #333333;
  --color-text-light: #777777;
  --color-sticky-left-bg: #f9fafb;
  --color-sticky-right-bg: #f1f4f9;
  --color-corner-left-bg: #ffffff;
  --color-corner-right-bg: #8c9096;
  --color-row-alt: #f5f5f5;
  --color-row-alt-sticky-left: #f5f5f5;
  --color-row-alt-sticky-right: #f5f5f5;
  --color-row-altodd: #e9e9e9;
  --color-row-altodd-sticky-left: #e9e9e9;
  --color-row-altodd-sticky-right: #e9e9e9;
  --color-text-header: #ffffff;
  --color-text-th: #ffffff;
  --color-footer-bg: #ffffff;
  --color-scrollbar-track: #f1f1f1;
  --color-scrollbar-thumb: #b0b0b0;
  --color-scrollbar-thumb-hover: #888888;
  --color-toggle-button-hover: #888888;

  // ---- Grupo: fila de nombre ----
  --color-group-name-bg: #a6aaae;
  --color-group-name-text: #ffffff;
  --font-weight-group-name: 400;

  // ---- Grupo: fila de medias ----
  --color-group-averages-bg: #ffffff;
  --color-group-averages-text: #000000;
  --color-group-averages-border: #a6aaae;
  --font-weight-group-averages: 600;

  // ---- Tipografía (Inter ya declarada globalmente; no se repite @font-face) ----
  --font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
                 'Helvetica Neue', Arial, sans-serif;
  --font-size-base: 13px;
  --font-size-header: 14px;
  --font-size-title: 18px;
  --font-size-small: 11px;

  // ---- Espaciado y bordes ----
  --cell-padding-y: 6px;
  --cell-padding-x: 10px;
  --header-page-padding: 14px 20px;
  --border-style: 1px solid var(--color-border);
  --border-footer: 1px solid var(--color-border-footer);
}

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

.page {
  display: flex;
  flex-direction: column;
  height: 100%;
  font-family: var(--font-family);
  font-size: var(--font-size-base);
  color: var(--color-text);
  background: var(--color-bg);
}

// Estado loading/error ocupa el espacio que ocuparía la tabla
.status-overlay {
  flex-grow: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-base);
  color: var(--color-text-light);

  &--error { color: #990000; }
}
```

---

### `gradebook-header.component.ts`

```typescript
import { Component } from '@angular/core';

@Component({
  selector: 'app-gradebook-header',
  standalone: true,
  template: `
    <header>
      <h1>Gradebook del Profesor</h1>
    </header>
  `,
  styleUrl: './gradebook-header.component.scss',
})
export class GradebookHeaderComponent {}
```

### `gradebook-header.component.scss`

```scss
// El host es un flex item de .page → flex-shrink: 0 para que no se comprima
:host {
  display: block;
  flex-shrink: 0;
}

header {
  padding: var(--header-page-padding);
  background: var(--color-header-bg);
  border-bottom: var(--border-style);

  h1 {
    font-size: var(--font-size-title);
    color: var(--color-text-header);
    font-weight: 600;
  }
}
```

---

### `gradebook-footer.component.ts`

```typescript
import { Component, inject } from '@angular/core';
import { GradebookStateService } from '../../services/gradebook-state.service';

@Component({
  selector: 'app-gradebook-footer',
  standalone: true,
  template: `
    <footer>
      <span>{{ state.footerText() }}</span>
      <span>Gradebook v1.0</span>
    </footer>
  `,
  styleUrl: './gradebook-footer.component.scss',
})
export class GradebookFooterComponent {
  protected state = inject(GradebookStateService);
}
```

### `gradebook-footer.component.scss`

```scss
:host {
  display: block;
  flex-shrink: 0;
}

footer {
  padding: 8px 20px;
  background: var(--color-footer-bg);
  border-top: var(--border-footer);
  font-size: var(--font-size-small);
  color: var(--color-text);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
```

---

### `gradebook-table.component.ts`

```typescript
import {
  Component,
  AfterViewInit,
  ElementRef,
  ViewChild,
  inject,
  computed,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { StudentGroup } from '../../models/gradebook.models';
import { GradebookStateService } from '../../services/gradebook-state.service';

@Component({
  selector: 'app-gradebook-table',
  standalone: true,
  imports: [NgClass],
  templateUrl: './gradebook-table.component.html',
  styleUrl: './gradebook-table.component.scss',
})
export class GradebookTableComponent implements AfterViewInit {
  protected state = inject(GradebookStateService);

  @ViewChild('topScrollbar') topScrollbarRef!: ElementRef<HTMLDivElement>;
  @ViewChild('tableContainer') tableContainerRef!: ElementRef<HTMLDivElement>;
  @ViewChild('gradebookTable') tableRef!: ElementRef<HTMLTableElement>;
  @ViewChild('topDummy') topDummyRef!: ElementRef<HTMLDivElement>;

  // Geometría de sticky headers: top y height calculados con variables CSS
  headerGeometry = computed(() => {
    const topOffsets: string[] = [];
    const heightValues: string[] = [];
    const cumulativeParts: string[] = [];

    for (const row of this.state.config.topRows) {
      const h = row.lines === 1 ? 'var(--row-height-1line)' : 'var(--row-height-2lines)';
      heightValues.push(h);

      if (cumulativeParts.length === 0) {
        topOffsets.push('0px');
      } else if (cumulativeParts.length === 1) {
        topOffsets.push(cumulativeParts[0]);
      } else {
        topOffsets.push(`calc(${cumulativeParts.join(' + ')})`);
      }
      cumulativeParts.push(h);
    }
    return { topOffsets, heightValues };
  });

  get firstFixedRight(): number {
    return this.state.totalCols() - this.state.config.fixedRightCols;
  }

  emptyCols = computed(() =>
    Array.from({ length: this.state.totalCols() - 1 }, (_, i) => i)
  );

  stickyRightStyle(colIndex: number): string {
    const pos = this.state.totalCols() - 1 - colIndex;
    return pos === 0 ? '0px' : `calc(var(--col-width-default) * ${pos})`;
  }

  ngAfterViewInit(): void {
    this.setupScrollSync();
  }

  private setupScrollSync(): void {
    const topEl       = this.topScrollbarRef.nativeElement;
    const containerEl = this.tableContainerRef.nativeElement;
    const dummyEl     = this.topDummyRef.nativeElement;
    const tableEl     = this.tableRef.nativeElement;

    let isSyncing = false;

    const updateDummyWidth = () => {
      dummyEl.style.width =
        (tableEl.scrollWidth - containerEl.clientWidth + topEl.clientWidth) + 'px';
    };

    const adjustHeight = () => {
      containerEl.style.height =
        tableEl.scrollWidth > containerEl.clientWidth
          ? 'calc(100% + 15px)'
          : '100%';
    };

    const ro = new ResizeObserver(() => { updateDummyWidth(); adjustHeight(); });
    ro.observe(tableEl);
    ro.observe(containerEl);

    topEl.addEventListener('scroll', () => {
      if (isSyncing) { isSyncing = false; return; }
      isSyncing = true;
      containerEl.scrollLeft = topEl.scrollLeft;
    });

    containerEl.addEventListener('scroll', () => {
      if (isSyncing) { isSyncing = false; return; }
      isSyncing = true;
      topEl.scrollLeft = containerEl.scrollLeft;
    });

    window.addEventListener('resize', adjustHeight);
    setTimeout(adjustHeight, 0);
  }

  toggleGroup(index: number): void {
    this.state.toggleGroup(index);
  }

  groupContentRows(group: StudentGroup): (string | number)[][] {
    return group.collapsed ? [] : group.rows;
  }

  toggleIcon(group: StudentGroup): string {
    return group.collapsed
      ? 'assets/imgs/expand_open.svg'
      : 'assets/imgs/expand_close.svg';
  }

  cellClass(col: number, val: string | number): string {
    const base = this.state.cellClasses()[col] ?? '';
    const num = typeof val === 'number' ? val : parseFloat(val as string);
    if (!isNaN(num)) {
      return `${base} ${num < 60 ? 'score-fail' : 'score-pass'}`;
    }
    return base;
  }
}
```

### `gradebook-table.component.html`

```html
<!-- Scrollbar superior personalizado -->
<div class="top-scrollbar-container" #topScrollbar>
  <div class="top-scrollbar-dummy" #topDummy></div>
</div>

<!-- Wrapper que recorta el scrollbar h. nativo -->
<div class="table-container-wrapper">
  <div class="table-container" #tableContainer>
    <table #gradebookTable>
      <thead>
        @for (row of state.config.topRows; track $index; let ri = $index) {
          <tr>
            @for (cell of state.headerRows()[ri]; track $index; let ci = $index) {
              <th
                [style.top]="headerGeometry().topOffsets[ri]"
                [style.height]="headerGeometry().heightValues[ri]"
                [class.sticky-left]="ci === 0"
                [class.sticky-right]="ci >= firstFixedRight"
                [class.sub-header]="ri > 0"
                [style.right]="ci >= firstFixedRight ? stickyRightStyle(ci) : null"
                [style.width]="ci !== 0 ? 'var(--col-width-default)' : null"
                [style.min-width]="ci !== 0 ? 'var(--col-width-default)' : null"
                [style.max-width]="ci !== 0 ? 'var(--col-width-default)' : null"
              >
                @if (cell.includes('\n')) {
                  @for (line of cell.split('\n'); track line) {
                    @if (!$last) { {{ line }}<br /> } @else { {{ line }} }
                  }
                } @else {
                  {{ cell }}
                }
              </th>
            }
          </tr>
        }
      </thead>

      <tbody>
        @for (group of state.groups(); track group.name; let gi = $index) {

          <tr class="group-name-row">
            <td class="sticky-left">
              <button type="button" class="group-toggle-btn" (click)="toggleGroup(gi)">
                <img [src]="toggleIcon(group)" alt="Toggle grupo" />
              </button>
              {{ group.name }}
            </td>
            @for (c of emptyCols(); track c) { <td></td> }
          </tr>

          @for (row of groupContentRows(group); track $index) {
            <tr>
              @for (cell of row; track $index; let ci = $index) {
                <td
                  [ngClass]="cellClass(ci, cell)"
                  [class.sticky-left]="ci === 0"
                  [class.sticky-right]="ci >= firstFixedRight"
                  [style.right]="ci >= firstFixedRight ? stickyRightStyle(ci) : null"
                  [style.width]="ci !== 0 ? 'var(--col-width-default)' : null"
                  [style.min-width]="ci !== 0 ? 'var(--col-width-default)' : null"
                  [style.max-width]="ci !== 0 ? 'var(--col-width-default)' : null"
                >{{ cell }}</td>
              }
            </tr>
          }

          <tr class="group-averages-row">
            @for (cell of group.averagesRow; track $index; let ci = $index) {
              <td
                [ngClass]="cellClass(ci, cell)"
                [class.sticky-left]="ci === 0"
                [class.sticky-right]="ci >= firstFixedRight"
                [style.right]="ci >= firstFixedRight ? stickyRightStyle(ci) : null"
                [style.width]="ci !== 0 ? 'var(--col-width-default)' : null"
                [style.min-width]="ci !== 0 ? 'var(--col-width-default)' : null"
                [style.max-width]="ci !== 0 ? 'var(--col-width-default)' : null"
              >{{ cell }}</td>
            }
          </tr>

        }
      </tbody>
    </table>
  </div>
</div>
```

### `gradebook-table.component.scss`

```scss
// El host ES el main-content: flex item que crece y controla el overflow
:host {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  overflow: hidden;
  min-height: 0; // CRÍTICO: sin esto el flex item no permite scroll (min-height: auto por defecto)
}

// ---- Scrollbar superior personalizado ----
.top-scrollbar-container {
  flex-shrink: 0;
  overflow-x: auto;
  overflow-y: hidden;
  height: 16px;
  border-bottom: var(--border-style);
  background: var(--color-hscroll-bg);
}

.top-scrollbar-dummy {
  height: 1px;
}

// ---- Contenedor de la tabla ----
.table-container-wrapper {
  flex-grow: 1;
  overflow: hidden;   // recorta scrollbar h. nativo; NO es ancestro de scroll
}

.table-container {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden; // oculta scrollbar h. nativo; permite scrollLeft programático

  scrollbar-color: var(--color-scrollbar-thumb) var(--color-scrollbar-track);

  &::-webkit-scrollbar { width: 8px; height: 8px; }
  &::-webkit-scrollbar-track { background: var(--color-scrollbar-track); }
  &::-webkit-scrollbar-thumb {
    background: var(--color-scrollbar-thumb);
    border-radius: 4px;
  }
  &::-webkit-scrollbar-thumb:hover { background: var(--color-scrollbar-thumb-hover); }
}

// ============================================================
//  Tabla base
//  border-collapse: separate OBLIGATORIO para que los bordes de
//  celdas sticky no desaparezcan al hacer scroll.
// ============================================================
table {
  border-collapse: separate;
  border-spacing: 0;
  width: max-content;
  margin: auto;
}

th, td {
  padding: var(--cell-padding-y) var(--cell-padding-x);
  border-right: var(--border-style);
  border-left: var(--border-style);
  border-bottom: var(--border-style);
  text-align: left;
  vertical-align: middle;
  background: var(--color-bg);
}

th {
  font-size: var(--font-size-header);
  font-weight: 400;
  color: var(--color-text-th);
  background: var(--color-th-bg);
  text-align: center;
}

// ============================================================
//  Sticky Positioning + Z-Index
//  z-index 1 → td normal | 2 → sticky un eje | 3 → esquina
// ============================================================
td {
  position: relative;
  z-index: 1;
}

.sticky-left {
  position: sticky;
  left: 0;
  z-index: 2;
  background: var(--color-sticky-left-bg);
  white-space: nowrap;
  width: max-content;
  box-shadow: 2px 0 5px -2px rgba(0, 0, 0, 0.06);
}

.sticky-right {
  position: sticky;
  z-index: 2;
  background: var(--color-sticky-right-bg);
}

thead th {
  position: sticky;
  z-index: 2;
}

thead th.sticky-left {
  z-index: 3;
  background: var(--color-corner-left-bg);
}

thead th.sticky-right {
  z-index: 3;
  background: var(--color-corner-right-bg);
}

// ============================================================
//  Filas alternadas (sticky necesitan fondo opaco)
// ============================================================
tbody tr:nth-child(even) td             { background: var(--color-row-alt); }
tbody tr:nth-child(even) td.sticky-left  { background: var(--color-row-alt-sticky-left); }
tbody tr:nth-child(even) td.sticky-right { background: var(--color-row-alt-sticky-right); }

tbody tr:nth-child(odd) td              { background: var(--color-row-altodd); }
tbody tr:nth-child(odd) td.sticky-left   { background: var(--color-row-altodd-sticky-left); }
tbody tr:nth-child(odd) td.sticky-right  { background: var(--color-row-altodd-sticky-right); }

// ============================================================
//  Sub-cabecera, notas, colores
// ============================================================
.sub-header {
  font-weight: 400;
  color: var(--color-text-header);
  font-size: var(--font-size-small);
  line-height: 1.3;
}

td.score-cell { text-align: center; font-weight: 700; }
td.score-fail { color: #990000; }
td.score-pass { color: #009900; }

// ============================================================
//  Filas de grupo (mayor especificidad que alternadas)
// ============================================================
tbody tr.group-name-row td,
tbody tr.group-name-row td.sticky-left,
tbody tr.group-name-row td.sticky-right {
  background: var(--color-group-name-bg);
  color: var(--color-group-name-text);
  font-weight: var(--font-weight-group-name);
}

.group-toggle-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  margin-right: 6px;
  border: none;
  background: transparent;
  cursor: pointer;
  vertical-align: middle;
  flex-shrink: 0;

  &:hover { background-color: var(--color-toggle-button-hover); }

  img {
    width: 12px;
    height: 12px;
    pointer-events: none;
  }
}

tbody tr.group-averages-row td,
tbody tr.group-averages-row td.sticky-left,
tbody tr.group-averages-row td.sticky-right {
  background: var(--color-group-averages-bg);
  font-weight: var(--font-weight-group-averages);
  border-top: 2px solid var(--color-group-averages-border);
}
```

---

### `gradebook.module.ts`

```typescript
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { GradebookComponent } from './components/gradebook/gradebook.component';

const routes: Routes = [
  { path: '', component: GradebookComponent },
];

@NgModule({
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    GradebookComponent,
  ],
})
export class GradebookModule {}
```

---

## Resumen: Vanilla JS → Angular 20

| Vanilla JS | Angular 20 |
|---|---|
| Clase `Gradebook` monolítica | 4 componentes + 2 servicios |
| `document.createElement('tr')` | Sintaxis `@for` en plantillas |
| `element.classList.add(...)` | `[ngClass]` / `[class.xxx]` |
| `element.style.display = 'none'` | `@for` sobre array filtrado |
| `document.getElementById(...)` | `@ViewChild` con template refs |
| `addEventListener('click', ...)` | `(click)="método()"` |
| `element.textContent = ...` | Interpolación `{{ expresión }}` |
| Estado manual en variables de clase | `GradebookStateService` con signals |
| Datos hardcoded en JS | GET `${environment.apiUrl}/gradebook` |
| `:root { --variables }` | `:host { --variables }` en `gradebook.component.scss` |
| `html, body { height: 100% }` | `:host { position: fixed; inset: 0 }` |
| `.main-content` div en el DOM | Host `app-gradebook-table` (`:host { flex-grow:1 }`) |
| `@font-face { Inter }` | Ya declarado globalmente — no se repite |
| `resizeObserver.observe(el)` | Idéntico, en `ngAfterViewInit` |
| CSS sticky + z-index | Idéntico — CSS puro |
| Scroll sync con flag `isSyncing` | Idéntico — event listeners nativos |

