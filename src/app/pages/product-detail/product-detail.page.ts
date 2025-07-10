import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, AlertController, ToastController } from '@ionic/angular';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Observable } from 'rxjs';
import { ProductsService, Product } from '../../services/products.service';
import { CartService } from '../../services/cart.service';
import { Network } from '@capacitor/network';

@Component({
  standalone: true,
  selector: 'app-product-detail',
  templateUrl: './product-detail.page.html',
  styleUrls: ['./product-detail.page.scss'],
  imports: [IonicModule, CommonModule, RouterModule],
})
export class ProductDetailPage implements OnInit {
  private productsService = inject(ProductsService);
  private route = inject(ActivatedRoute);
  private cartService = inject(CartService);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);

  product$!: Observable<Product | undefined>;

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.product$ = this.productsService.getProductById(id);
    }
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
}
