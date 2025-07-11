// src/app/services/storage/local-cart-storage.interface.ts
import { CartItem } from '../../models/cart-item.model';

export interface LocalCartStorage {
  getItems(): Promise<CartItem[]>;
  saveItem(item: CartItem): Promise<void>;
  removeItem(productId: string): Promise<void>;
  getAllItems?(includeDeleted: boolean): Promise<CartItem[]>;
  clear(): Promise<void>;

  addPending(productId: string): Promise<void>;
  getPending(): Promise<string[]>;
  clearPending(productId: string): Promise<void>;
}
