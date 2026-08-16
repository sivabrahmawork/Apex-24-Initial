import { NextResponse } from "next/server";
import { recomputeArchetypes } from "../../../../services/archetype";
export async function GET() { return NextResponse.json(await recomputeArchetypes()); }
