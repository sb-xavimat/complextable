import { Component, OnInit, OnDestroy, effect, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { catchError } from 'rxjs/operators';
import { of, Subscription } from 'rxjs';
import { GradebookApiService } from '../../services/gradebook-api.service';
import { GradebookDataService } from '../../services/gradebook-data.service';
import { GradebookStateService } from '../../services/gradebook-state.service';
import { GradebookHeaderComponent } from '../gradebook-header/gradebook-header.component';
import { GradebookBreadcrumbsComponent } from '../gradebook-breadcrumbs/gradebook-breadcrumbs.component';
import { GradebookTableComponent } from '../gradebook-table/gradebook-table.component';
import { GradebookFooterComponent } from '../gradebook-footer/gradebook-footer.component';

/**
 * Componente orquestador del módulo Gradebook.
 *
 * Responsabilidades:
 * 1. Cargar datos del API UNA SOLA VEZ al inicializar
 * 2. Sincronizar parámetros de ruta (classid, unidid, etc.)
 * 3. Sincronizar parámetros de vista desde query params
 * 4. Re-transformar datos cuando cambien ruta o vista (sin pedir API de nuevo)
 * 5. Actualizar el estado global con datos procesados
 */
@Component({
  selector: 'app-gradebook-layout',
  standalone: true,
  imports: [
    GradebookHeaderComponent,
    GradebookBreadcrumbsComponent,
    GradebookTableComponent,
    GradebookFooterComponent
  ],
  templateUrl: './gradebook-layout.component.html',
  styleUrl: './gradebook-layout.component.scss',
})
export class GradebookLayoutComponent implements OnInit, OnDestroy {
  private api = inject(GradebookApiService);
  private dataService = inject(GradebookDataService);
  protected state = inject(GradebookStateService);
  private route = inject(ActivatedRoute);

  private subscriptions = new Subscription();

  constructor() {
    // Effect: cuando cambie rawData, cocinar y transformar
    effect(() => {
      const rawData = this.state.rawData();

      if (!rawData) {
        this.state.cookedData.set(null);
        return;
      }

      const viewContext = this.state.viewContext();
      const cooked = this.dataService.cook(rawData, viewContext);
      this.state.cookedData.set(cooked);
      this.state.updateProcessedData(this.dataService.transform(cooked));
    });
  }

  ngOnInit(): void {
    // 1. Cargar datos del API UNA SOLA VEZ
    this.state.loading.set(true);
    this.state.error.set(null);

    this.subscriptions.add(
      this.api.load()
        .pipe(
          catchError(err => {
            const errorMsg = err?.message ?? 'Error al cargar el gradebook';
            this.state.error.set(errorMsg);
            return of(null);
          })
        )
        .subscribe(rawData => {
          if (rawData) {
            this.state.rawData.set(rawData);
          }
          this.state.loading.set(false);
        })
    );

    // 2. Sincronizar parámetros de ruta (classid, unidid, etc.)
    // Se actualiza state.viewContext con los parámetros de ruta
    this.subscriptions.add(
      this.route.paramMap.subscribe(paramMap => {
        this.state.viewContext.update(current => ({
          ...current,
          classid: paramMap.get('classid') ?? undefined,
          unidid: paramMap.get('unidid') ?? undefined,
          lessonid: paramMap.get('lessonid') ?? undefined,
          activid: paramMap.get('activid') ?? undefined,
          segmentid: paramMap.get('segmentid') ?? undefined,
        }));
      })
    );

    // 3. Sincronizar parámetros de vista desde query params
    // Se actualiza state.viewContext con los parámetros de visualización
    this.subscriptions.add(
      this.route.queryParamMap.subscribe(queryParamMap => {
        // Capturar todos los query params y actualizarlos en viewContext
        queryParamMap.keys.forEach(key => {
          const value = queryParamMap.get(key);
          if (value) {
            // Convertir 'true'/'false' a booleano, el resto a string
            const parsedValue = value === 'true' ? true : value === 'false' ? false : value;
            this.state.viewContext.update(current => ({
              ...current,
              [key]: parsedValue,
            }));
          }
        });
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}
