import { NextResponse } from "next/server";
import { getFundRequest } from "../../../../../../server/db";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const req = await getFundRequest(id);
  if (!req) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ request: req });
}
