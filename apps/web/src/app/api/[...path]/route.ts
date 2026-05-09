import { NextRequest } from "next/server";

const backendBaseUrl = (
  process.env.INTERNAL_APIV2_URL ??
  process.env.NEXT_PUBLIC_APIV2_URL ??
  process.env.INTERNAL_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4001"
).replace(/\/$/, "");

async function proxyRequest(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path } = await context.params;

    const targetUrl = new URL(
      `${backendBaseUrl}/${path.join("/")}${request.nextUrl.search}`,
    );

    const requestHeaders = new Headers(request.headers);
    requestHeaders.delete("host");
    requestHeaders.delete("content-length");
    requestHeaders.delete("connection");
    requestHeaders.delete("accept-encoding");

    const init: RequestInit = {
      method: request.method,
      headers: requestHeaders,
      cache: "no-store",
    };

    if (request.method !== "GET" && request.method !== "HEAD") {
      init.body = await request.text();
    }

    const upstreamResponse = await fetch(targetUrl, init);
    const body = await upstreamResponse.text();

    console.log("Proxy target:", targetUrl.toString());
    console.log("Proxy status:", upstreamResponse.status);
    console.log("Proxy body:", body);

    return new Response(body || JSON.stringify({ ok: true }), {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: {
        "content-type":
          upstreamResponse.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (error) {
    console.error("API proxy failed:", error);

    return Response.json(
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