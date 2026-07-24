/**
 * Estructura de un grupo de estudiantes.
 *
 * NOTA: El campo `collapsed` se añade EN EL FRONTEND, no viene del API.
 */
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

/**
 * Datos CRUDOS que vienen del API.
 * La estructura es DESCONOCIDA — puede ser XML, JSON con otra forma, GraphQL, etc.
 *
 * Se recibe como `any` y se pasa al GradebookCookerService para ser transformado
 * en CookedGradebookData.
 */
export type GradebookApiResponse = any;

/**
 * Datos COCINADOS (después de cocinar los datos crudos del API).
 *
 * Esta es la estructura con la que trabaja el frontend una vez que han sido
 * transformados de su forma nativa a esta forma conocida.
 *
 * El GradebookCookerService es responsable de producir esta estructura
 * a partir de GradebookApiResponse (datos crudos).
 */
export interface CookedGradebookData {
  headerRows: string[][];
  groups: Omit<StudentGroup, 'collapsed'>[];
}