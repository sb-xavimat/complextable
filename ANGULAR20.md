# Implementing the Gradebook Table System in Angular 20

This document explains how to port the vanilla JS sticky-header/sticky-column
gradebook table to Angular 20, preserving every feature: sticky headers,
sticky left/right columns, synced top scrollbar, clipped horizontal scrollbar,
group collapse/expand, and score color coding.

---

## Table of Contents

1. [Project Setup](#1-project-setup)
2. [Data Models](#2-data-models)
3. [Component Architecture](#3-component-architecture)
4. [The Scrollbar Clipping Strategy](#4-the-scrollbar-clipping-strategy)
5. [Scroll Sync Logic](#5-scroll-sync-logic)
6. [Sticky Positioning via CSS (No JS Measurement)](#6-sticky-positioning-via-css-no-js-measurement)
7. [Group Collapse/Expand](#7-group-collapseexpand)
8. [Score Color Coding](#8-score-color-coding)
9. [Complete File Listing](#9-complete-file-listing)

---

## 1. Project Setup

```bash
ng new gradebook --style=css --routing=false --ssr=false
cd gradebook
```

Place SVG assets in `src/assets/imgs/`:

```
src/assets/imgs/expand_close.svg
src/assets/imgs/expand_open.svg
```

The project structure will be:

```
src/
  app/
    models/
      gradebook.models.ts
    components/
      gradebook/
        gradebook.component.ts
        gradebook.component.html
        gradebook.component.css
    services/
      mock-data.service.ts
    app.component.ts
    app.component.html
    app.component.css
  assets/
    imgs/
      expand_close.svg
      expand_open.svg
  styles.css          (global reset + CSS variables)
```

---

## 2. Data Models

Create `src/app/models/gradebook.models.ts`:

```typescript
export interface GroupConfig {
  name: string;
  size: number;
}

export interface StudentGroup {
  name: string;
  rows: (string | number)[][];
  averagesRow: (string | number)[];
  collapsed: boolean;   // toggle state
}

export interface GradebookConfig {
  topRows: { lines: 1 | 2 }[];
  fixedRightCols: number;
}

export interface CellClasses {
  [colIndex: number]: string;
}
```

---

## 3. Component Architecture

The vanilla JS `Gradebook` class becomes a single Angular component. Angular's
template engine replaces all the manual `document.createElement` calls, and
**signals** replace manual DOM state mutations.

### gradebook.component.ts

```typescript
import {
  Component,
  OnInit,
  AfterViewInit,
  ElementRef,
  ViewChild,
  signal,
  computed,
  effect,
} from '@angular/core';
import { StudentGroup, GradebookConfig, CellClasses } from '../../models/gradebook.models';
import { MockDataService } from '../../services/mock-data.service';

@Component({
  selector: 'app-gradebook',
  standalone: true,
  templateUrl: './gradebook.component.html',
  styleUrl: './gradebook.component.css',
})
export class GradebookComponent implements OnInit, AfterViewInit {
  private data = inject(MockDataService);

  // --- Inputs (could also be @Input() if used from a parent) ---
  config: GradebookConfig = {
    topRows: [{ lines: 2 }],
    fixedRightCols: 2,
  };

  headerRows: string[][] = [];
  groups: StudentGroup[] = [];
  cellClasses: CellClasses = {};

  // --- View Children ---
  @ViewChild('topScrollbar') topScrollbarRef!: ElementRef<HTMLDivElement>;
  @ViewChild('tableContainer') tableContainerRef!: ElementRef<HTMLDivElement>;
  @ViewChild('table') tableRef!: ElementRef<HTMLTableElement>;
  @ViewChild('topDummy') topDummyRef!: ElementRef<HTMLDivElement>;
  @ViewChild('footerInfo') footerInfoRef!: ElementRef<HTMLSpanElement>;

  // --- Signals ---
  totalCols = signal(0);
  studentCount = signal(0);

  footerText = computed(() =>
    `${this.studentCount()} Students \u2022 ${this.totalCols()} Columns`
  );

  // Header geometry: pre-computed top offsets and heights as CSS value strings
  headerGeometry = computed(() => {
    const topOffsets: string[] = [];
    const heightValues: string[] = [];
    const cumulativeParts: string[] = [];

    for (const row of this.config.topRows) {
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

  // Sticky-right offset for a given column index
  stickyRightStyle(colIndex: number): string {
    const pos = this.totalCols() - 1 - colIndex;
    return pos === 0 ? '0px' : `calc(var(--col-width-default) * ${pos})`;
  }

  ngOnInit(): void {
    this.headerRows = this.data.generateHeaders();
    this.groups = this.data.generateGroups();
    this.cellClasses = this.data.buildCellClasses(this.headerRows[0].length);
    this.totalCols.set(this.headerRows[0].length);
    this.studentCount.set(
      this.groups.reduce((sum, g) => sum + g.rows.length, 0)
    );
  }

  ngAfterViewInit(): void {
    this.setupScrollSync();
  }

  // --- Scroll Sync ---
  private setupScrollSync(): void {
    const topEl = this.topScrollbarRef.nativeElement;
    const containerEl = this.tableContainerRef.nativeElement;
    const dummyEl = this.topDummyRef.nativeElement;
    const tableEl = this.tableRef.nativeElement;

    let isSyncing = false;

    const updateDummyWidth = () => {
      dummyEl.style.width =
        (tableEl.scrollWidth -
          containerEl.clientWidth +
          topEl.clientWidth) + 'px';
    };

    const adjustHeight = () => {
      if (tableEl.scrollWidth > containerEl.clientWidth) {
        containerEl.style.height = 'calc(100% + 15px)';
      } else {
        containerEl.style.height = '100%';
      }
    };

    const onResize = () => {
      updateDummyWidth();
      adjustHeight();
    };

    const ro = new ResizeObserver(onResize);
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

  // --- Group Toggle ---
  toggleGroup(index: number): void {
    this.groups[index].collapsed = !this.groups[index].collapsed;
  }

  groupContentRows(group: StudentGroup): (string | number)[][] {
    return group.collapsed ? [] : group.rows;
  }

  toggleIcon(group: StudentGroup): string {
    return group.collapsed
      ? 'assets/imgs/expand_open.svg'
      : 'assets/imgs/expand_close.svg';
  }

  // --- Cell Styling ---
  cellClass(col: number, val: string | number): string {
    const base = this.cellClasses[col] ?? '';
    const num = typeof val === 'number' ? val : parseFloat(val);
    if (!isNaN(num)) {
      return `${base} ${num < 60 ? 'score-fail' : 'score-pass'}`;
    }
    return base;
  }
}
```

---

## 4. The Scrollbar Clipping Strategy

This is the most critical layout trick. It works identically in Angular —
it's pure CSS.

The idea: hide the native horizontal scrollbar while keeping the vertical
scrollbar visible, and provide a custom synced horizontal scrollbar above the
table.

```
+-------------------------------------------+
|  .main-content (flex column)              |
|  +---------------------------------------+|
|  | .top-scrollbar-container              ||  <-- custom horizontal scrollbar
|  |   .top-scrollbar-dummy (width synced) ||
|  +---------------------------------------+|
|  | .table-container-wrapper (overflow:h) ||  <-- clips horizontal scrollbar
|  | +------------------------------------+||
|  | | .table-container (overflow:auto)   |||  <-- the ONLY scroll ancestor
|  | |   <table> with sticky cells        |||
|  | |   height: calc(100% + 15px)        |||  <-- extends past wrapper
|  | +------------------------------------+||     to hide h-scrollbar
|  +---------------------------------------+|
+-------------------------------------------+
```

Key rules:
- `.table-container-wrapper` has `overflow: hidden` — it is NOT a scroll
  ancestor, so `position: sticky` inside the table still works.
- `.table-container` has `overflow: auto` and `height: calc(100% + 15px)` —
  the extra 15px pushes the native horizontal scrollbar below the wrapper's
  clip boundary. The vertical scrollbar stays visible.
- The top scrollbar's dummy div width is set by JS to:
  `table.scrollWidth - tableContainer.clientWidth + topScrollbar.clientWidth`
  This accounts for the vertical scrollbar stealing width from the container.

All of this is pure CSS + a ResizeObserver — Angular adds nothing special here.

---

## 5. Scroll Sync Logic

The sync uses an `isSyncing` flag to prevent infinite loops (setting
`scrollLeft` fires a `scroll` event).

In Angular, this lives in `ngAfterViewInit` (see component above). The
`ResizeObserver` watches both the `<table>` and the `.table-container` so
the dummy width is recalculated when:
- The table grows/shrinks (rows added/removed)
- The vertical scrollbar appears/disappears (container height changes)

---

## 6. Sticky Positioning via CSS (No JS Measurement)

All sticky offsets use **CSS variable math** — no `getBoundingClientRect`.
This is identical in Angular.

### Header Rows

Each `<th>` gets inline `top` and `height` from the pre-computed geometry:

```html
<th
  [style.top]="geometry.topOffsets[rowIndex]"
  [style.height]="geometry.heightValues[rowIndex]"
  [class.sticky-left]="colIndex === 0"
  [class.sticky-right]="colIndex >= firstFixedRightIndex"
  [style.right]="colIndex >= firstFixedRightIndex ? stickyRightStyle(colIndex) : null"
>
```

### Body Cells

Each `<td>` gets classes via `[ngClass]` or `[class]` binding:

```html
<td
  [ngClass]="cellClass(colIndex, cellValue)"
  [class.sticky-left]="colIndex === 0"
  [class.sticky-right]="colIndex >= firstFixedRightIndex"
  [style.right]="colIndex >= firstFixedRightIndex ? stickyRightStyle(colIndex) : null"
  [style.width]="colIndex !== 0 ? 'var(--col-width-default)' : null"
>
```

### Z-Index Layering

This is handled entirely in CSS (identical to the vanilla version):

| Layer | z-index | Elements |
|-------|---------|----------|
| 1 | Body scrolling cells (`td`) |
| 2 | Single-axis sticky edges (`.sticky-left`, `.sticky-right`, `thead th`) |
| 3 | Intersection corners (`thead th.sticky-left`, `thead th.sticky-right`) |

---

## 7. Group Collapse/Expand

In the vanilla version, toggle buttons are created via `document.createElement`
and rows are hidden via `style.display = 'none'`.

In Angular, this is reactive via signals:

```html
@for (group of groups; track group.name; let gi = $index) {
  <!-- Group name row -->
  <tr class="group-name-row">
    <td class="sticky-left">
      <button
        type="button"
        class="group-toggle-btn"
        (click)="toggleGroup(gi)"
      >
        <img [src]="toggleIcon(group)" alt="Toggle group" />
      </button>
      {{ group.name }}
    </td>
    @for (c of emptyCols; track c) {
      <td></td>
    }
  </tr>

  <!-- Student rows (hidden when collapsed) -->
  @for (row of groupContentRows(group); track $index) {
    <tr>
      @for (cell of row; track $index; let ci = $index) {
        <td [ngClass]="cellClass(ci, cell)">{{ cell }}</td>
      }
    </tr>
  }

  <!-- Group averages row (always visible) -->
  <tr class="group-averages-row">
    @for (cell of group.averagesRow; track $index; let ci = $index) {
      <td [ngClass]="cellClass(ci, cell)">{{ cell }}</td>
    }
  </tr>
}
```

The `groupContentRows(group)` method returns an empty array when collapsed,
so the `@for` loop renders nothing — Angular handles the DOM removal.

---

## 8. Score Color Coding

The `cellClass` method returns space-separated CSS classes for each cell.
CSS handles the colors:

```css
td.score-fail { color: #990000; }
td.score-pass { color: #009900; }
```

In the component:

```typescript
cellClass(col: number, val: string | number): string {
  const base = this.cellClasses[col] ?? '';
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (!isNaN(num)) {
    return `${base} ${num < 60 ? 'score-fail' : 'score-pass'}`;
  }
  return base;
}
```

---

## 9. Complete File Listing

### styles.css (global)

Carries over the CSS variables, reset, and all structural/cosmetic styles
from the vanilla `complextable.css`. The only difference: wrap
page-level styles under `:root` or `html, body` as Angular CLI handles
global styles via `styles.css`.

Key CSS variables to keep in `:root`:

```css
:root {
  --col-width-default: 100px;
  --row-height-1line: 40px;
  --row-height-2lines: 60px;
  --color-group-name-bg: #a6aaae;
  --color-group-name-text: #ffffff;
  /* ... all other variables ... */
}
```

All sticky positioning, z-index, alternating rows, scrollbar styling,
and group row styles transfer directly.

### gradebook.component.html

```html
<div class="page">
  <header>
    <h1>Teacher's Gradebook</h1>
  </header>

  <div class="main-content">
    <div class="top-scrollbar-container" #topScrollbar>
      <div class="top-scrollbar-dummy" #topDummy></div>
    </div>

    <div class="table-container-wrapper">
      <div class="table-container" #tableContainer>
        <table #gradebookTable>
          <thead>
            @for (row of config.topRows; track $index; let ri = $index) {
              <tr>
                @for (cell of headerRows[ri]; track $index; let ci = $index) {
                  <th
                    [style.top]="headerGeometry.topOffsets[ri]"
                    [style.height]="headerGeometry.heightValues[ri]"
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
                        @if (!$last) {
                          {{ line }}<br />
                        } @else {
                          {{ line }}
                        }
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
            @for (group of groups; track group.name; let gi = $index) {
              <tr class="group-name-row">
                <td class="sticky-left">
                  <button
                    type="button"
                    class="group-toggle-btn"
                    (click)="toggleGroup(gi)"
                  >
                    <img [src]="toggleIcon(group)" alt="Toggle group" />
                  </button>
                  {{ group.name }}
                </td>
                @for (c of emptyCols(); track c) {
                  <td></td>
                }
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
  </div>

  <footer>
    <span #footerInfo>{{ footerText() }}</span>
    <span>Teacher's Gradebook v1.0</span>
  </footer>
</div>
```

### mock-data.service.ts

```typescript
import { Injectable } from '@angular/core';
import { GroupConfig, StudentGroup, CellClasses } from '../models/gradebook.models';

@Injectable({ providedIn: 'root' })
export class MockDataService {
  private readonly TOTAL_COLS = 15;
  private readonly NUM_ASSIGNMENTS = 12;

  private readonly GROUPS: GroupConfig[] = [
    { name: 'Class 1A', size: 8 },
    { name: 'Class 1B', size: 10 },
    { name: 'Class 2A', size: 7 },
  ];

  private readonly FIRST_NAMES = [
    'Emma', 'Liam', 'Olivia', 'Noah', 'Ava', /* ... full list ... */
  ];
  private readonly LAST_NAMES = [
    'Smith', 'Johnson', 'Williams', 'Brown', /* ... full list ... */
  ];

  generateHeaders(): string[][] {
    const row: string[] = [''];
    for (let a = 0; a < this.NUM_ASSIGNMENTS; a++) {
      row.push(`Asgn ${a + 1}`);
    }
    row.push('Average');
    row.push('Weighted Average');
    return [row];
  }

  generateGroups(): StudentGroup[] {
    let studentIndex = 0;
    return this.GROUPS.map((cfg) => {
      const rows: (string | number)[][] = [];
      for (let s = 0; s < cfg.size; s++) {
        rows.push(this.generateStudentRow(studentIndex++));
      }
      return {
        name: cfg.name,
        rows,
        averagesRow: this.computeGroupAveragesRow(rows),
        collapsed: false,
      };
    });
  }

  buildCellClasses(totalCols: number): CellClasses {
    const classes: CellClasses = {};
    const limit = totalCols - 2;
    for (let c = 1; c < limit; c++) classes[c] = 'score-cell';
    classes[limit] = 'score-cell';
    classes[totalCols - 1] = 'score-cell';
    return classes;
  }

  private generateStudentRow(index: number): (string | number)[] {
    const row: (string | number)[] = [
      `${this.LAST_NAMES[index % this.LAST_NAMES.length]}, ${this.FIRST_NAMES[index % this.FIRST_NAMES.length]}`,
    ];
    let sum = 0;
    for (let a = 0; a < this.NUM_ASSIGNMENTS; a++) {
      const score = Math.floor(Math.random() * 56) + 45;
      row.push(score);
      sum += score;
    }
    const avg = +(sum / this.NUM_ASSIGNMENTS).toFixed(1);
    row.push(avg);
    row.push(avg >= 90 ? 'A' : avg >= 80 ? 'B' : avg >= 70 ? 'C' : avg >= 60 ? 'D' : 'F');
    return row;
  }

  private computeGroupAveragesRow(groupRows: (string | number)[][]): (string | number)[] {
    const row: (string | number)[] = ['Group Average'];
    for (let a = 0; a < this.NUM_ASSIGNMENTS; a++) {
      let colSum = 0;
      for (const r of groupRows) colSum += parseFloat(String(r[1 + a])) || 0;
      row.push(+(colSum / groupRows.length).toFixed(1));
    }
    const avgIdx = 1 + this.NUM_ASSIGNMENTS;
    let colSum = 0;
    for (const r of groupRows) colSum += parseFloat(String(r[avgIdx])) || 0;
    const gAvg = colSum / groupRows.length;
    row.push(+gAvg.toFixed(1));
    row.push(gAvg >= 90 ? 'A' : gAvg >= 80 ? 'B' : gAvg >= 70 ? 'C' : gAvg >= 60 ? 'D' : 'F');
    return row;
  }
}
```

---

## Summary of Vanilla JS → Angular 20 Mappings

| Vanilla JS | Angular 20 |
|---|---|
| `document.createElement('tr')` | `@for` template syntax |
| `element.classList.add(...)` | `[ngClass]` / `[class.xxx]` binding |
| `element.style.display = 'none'` | `@for` loop over filtered array |
| `document.getElementById(...)` | `@ViewChild` template refs |
| `addEventListener('click', ...)` | `(click)="method()"` |
| `element.textContent = ...` | `{{ expression }}` interpolation |
| Manual DOM construction in `_buildBody` | Declarative template with `@for` / `@if` |
| Manual state tracking (`_groupElements`) | Signals + computed properties |
| `resizeObserver.observe(el)` | Same — used in `ngAfterViewInit` |
| CSS variables + sticky positioning | Identical — pure CSS |
| Scroll sync with `isSyncing` flag | Identical — native event listeners |
