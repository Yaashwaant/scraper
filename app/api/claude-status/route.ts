import { NextResponse } from "next/server";
import { claudeInstalled, resolveClaudeBin } from "@/lib/claude";

export async function GET() {
  const installed = claudeInstalled();
  return NextResponse.json({
    installed,
    path: installed ? resolveClaudeBin() : null,
  });
}
