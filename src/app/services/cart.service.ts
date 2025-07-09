import { Injectable, inject } from '@angular/core';
import { Firestore, doc, setDoc, updateDoc, deleteDoc, getDoc, getDocs, collection, collectionData } from '@angular/fire/firestore';
import { Auth, authState } from '@angular/fire/auth';
import { Observable, of, switchMap } from 'rxjs';
import { Product } from './products.service';

export interface CartItem {
  productId: string;
  nombre: string;
  precio: number;
  imagen: string;
  cantidad: number;
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);

  private async getUid(): Promise<string> {
    const user = await this.auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    return user.uid;
  }

  async addToCart(product: Product) {
    const uid = await this.getUid();
    const itemRef = doc(this.firestore, 'carts', uid, 'items', product.id!);
    const snap = await getDoc(itemRef);
    if (snap.exists()) {
      const data = snap.data() as CartItem;
      await updateDoc(itemRef, { cantidad: data.cantidad + 1 });
    } else {
      await setDoc(itemRef, {
        productId: product.id,
        nombre: product.nombre,
        precio: product.precio,
        imagen: product.imagen,
        cantidad: 1,
      });
    }
  }

  getCartItems(): Observable<CartItem[]> {
    return authState(this.auth).pipe(
      switchMap(user => {
        if (!user) return of([]);
        const itemsRef = collection(this.firestore, 'carts', user.uid, 'items');
        return collectionData(itemsRef, { idField: 'productId' }) as Observable<CartItem[]>;
      })
    );
  }

  async removeItem(productId: string) {
    const uid = await this.getUid();
    const itemRef = doc(this.firestore, 'carts', uid, 'items', productId);
    await deleteDoc(itemRef);
  }

  async clearCart() {
    const uid = await this.getUid();
    const itemsRef = collection(this.firestore, 'carts', uid, 'items');
    const snapshot = await getDocs(itemsRef);
    const promises = snapshot.docs.map(d => deleteDoc(d.ref));
    await Promise.all(promises);
  }
}
