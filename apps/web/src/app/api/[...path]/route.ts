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

    // Stream upstream response body directly to the client, but filter headers
    const responseHeaders: Record<string, string> = {
      "cache-control": "no-store, no-transform",
    };

    // Forward a small set of safe headers from upstream, but explicitly
    // exclude encoding and length headers to avoid double-encoding issues.
    const headersToForward = ["content-type", "x-request-id", "etag"];
    for (const header of headersToForward) {
      const value = upstreamResponse.headers.get(header);
      if (value) responseHeaders[header] = value;
    }

    // Do not forward `content-encoding`, `transfer-encoding`, or `content-length`.
    const body = request.method === "HEAD" ? null : upstreamResponse.body;

    return new NextResponse(body, {
      status: upstreamResponse.status,
      headers: responseHeaders,
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
