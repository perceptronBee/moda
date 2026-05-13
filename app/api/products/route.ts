import { NextResponse } from 'next/server';
import mockProducts from '@/data/mock_products.json';

export async function GET() {
  // CRITICAL REQUIREMENT: Implement an artificial delay of exactly 1500ms
  // to simulate XML fetch and test luxury skeleton loading states.
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  return NextResponse.json(mockProducts);
}
