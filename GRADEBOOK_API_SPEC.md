# Especificación de la API del Gradebook

## Endpoint

```
GET /api/gradebook
```

Parámetros de query opcionales (para filtrado):
- `classid` (string): ID de la clase
- `unidid` (string): ID de la unidad
- `lessonid` (string): ID de la lección
- `activid` (string): ID de la actividad
- `subactid` (string): ID de la sub-actividad

---

## Estructura de Respuesta

```typescript
interface GradebookApiResponse {
  headerRows: string[][];
  groups: StudentGroup[];
}

interface StudentGroup {
  name: string;
  rows: (string | number)[][];
  averagesRow: (string | number)[];
}
```

---

## Ejemplo de JSON

```json
{
  "headerRows": [
    [
      "Student",
      "Exam 1",
      "Quiz 1",
      "Project 1",
      "Final Grade"
    ],
    [
      "",
      "100pts",
      "50pts",
      "100pts",
      "250pts"
    ]
  ],
  "groups": [
    {
      "name": "Group A - Morning",
      "rows": [
        ["Alice Johnson", 85, 45, 92, 222],
        ["Bob Smith", 92, 48, 88, 228],
        ["Charlie Brown", 78, 42, 85, 205]
      ],
      "averagesRow": ["Average", 85, 45, 88, 218.3]
    },
    {
      "name": "Group B - Afternoon",
      "rows": [
        ["Diana Prince", 95, 50, 95, 240],
        ["Eve Wilson", 88, 46, 90, 224],
        ["Frank Castle", 82, 44, 87, 213]
      ],
      "averagesRow": ["Average", 88.3, 46.7, 90.7, 225.7]
    }
  ]
}
```

---

## Detalles de la Estructura

### `headerRows: string[][]`

**Descripción:** Array de filas de cabecera para la tabla.

- **Primer fila**: Nombres de columnas (estudiante + evaluaciones)
- **Filas siguientes** (opcionales): Meta-información como puntos máximos, pesos, etc.

**Ejemplo:**
```json
[
  ["Student", "Exam 1", "Quiz 1", "Project 1", "Final Grade"],
  ["", "100pts", "50pts", "100pts", "250pts"]
]
```

**Notas:**
- Primera columna siempre es el nombre del estudiante
- El resto son evaluaciones/calificaciones
- Puede haber múltiples filas de cabecera (flexibilidad)
- El frontend determina qué filas son "sticky top" mediante la config

---

### `groups: StudentGroup[]`

**Descripción:** Array de grupos de estudiantes.

#### Propiedades de `StudentGroup`:

#### `name: string`
Nombre del grupo (ej: "Group A - Morning", "Class 2B", etc.)

**Ejemplo:**
```json
"name": "Group A - Morning"
```

---

#### `rows: (string | number)[][]`
Array de filas de estudiantes dentro del grupo.

- Cada fila es un array de valores (mixed: nombres son `string`, calificaciones son `number`)
- **Primera columna**: nombre del estudiante (string)
- **Columnas siguientes**: valores numéricos o string según corresponda

**Ejemplo:**
```json
"rows": [
  ["Alice Johnson", 85, 45, 92, 222],
  ["Bob Smith", 92, 48, 88, 228],
  ["Charlie Brown", 78, 42, 85, 205]
]
```

---

#### `averagesRow: (string | number)[]`
Fila de promedios del grupo.

- **Primera columna**: típicamente "Average" o similar (string)
- **Columnas siguientes**: valores promediados (number)

**Ejemplo:**
```json
"averagesRow": ["Average", 85, 45, 88, 218.3]
```

---

## Transformación en el Frontend

El `GradebookDataService` transforma este DTO en datos procesados:

```typescript
ProcessedGradebookData {
  headerRows: string[][];           // Copia del DTO
  groups: StudentGroup[];           // +collapsed: false a cada grupo
  cellClasses: { [colIndex]: string };  // Genera "score-cell" para cada col
  totalCols: number;                // headerRows[0].length
  studentCount: number;             // Suma de rows en todos los grupos
}
```

---

## Validaciones Esperadas

El backend debe asegurar:

1. ✅ `headerRows` no es vacío (al menos 1 fila)
2. ✅ Todos los `groups` tienen `name`, `rows`, `averagesRow`
3. ✅ Todas las filas tienen **el mismo número de columnas** que `headerRows[0].length`
4. ✅ Los valores en `rows` y `averagesRow` son `string | number`
5. ✅ La primera columna siempre es `string` (nombres)
6. ✅ Las columnas subsecuentes son principalmente `number` (calificaciones)

---

## Ejemplo Minimalista

```json
{
  "headerRows": [
    ["Name", "Score"]
  ],
  "groups": [
    {
      "name": "All Students",
      "rows": [
        ["Student 1", 85],
        ["Student 2", 92]
      ],
      "averagesRow": ["Average", 88.5]
    }
  ]
}
```

---

## Notas de Implementación

- El frontend NO modifica el DTO antes de guardarlo en estado
- El `collapsed` state (booleano) se **añade** en el frontend, no viene del backend
- Las clases CSS (`score-cell`, `score-fail`, `score-pass`) se generan en el frontend
- El gradebook es **read-only** en esta versión (sin POST/PUT)

