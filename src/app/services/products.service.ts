import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

export interface Product {
  nombre: string;
  descripcion: string;
  precio: number;
  stock: number;
  imagen: string;
  id?: string;
}

@Injectable({ providedIn: 'root' })
export class ProductsService {
  private firestore = inject(Firestore);

  getProducts(): Observable<Product[]> {
    const productsRef = collection(this.firestore, 'productos');
    return collectionData(productsRef, { idField: 'id' }) as Observable<Product[]>;
  }
}
