import { Injectable, inject } from '@angular/core';
import { Network } from '@capacitor/network';
import { BehaviorSubject } from 'rxjs';
import { CartService } from './cart.service';

@Injectable({ providedIn: 'root' })
export class SyncService {
  private online$ = new BehaviorSubject<boolean>(true);
  private cartService = inject(CartService);

  constructor() {
    Network.getStatus().then(status => {
      this.online$.next(status.connected);
      if (status.connected) {
        this.cartService.sync();
      }
    });

    Network.addListener('networkStatusChange', status => {
      this.online$.next(status.connected);
      if (status.connected) {
        this.cartService.sync();
      }
    });

    window.addEventListener('online', () => {
      this.online$.next(true);
      this.cartService.sync();
    });
    window.addEventListener('offline', () => this.online$.next(false));
  }

  isOnline() {
    return this.online$.asObservable();
  }
}
