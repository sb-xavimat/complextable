import { Component, OnInit, inject, computed } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { RouterLink } from '@angular/router';
import { GradebookStateService } from '../../services/gradebook-state.service';

interface BreadcrumbItem {
  label: string;
  routerLink?: string[];
  isActive: boolean;
}

/**
 * Componente de breadcrumbs (migas de pan).
 * Muestra la navegación jerárquica basada en los parámetros de ruta.
 *
 * Ejemplos:
 * - /gradebook/123 → Class 123
 * - /gradebook/123/456 → Class 123 > Unit 456
 * - /gradebook/123/456/789 → Class 123 > Unit 456 > Lesson 789
 * etc.
 *
 * NOTA: :classid es obligatorio. No hay ruta /gradebook sin más.
 */
@Component({
  selector: 'app-gradebook-breadcrumbs',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './gradebook-breadcrumbs.component.html',
  styleUrl: './gradebook-breadcrumbs.component.scss',
})
export class GradebookBreadcrumbsComponent implements OnInit {
  protected state = inject(GradebookStateService);
  private route = inject(ActivatedRoute);

  // Parámetros actuales (classid es obligatorio, el resto opcionales)
  classid: string = '';
  unidid?: string;
  lessonid?: string;
  activid?: string;
  segmentid?: string;

  // Breadcrumbs dinámicos computados
  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    const items: BreadcrumbItem[] = [];

    // Class (viene del :classid obligatorio)
    items.push({
      label: `Class ${this.classid}`,
      routerLink: ['/gradebook', this.classid],
      isActive: !this.unidid && !this.lessonid && !this.activid && !this.segmentid,
    });

    // Unit
    if (this.unidid) {
      items.push({
        label: `Unit ${this.unidid}`,
        routerLink: ['/gradebook', this.classid, this.unidid],
        isActive: !this.lessonid && !this.activid && !this.segmentid,
      });

      // Lesson
      if (this.lessonid) {
        items.push({
          label: `Lesson ${this.lessonid}`,
          routerLink: ['/gradebook', this.classid, this.unidid, this.lessonid],
          isActive: !this.activid && !this.segmentid,
        });

        // Activity
        if (this.activid) {
          items.push({
            label: `Activity ${this.activid}`,
            routerLink: ['/gradebook', this.classid, this.unidid, this.lessonid, this.activid],
            isActive: !this.segmentid,
          });

          // Segment (dentro de sub-actividad)
          if (this.segmentid) {
            items.push({
              label: `Segment ${this.segmentid}`,
              isActive: true, // Última en la jerarquía, no es enlace
            });
          }
        }
      }
    }

    return items;
  });

  ngOnInit(): void {
    // Leer parámetros de ruta
    this.route.paramMap.subscribe(params => {
      // classid es obligatorio
      this.classid = params.get('classid')!;
      // El resto son opcionales
      this.unidid = params.get('unidid') ?? undefined;
      this.lessonid = params.get('lessonid') ?? undefined;
      this.activid = params.get('activid') ?? undefined;
      this.segmentid = params.get('segmentid') ?? undefined;
    });
  }
}
