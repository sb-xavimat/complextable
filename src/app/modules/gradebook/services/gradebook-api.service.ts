import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { GradebookApiResponse } from '../models/gradebook.models';

@Injectable({ providedIn: 'root' })
export class GradebookApiService {
  private http = inject(HttpClient);

  /**
   * Obtiene los datos del gradebook del backend.
   * No transforma ni actualiza estado — solo retorna Observable del DTO.
   */
  load(): Observable<GradebookApiResponse> {
    return this.http.get<GradebookApiResponse>(`${environment.apiUrl}/gradebook`);
  }
}
