import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, AlertController, ToastController } from '@ionic/angular';
import { ProductsService } from '../../services/products.service';
import { Product } from '../../models/product.model';
import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';
import { Network } from '@capacitor/network';
import { RouterModule } from '@angular/router';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { addIcons } from 'ionicons';
import {
  pricetagOutline,
  cartOutline,
  logOutOutline
} from 'ionicons/icons';

addIcons({
  'pricetag-outline': pricetagOutline,
  'cart-outline': cartOutline,
  'log-out-outline': logOutOutline
});

@Component({
  standalone: true,
  selector: 'app-products',
  templateUrl: './products.page.html',
  styleUrls: ['./products.page.scss'],
  imports: [IonicModule, CommonModule, RouterModule],
})
export class ProductsPage implements OnInit {
  private productsService = inject(ProductsService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private cartService = inject(CartService);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);

  products$!: Observable<Product[]>;

  ngOnInit() {
    this.products$ = this.productsService.getProducts();
  }

  async logout() {
    await this.authService.logout();
    this.router.navigate(['/']);
  }

  async addToCart(product: Product) {
    await this.cartService.addToCart(product);
    const toast = await this.toastCtrl.create({
      message: 'Producto agregado al carrito',
      duration: 1500,
    });
    toast.present();
  }

  async buyNow(product: Product) {
    const status = await Network.getStatus();
    if (!status.connected) {
      const alert = await this.alertCtrl.create({
        header: 'Sin conexión',
        message: 'Necesitas conexión a internet para completar tu compra.',
        buttons: ['OK'],
      });
      await alert.present();
      return;
    }
    await this.cartService.removeItem(product.id!);
    const alert = await this.alertCtrl.create({
      header: 'Compra',
      message: 'Compra realizada con éxito',
      buttons: ['OK'],
    });
    await alert.present();
  }
  goToProductDetail(product: Product) {
    this.router.navigate(['/product', product.id]);
  }
}
