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
