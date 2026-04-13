import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/mongodb';
import { Order } from '../../../../lib/models';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    await dbConnect();
    const resolvedParams = await params;
    const userId = parseInt(resolvedParams.userId, 10);
    const orders = await Order.find({ user_id: userId });

    return NextResponse.json(orders);
  } catch (error) {
    return NextResponse.json({ detail: 'Internal Server Error' }, { status: 500 });
  }
}
