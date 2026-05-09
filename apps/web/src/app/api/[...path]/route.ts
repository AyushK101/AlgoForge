import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const backendBaseUrl = (
  process.env.INTERNAL_APIV2_URL ??
  process.env.NEXT_PUBLIC_APIV2_URL ??
  process.env.INTERNAL_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4001"
).replace(/\/$/, "");

function buildForwardHeaders(request: NextRequest) {
  const headers = new Headers();

  const contentType = request.headers.get("content-type");
  const userId = request.headers.get("x-user-id");
  const authorization = request.headers.get("authorization");
  const cookie = request.headers.get("cookie");

  headers.set("accept", "application/json");
  headers.set("accept-encoding", "identity");

  if (contentType) headers.set("content-type", contentType);
  if (userId) headers.set("x-user-id", userId);
  if (authorization) headers.set("authorization", authorization);
  if (cookie) headers.set("cookie", cookie);

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
    const text = request.method === "HEAD" ? "" : await upstreamResponse.text();

    let data: unknown;

    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = {
        raw: text,
      };
    }

    return NextResponse.json(data, {
      status: upstreamResponse.status,
      headers: {
        "cache-control": "no-store, no-transform",
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