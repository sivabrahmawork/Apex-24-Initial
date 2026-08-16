import { NextResponse } from "next/server";
import { runClassificationBatch } from "../../../../services/classification/worker";
export async function GET() { return NextResponse.json({ processed: await runClassificationBatch() }); }
