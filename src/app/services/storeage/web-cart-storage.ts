// src/app/services/storage/web-cart-storage.ts
import { LocalCartStorage } from './local-cart-storage.interface';
import { CartItem } from '../../models/cart-item.model';
import localforage from 'localforage';

export class WebCartStorage implements LocalCartStorage {
  constructor(private uid: string) {}

  private async getStore() {
    return localforage.createInstance({ name: 'cart', storeName: `cart_${this.uid}` });
  }

  private async getMetaStore() {
    return localforage.createInstance({ name: 'cart_meta', storeName: `cart_meta_${this.uid}` });
  }

  async getItems(): Promise<CartItem[]> {
    const store = await this.getStore();
    const keys = await store.keys();
    const items = await Promise.all(keys.map(k => store.getItem<CartItem>(k)));
    return items.filter((i): i is CartItem => !!i && !i.deleted);
  }

  async saveItem(item: CartItem): Promise<void> {
    const store = await this.getStore();
    await store.setItem(item.productId, item);
  }

  async removeItem(productId: string): Promise<void> {
    const store = await this.getStore();
    await store.removeItem(productId);
  }

  async clear(): Promise<void> {
    const store = await this.getStore();
    await store.clear();
  }

  async addPending(productId: string): Promise<void> {
    const meta = await this.getMetaStore();
    const pending: string[] = (await meta.getItem('pendingSync')) ?? [];
    if (!pending.includes(productId)) {
      pending.push(productId);
      await meta.setItem('pendingSync', pending);
    }
  }

  async getPending(): Promise<string[]> {
    const meta = await this.getMetaStore();
    return (await meta.getItem<string[]>('pendingSync')) ?? [];
  }

  async clearPending(productId: string): Promise<void> {
    const meta = await this.getMetaStore();
    const pending: string[] = (await meta.getItem('pendingSync')) ?? [];
    const idx = pending.indexOf(productId);
    if (idx >= 0) {
      pending.splice(idx, 1);
      await meta.setItem('pendingSync', pending);
    }
  }
}
