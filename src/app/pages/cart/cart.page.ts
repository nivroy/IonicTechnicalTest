import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, AlertController } from '@ionic/angular';
import { RouterModule, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CartService } from '../../services/cart.service';
import { CartItem } from '../../models/cart-item.model';
import { AuthService } from '../../services/auth.service';
import { SyncService } from '../../services/sync.service';
import { Network } from '@capacitor/network';

@Component({
  standalone: true,
  selector: 'app-cart',
  templateUrl: './cart.page.html',
  styleUrls: ['./cart.page.scss'],
  imports: [IonicModule, CommonModule, RouterModule],
})
export class CartPage implements OnInit {
  private cartService = inject(CartService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private alertCtrl = inject(AlertController);
  private sync = inject(SyncService);

  cartItems$!: Observable<CartItem[]>;
  total$!: Observable<number>;

  ngOnInit() {
    this.cartItems$ = this.cartService.getCartItems();
    this.total$ = this.cartItems$.pipe(
      map(items => items.reduce((acc, i) => acc + i.precio * i.cantidad, 0))
    );
  }

  async removeItem(productId: string) {
    await this.cartService.removeItem(productId);
  }

  async clearCart() {
    await this.cartService.clearCart();
  }

  async checkout() {
    const online = await Network.getStatus();
    if (!online.connected) {
      const alert = await this.alertCtrl.create({
        header: 'Sin conexión',
        message: 'Necesitas conexión a internet para completar tu compra.',
        buttons: ['OK'],
      });
      await alert.present();
      return;
    }
    const alert = await this.alertCtrl.create({
      header: 'Compra',
      message: 'Compra realizada con éxito',
      buttons: ['OK'],
    });
    await alert.present();
    await this.cartService.clearCart();
  }

  async logout() {
    await this.authService.logout();
    this.router.navigate(['/']);
  }
}
