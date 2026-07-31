import mongoose, { Schema, Document } from 'mongoose';
import { InventoryItem } from '../types.js';

export interface IProductDocument extends Omit<InventoryItem, 'id'>, Document {
  id: string;
}

const ProductSchema: Schema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    category: { type: String, required: true },
    quantity: { type: Number, required: true, default: 0 },
    minThreshold: { type: Number, required: true, default: 5 },
    unit: { type: String, required: true, default: 'piece' },
    status: { type: String, required: true, default: 'In Stock' },
    image: { type: String },
    supplier: { type: String },
    description: { type: String },
    lastUpdated: { type: String, required: true }
  },
  { timestamps: true }
);

export const ProductModel = mongoose.model<IProductDocument>('Product', ProductSchema);
