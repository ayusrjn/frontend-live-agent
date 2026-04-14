import { NextResponse } from 'next/server';
import dbConnect from '../../../lib/mongodb';
import { User, Order, SupportTicket, Complaint } from '../../../lib/models';

export async function POST(request: Request) {
  try {
    await dbConnect();

    // Clear existing data so we have a clean state with 5 users
    await User.deleteMany({});
    await Order.deleteMany({});
    await SupportTicket.deleteMany({});
    await Complaint.deleteMany({});

    // Users with varied wallet balances representing different customer tiers
    const usersData = [
      { _id: 1, name: 'Aarav Sharma', email: 'aarav@example.com', phone: '+919876543210', wallet_balance: 500 },
      { _id: 2, name: 'Priya Patel', email: 'priya@example.com', phone: '+919876543211', wallet_balance: 150 },
      { _id: 3, name: 'Rohan Gupta', email: 'rohan@example.com', phone: '+919876543212', wallet_balance: 0 },
      { _id: 4, name: 'Ananya Singh', email: 'ananya@example.com', phone: '+919876543213', wallet_balance: 1200 },
      { _id: 5, name: 'Vikram Reddy', email: 'vikram@example.com', phone: '+919876543214', wallet_balance: 300 }
    ];

    await User.insertMany(usersData);

    const now = Date.now();

    // Orders designed to create distinct LTV tiers and test the 2-hour refund window:
    //   User 1 (Aarav):  High LTV ~₹12,000 — Loyal tier (100% refund)
    //   User 2 (Priya):  Mid LTV ~₹7,000  — Regular tier (75% refund)
    //   User 3 (Rohan):  Low LTV ~₹1,500  — New tier (30% refund)
    //   User 4 (Ananya): High LTV ~₹15,000 — Loyal tier (100% refund)
    //   User 5 (Vikram): Mid LTV ~₹3,500  — Moderate tier (50% refund)
    //
    // Each user has at least 1 order delivered within the last hour (refund-eligible)
    // and some orders delivered days ago (refund-ineligible).

    const ordersData = [
      // ── User 1 (Aarav) — Loyal customer, total ~₹12,150 ──
      { _id: 1,  user_id: 1, restaurant_name: 'Biryani By Kilo',      status: 'Delivered', total_amount: 2500, timestamp: new Date(now - 7 * 86400000) },  // 7 days ago
      { _id: 2,  user_id: 1, restaurant_name: 'Mughlai Darbar',        status: 'Delivered', total_amount: 3200, timestamp: new Date(now - 5 * 86400000) },  // 5 days ago
      { _id: 3,  user_id: 1, restaurant_name: 'South Indian Delights', status: 'Delivered', total_amount: 1800, timestamp: new Date(now - 3 * 86400000) },  // 3 days ago
      { _id: 4,  user_id: 1, restaurant_name: 'Chai Point',            status: 'Delivered', total_amount: 3500, timestamp: new Date(now - 86400000) },      // 1 day ago
      { _id: 5,  user_id: 1, restaurant_name: 'Punjabi Dhaba',         status: 'Delivered', total_amount: 1150, timestamp: new Date(now - 45 * 60000) },    // 45 min ago ✅ refund eligible

      // ── User 2 (Priya) — Regular customer, total ~₹7,050 ──
      { _id: 6,  user_id: 2, restaurant_name: 'Punjabi Dhaba',         status: 'Delivered', total_amount: 1200, timestamp: new Date(now - 10 * 86400000) }, // 10 days ago
      { _id: 7,  user_id: 2, restaurant_name: 'Street Chaat Corner',   status: 'Delivered', total_amount: 800,  timestamp: new Date(now - 6 * 86400000) },  // 6 days ago
      { _id: 8,  user_id: 2, restaurant_name: 'Biryani By Kilo',       status: 'Delivered', total_amount: 2200, timestamp: new Date(now - 4 * 86400000) },  // 4 days ago
      { _id: 9,  user_id: 2, restaurant_name: 'South Indian Delights', status: 'Delivered', total_amount: 1500, timestamp: new Date(now - 2 * 86400000) },  // 2 days ago
      { _id: 10, user_id: 2, restaurant_name: 'Mughlai Darbar',        status: 'Delivered', total_amount: 1350, timestamp: new Date(now - 30 * 60000) },    // 30 min ago ✅ refund eligible

      // ── User 3 (Rohan) — New customer, total ~₹1,500 ──
      { _id: 11, user_id: 3, restaurant_name: 'Street Chaat Corner',   status: 'Delivered', total_amount: 350,  timestamp: new Date(now - 3 * 86400000) },  // 3 days ago
      { _id: 12, user_id: 3, restaurant_name: 'Chai Point',            status: 'Delivered', total_amount: 450,  timestamp: new Date(now - 86400000) },      // 1 day ago
      { _id: 13, user_id: 3, restaurant_name: 'Punjabi Dhaba',         status: 'Delivered', total_amount: 700,  timestamp: new Date(now - 90 * 60000) },    // 90 min ago ✅ refund eligible
      { _id: 14, user_id: 3, restaurant_name: 'Biryani By Kilo',       status: 'Preparing', total_amount: 980,  timestamp: new Date(now - 15 * 60000) },    // 15 min ago (active order)

      // ── User 4 (Ananya) — Loyal customer, total ~₹15,200 ──
      { _id: 15, user_id: 4, restaurant_name: 'Mughlai Darbar',        status: 'Delivered', total_amount: 4500, timestamp: new Date(now - 14 * 86400000) }, // 14 days ago
      { _id: 16, user_id: 4, restaurant_name: 'Biryani By Kilo',       status: 'Delivered', total_amount: 3800, timestamp: new Date(now - 8 * 86400000) },  // 8 days ago
      { _id: 17, user_id: 4, restaurant_name: 'South Indian Delights', status: 'Delivered', total_amount: 2100, timestamp: new Date(now - 4 * 86400000) },  // 4 days ago
      { _id: 18, user_id: 4, restaurant_name: 'Punjabi Dhaba',         status: 'Cancelled', total_amount: 1600, timestamp: new Date(now - 2 * 86400000) },  // 2 days ago (cancelled)
      { _id: 19, user_id: 4, restaurant_name: 'Street Chaat Corner',   status: 'Delivered', total_amount: 3200, timestamp: new Date(now - 60 * 60000) },    // 60 min ago ✅ refund eligible

      // ── User 5 (Vikram) — Moderate customer, total ~₹3,650 ──
      { _id: 20, user_id: 5, restaurant_name: 'Chai Point',            status: 'Delivered', total_amount: 450,  timestamp: new Date(now - 12 * 86400000) }, // 12 days ago
      { _id: 21, user_id: 5, restaurant_name: 'Biryani By Kilo',       status: 'Delivered', total_amount: 1100, timestamp: new Date(now - 6 * 86400000) },  // 6 days ago
      { _id: 22, user_id: 5, restaurant_name: 'Mughlai Darbar',        status: 'Delivered', total_amount: 1300, timestamp: new Date(now - 3 * 86400000) },  // 3 days ago
      { _id: 23, user_id: 5, restaurant_name: 'South Indian Delights', status: 'Delivered', total_amount: 800,  timestamp: new Date(now - 50 * 60000) },    // 50 min ago ✅ refund eligible
      { _id: 24, user_id: 5, restaurant_name: 'Punjabi Dhaba',         status: 'Preparing', total_amount: 650,  timestamp: new Date(now - 10 * 60000) },    // 10 min ago (active order)
    ];

    await Order.insertMany(ordersData);

    return NextResponse.json({ message: 'Database seeded with 5 users, tiered LTV orders, and 2-hour refund test data' });
  } catch (error: any) {
    return NextResponse.json({ detail: error.message }, { status: 500 });
  }
}
