import { NextResponse } from "next/server";
import { closeExpiredPolls } from "../../../../services/editorial";
export async function GET() { return NextResponse.json({ closed: await closeExpiredPolls() }); }
