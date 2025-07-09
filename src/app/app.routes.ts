import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'register',
    loadComponent: () => import('./pages/login/login.page').then(m => m.LoginPage)
  },
  {
    path: '',
    loadComponent: () => import('./pages/register/register.page').then(m => m.RegisterPage)
  },
];
