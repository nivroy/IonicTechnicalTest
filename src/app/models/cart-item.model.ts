export interface CartItem {
  productId: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  updatedAt: number;
  deleted?: boolean;
}
