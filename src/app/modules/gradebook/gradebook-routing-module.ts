import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: ':classid',
    loadComponent: () => import('./components/gradebook-layout/gradebook-layout.component').then(m => m.GradebookLayoutComponent)
  },
  {
    path: ':classid/:unidid',
    loadComponent: () => import('./components/gradebook-layout/gradebook-layout.component').then(m => m.GradebookLayoutComponent)
  },
  {
    path: ':classid/:unidid/:lessonid',
    loadComponent: () => import('./components/gradebook-layout/gradebook-layout.component').then(m => m.GradebookLayoutComponent)
  },
  {
    path: ':classid/:unidid/:lessonid/:activid',
    loadComponent: () => import('./components/gradebook-layout/gradebook-layout.component').then(m => m.GradebookLayoutComponent)
  },
  {
    path: ':classid/:unidid/:lessonid/:activid/:subactid',
    loadComponent: () => import('./components/gradebook-layout/gradebook-layout.component').then(m => m.GradebookLayoutComponent)
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class GradebookRoutingModule {}
