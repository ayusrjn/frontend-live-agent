import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  _id: { type: Number, required: true }, // Map 'id' to _id to keep INT behavior easily, or just use a custom field:
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true, unique: true },
  wallet_balance: { type: Number, default: 0 },
});

// Virtual for 'id' to map to '_id' seamlessly in JSON representations
UserSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    (ret as any).id = ret._id;
    delete (ret as any)._id;
    delete (ret as any).__v;
  }
});

const OrderSchema = new mongoose.Schema({
  _id: { type: Number, required: true },
  user_id: { type: Number, required: true, ref: 'User' },
  restaurant_name: { type: String, required: true },
  status: { type: String, required: true },
  total_amount: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
});

OrderSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    (ret as any).id = ret._id;
    delete (ret as any)._id;
    delete (ret as any).__v;
  }
});

const SupportTicketSchema = new mongoose.Schema({
  _id: { type: Number, required: true },
  user_id: { type: Number, required: true, ref: 'User' },
  order_id: { type: Number, required: false, ref: 'Order' },
  issue_type: { type: String, required: true },
  status: { type: String, required: true },
  transcript: { type: String, required: false },
});

SupportTicketSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    (ret as any).id = ret._id;
    delete (ret as any)._id;
    delete (ret as any).__v;
  }
});

export const User = mongoose.models.User || mongoose.model('User', UserSchema);
export const Order = mongoose.models.Order || mongoose.model('Order', OrderSchema);
export const SupportTicket = mongoose.models.SupportTicket || mongoose.model('SupportTicket', SupportTicketSchema);
