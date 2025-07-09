import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, AlertController, ToastController } from '@ionic/angular';
import { ProductsService, Product } from '../../services/products.service';
import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';

@Component({
  standalone: true,
  selector: 'app-products',
  templateUrl: './products.page.html',
  styleUrls: ['./products.page.scss'],
  imports: [IonicModule, CommonModule],
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
    await this.cartService.removeItem(product.id!);
    const alert = await this.alertCtrl.create({
      header: 'Compra',
      message: 'Compra realizada con éxito',
      buttons: ['OK'],
    });
    await alert.present();
  }
}
