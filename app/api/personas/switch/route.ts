import { NextResponse } from "next/server";
export async function POST(req: Request) {
  return NextResponse.redirect(new URL("/profile/me", req.url)); // switcher UI lives on Profile
}
