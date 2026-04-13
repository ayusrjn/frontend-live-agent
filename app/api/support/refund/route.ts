import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import { User, Order, SupportTicket } from '../../../../lib/models';

export async function POST(request: Request) {
  try {
    await dbConnect();
    const body = await request.json();
    const { user_id, order_id, reason } = body;

    const order = await Order.findOne({ _id: order_id, user_id: user_id });
    
    if (!order) {
      return NextResponse.json({ detail: 'Order not found' }, { status: 404 });
    }

    // Generate a simple ID for the ticket since we are setting _id manually
    const ticketCount = await SupportTicket.countDocuments();
    const newTicketId = ticketCount + 1;

    const ticket = new SupportTicket({
      _id: newTicketId,
      user_id: user_id,
      order_id: order_id,
      issue_type: 'Refund',
      status: 'Open',
      transcript: reason
    });

    await ticket.save();

    order.status = 'Refund Processing';
    await order.save();

    // Give user their money back immediately in their wallet
    const user = await User.findById(user_id);
    if (user) {
      user.wallet_balance = (user.wallet_balance || 0) + order.total_amount;
      await user.save();
    }

    return NextResponse.json({
      message: 'Refund processing. Ticket opened and amount added to wallet.',
      ticket_id: newTicketId
    });
  } catch (error: any) {
    return NextResponse.json({ detail: error.message }, { status: 500 });
  }
}
