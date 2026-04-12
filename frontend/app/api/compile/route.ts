import { NextRequest, NextResponse } from "next/server";

const BACKEND = "http://127.0.0.1:8000/api/compile";

export async function POST(req: NextRequest) {
  const body = await req.text();

  const upstream = await fetch(BACKEND, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  const data = await upstream.arrayBuffer();

  return new NextResponse(data, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "application/octet-stream",
    },
  });
}
