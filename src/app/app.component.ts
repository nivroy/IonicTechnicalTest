import { Component, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { RouterModule } from '@angular/router'; // 👈 importa esto
import { SyncService } from './services/sync.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  standalone: true,
  imports: [
    IonApp,
    IonRouterOutlet,
    RouterModule, // 👈 agrega esto
  ],
})
export class AppComponent {
  private _sync = inject(SyncService);
  constructor() {}
}
