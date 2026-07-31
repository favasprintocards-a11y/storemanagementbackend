import mongoose, { Schema } from 'mongoose';
const CategorySchema = new Schema({
    name: { type: String, required: true, unique: true, trim: true }
}, { timestamps: true });
export const CategoryModel = mongoose.model('Category', CategorySchema);
