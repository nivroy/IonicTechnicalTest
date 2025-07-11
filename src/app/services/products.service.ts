import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, doc, getDoc } from '@angular/fire/firestore';
import { Observable, from, map } from 'rxjs';
import { Product } from '../models/product.model';

@Injectable({ providedIn: 'root' })
export class ProductsService {
  private firestore = inject(Firestore);

  getProducts(): Observable<Product[]> {
    const productsRef = collection(this.firestore, 'products');
    return collectionData(productsRef, { idField: 'id' }) as Observable<Product[]>;
  }

  getProductById(id: string): Observable<Product | undefined> {
    const productRef = doc(this.firestore, 'products', id);
    return from(getDoc(productRef)).pipe(
      map(snapshot => (snapshot.exists() ? { id: snapshot.id, ...(snapshot.data() as Omit<Product, 'id'>) } as Product : undefined))
    );
  }
}
