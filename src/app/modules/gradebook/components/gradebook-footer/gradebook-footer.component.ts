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
