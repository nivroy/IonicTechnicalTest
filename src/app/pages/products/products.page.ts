import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { ProductsService, Product } from '../../services/products.service';
import { AuthService } from '../../services/auth.service';
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

  products$!: Observable<Product[]>;

  ngOnInit() {
    this.products$ = this.productsService.getProducts();
  }

  async logout() {
    await this.authService.logout();
    this.router.navigate(['/']);
  }
}
