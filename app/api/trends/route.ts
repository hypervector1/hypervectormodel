import { NextResponse } from "next/server";
import { rankTrends, type TrendInput } from "@/lib/model";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function fallback(): TrendInput[] {
  return [];
}

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return NextResponse.json({
      model_version: "V16.5",
      source: "not_configured",
      configured: false,
      error: "Supabase environment variables are not configured.",
      counts: {},
      trends: rankTrends(fallback()),
    }, { status: 503 });
  }

  try {
    const params = new URLSearchParams({
      select: "id,name,category,source,score,velocity,acceleration,spread,adoption,longevity,status,first_seen,last_seen,metadata",
      order: "last_seen.desc",
      limit: "1000",
    });

    const response = await fetch(`${url}/rest/v1/trends?${params.toString()}`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Supabase returned ${response.status}: ${body.slice(0, 300)}`);
    }

    const rows = (await response.json()) as TrendInput[];
    const ranked = rankTrends(rows);
    const counts = Object.fromEntries(
      ["BREAKOUT", "RISING", "EARLY", "COOLING", "FADING", "UNVERIFIED"].map((status) => [
        status,
        ranked.filter((t) => t.model.status === status).length,
      ]),
    );

    const verified = ranked.filter((t) => t.model.verified).length;

    return NextResponse.json({
      model_version: "V16.5",
      source: "supabase",
      configured: true,
      updated_at: new Date().toISOString(),
      total: ranked.length,
      verified,
      coverage_percent: ranked.length ? Number(((verified / ranked.length) * 100).toFixed(1)) : 0,
      counts,
      trends: ranked,
    });
  } catch (error) {
    console.error("HypeVector trend API error:", error);
    return NextResponse.json({
      model_version: "V16.5",
      source: "error",
      configured: true,
      error: error instanceof Error ? error.message : "Unknown Supabase error",
      counts: {},
      trends: [],
    }, { status: 502 });
  }
}
