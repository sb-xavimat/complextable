import { Injectable } from '@angular/core';
import { GradebookApiResponse, CookedGradebookData, StudentGroup, CellClasses } from '../models/gradebook.models';
import { ViewContext } from './gradebook-view.service';

export interface ProcessedGradebookData {
  headerRows: string[][];
  groups: StudentGroup[];
  cellClasses: CellClasses;
  totalCols: number;
  studentCount: number;
}

@Injectable({ providedIn: 'root' })
export class GradebookDataService {

  /**
   * Transforma datos crudos del API en datos con estructura conocida.
   * TODO: Implementar según la estructura real del API.
   */
  cook(rawData: GradebookApiResponse, viewContext: ViewContext): CookedGradebookData {
    console.warn('GradebookDataService.cook() no implementado — retornando datos vacíos');
    return { headerRows: [], groups: [] };
  }

  /**
   * Transforma datos cocinados en datos listos para renderizar la tabla.
   */
  transform(cookedData: CookedGradebookData | null): ProcessedGradebookData {
    if (!cookedData) {
      return { headerRows: [], groups: [], cellClasses: {}, totalCols: 0, studentCount: 0 };
    }

    const totalCols = cookedData.headerRows[0]?.length ?? 0;

    const cellClasses: CellClasses = {};
    for (let c = 1; c < totalCols; c++) {
      cellClasses[c] = 'score-cell';
    }

    const groups: StudentGroup[] = cookedData.groups.map(g => ({ ...g, collapsed: false }));
    const studentCount = groups.reduce((sum, g) => sum + g.rows.length, 0);

    return { headerRows: cookedData.headerRows, groups, cellClasses, totalCols, studentCount };
  }
}
