import { NextRequest, NextResponse } from "next/server";

const backendBaseUrl = (
  process.env.INTERNAL_APIV2_URL ??
  process.env.NEXT_PUBLIC_APIV2_URL ??
  process.env.INTERNAL_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4001"
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

function buildForwardHeaders(request: NextRequest) {
  const headers = new Headers(request.headers);

  for (const header of HOP_BY_HOP_HEADERS) {
    headers.delete(header);
  }

  headers.set("accept", "application/json");

  if (!headers.has("content-type") && request.method !== "GET") {
    headers.set("content-type", "application/json");
  }

  return headers;
}

async function proxyRequest(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path } = await context.params;

    const targetUrl = new URL(`${backendBaseUrl}/${path.join("/")}`);
    targetUrl.search = request.nextUrl.search;

    const init: RequestInit = {
      method: request.method,
      headers: buildForwardHeaders(request),
      cache: "no-store",
      redirect: "manual",
    };

    if (request.method !== "GET" && request.method !== "HEAD") {
      init.body = await request.text();
    }

    const upstreamResponse = await fetch(targetUrl, init);

    const contentType =
      upstreamResponse.headers.get("content-type") ?? "application/json";

    const body =
      request.method === "HEAD" ? null : await upstreamResponse.text();

    return new NextResponse(body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: {
        "content-type": contentType,
        "cache-control": "no-store",
      },
    });
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

export const GET = proxyRequest;
export const HEAD = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
export const OPTIONS = proxyRequest;