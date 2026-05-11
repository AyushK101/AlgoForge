import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const backendBaseUrl = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4001"
).replace(/\/$/, "");

const HOP_BY_HOP_HEADERS = [
  "host",
  "connection",
  "content-length",
  "transfer-encoding",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "upgrade",
  "accept-encoding",
];

function buildHeaders(request: NextRequest) {
  const headers = new Headers(request.headers);

  for (const header of HOP_BY_HOP_HEADERS) {
    headers.delete(header);
  }

  headers.set("accept", "application/json");

  return headers;
}

async function handler(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path } = await params;

    const url = new URL(`${backendBaseUrl}/${path.join("/")}`);
    url.search = request.nextUrl.search;

    const hasBody = request.method !== "GET" && request.method !== "HEAD";

    const upstream = await fetch(url, {
      method: request.method,
      headers: request.headers,
      body: hasBody ? await request.text() : undefined,
      cache: "no-store",
      redirect: "manual",
    });

    // const headers = new Headers(upstream.headers);

    // headers.delete("content-encoding");
    // headers.delete("content-length");
    // headers.delete("transfer-encoding");

    // headers.set("cache-control", "no-store");

    // return new NextResponse(upstream.body, {
    //   status: upstream.status,
    //   headers: upstream.headers,
    // });
    return NextResponse.json(
      await upstream.json(),
      {
        status: upstream.status,
        // headers: headers,
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "API proxy failed",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export const GET = handler;
export const HEAD = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
