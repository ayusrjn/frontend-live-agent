import { NextResponse } from 'next/server';
import dbConnect from '../../../lib/mongodb';
import { User, Order, SupportTicket } from '../../../lib/models';

export async function POST(request: Request) {
  try {
    await dbConnect();

    // Clear existing data so we have a clean state with 5 users
    await User.deleteMany({});
    await Order.deleteMany({});
    await SupportTicket.deleteMany({});

    const usersData = [
      { _id: 1, name: 'Aarav Sharma', email: 'aarav@example.com', phone: '+919876543210', wallet_balance: 500 },
      { _id: 2, name: 'Priya Patel', email: 'priya@example.com', phone: '+919876543211', wallet_balance: 150 },
      { _id: 3, name: 'Rohan Gupta', email: 'rohan@example.com', phone: '+919876543212', wallet_balance: 0 },
      { _id: 4, name: 'Ananya Singh', email: 'ananya@example.com', phone: '+919876543213', wallet_balance: 1200 },
      { _id: 5, name: 'Vikram Reddy', email: 'vikram@example.com', phone: '+919876543214', wallet_balance: 300 }
    ];

    await User.insertMany(usersData);

    const restaurants = ['Biryani By Kilo', 'Punjabi Dhaba', 'South Indian Delights', 'Chai Point', 'Mughlai Darbar', 'Street Chaat Corner'];
    const statuses = ['Delivered', 'Delivered', 'Delivered', 'Cancelled', 'Preparing'];
    
    const ordersData = [];
    let orderIdCounter = 1;

    for (let userId = 1; userId <= 5; userId++) {
      // 5 orders per user
      for (let i = 0; i < 5; i++) {
        const amount = Math.floor(Math.random() * (1500 - 150 + 1)) + 150; // Between ₹150 and ₹1500
        const isLatest = i === 4; // The last one can be 'Preparing' or 'Delivered'
        
        ordersData.push({
          _id: orderIdCounter++,
          user_id: userId,
          restaurant_name: restaurants[Math.floor(Math.random() * restaurants.length)],
          status: isLatest ? 'Preparing' : statuses[Math.floor(Math.random() * (statuses.length - 1))],
          total_amount: amount,
          timestamp: new Date(Date.now() - (4 - i) * 86400000) // spread over last few days
        });
      }
    }

    await Order.insertMany(ordersData);

    return NextResponse.json({ message: 'Database seeded with 5 users and real-world Indian orders' });
  } catch (error: any) {
    return NextResponse.json({ detail: error.message }, { status: 500 });
  }
}
