import { NextResponse } from "next/server";
import { runDailyPipeline } from "../../../../../services/topics/pipeline";
export async function GET() { return NextResponse.json(await runDailyPipeline()); }
