import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ url: process.env.VTON_API_URL || "" });
}
