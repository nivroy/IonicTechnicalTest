import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CartRepository } from '../repositories/cart.repository';
import { CartItem } from '../models/cart-item.model';
import { Product } from '../models/product.model';

@Injectable({ providedIn: 'root' })
export class CartService {
  private repository = inject(CartRepository);

  getCartItems(): Observable<CartItem[]> {
    return this.repository.getCartItems();
  }

  addToCart(product: Product) {
    return this.repository.addToCart(product);
  }

  removeItem(productId: string) {
    return this.repository.removeItem(productId);
  }

  clearCart() {
    return this.repository.clearCart();
  }

  sync() {
    return this.repository.sync();
  }
}
