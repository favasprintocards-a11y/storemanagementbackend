import mongoose, { Schema, Document } from 'mongoose';
import { StockHistoryLog } from '../types.js';

export interface IHistoryDocument extends Omit<StockHistoryLog, 'id'>, Document {
  id: string;
}

const HistorySchema: Schema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    productId: { type: String, required: true },
    productName: { type: String, required: true },
    category: { type: String, required: true },
    type: { type: String, required: true },
    changeQty: { type: Number, required: true },
    previousQty: { type: Number, required: true },
    newQty: { type: Number, required: true },
    unit: { type: String, required: true },
    timestamp: { type: String, required: true },
    note: { type: String }
  },
  { timestamps: true }
);

export const HistoryModel = mongoose.model<IHistoryDocument>('HistoryLog', HistorySchema);
