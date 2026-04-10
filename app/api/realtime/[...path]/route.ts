import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getRealtimeBaseUrl() {
  const value = process.env.NEXT_PUBLIC_REALTIME_URL?.trim().replace(/\/+$/, "");

  if (!value) {
    throw new Error("NEXT_PUBLIC_REALTIME_URL is not configured.");
  }

  return value;
}

function buildTargetUrl(pathSegments: string[], requestUrl: string) {
  const sourceUrl = new URL(requestUrl);
  const encodedPath = pathSegments.map((segment) => encodeURIComponent(segment)).join("/");
  const targetUrl = new URL(`${getRealtimeBaseUrl()}/api/${encodedPath}`);

  sourceUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.append(key, value);
  });

  return targetUrl;
}

async function proxyRealtimeRequest(
  request: Request,
  context: { params: Promise<unknown> },
) {
  try {
    const params = await context.params;
    const path =
      params &&
      typeof params === "object" &&
      "path" in params &&
      Array.isArray((params as { path?: unknown }).path)
        ? (params as { path: string[] }).path
        : [];

    const targetUrl = buildTargetUrl(path, request.url);
    const requestHeaders = new Headers();
    const contentType = request.headers.get("content-type");
    const authorization = request.headers.get("authorization");
    const accept = request.headers.get("accept");

    if (contentType) {
      requestHeaders.set("content-type", contentType);
    }

    if (authorization) {
      requestHeaders.set("authorization", authorization);
    }

    if (accept) {
      requestHeaders.set("accept", accept);
    }

    const upstreamResponse = await fetch(targetUrl, {
      method: request.method,
      headers: requestHeaders,
      body:
        request.method === "GET" || request.method === "HEAD"
          ? undefined
          : await request.text(),
      cache: "no-store",
    });

    const responseHeaders = new Headers();
    const upstreamContentType = upstreamResponse.headers.get("content-type");
    const upstreamCacheControl = upstreamResponse.headers.get("cache-control");

    if (upstreamContentType) {
      responseHeaders.set("content-type", upstreamContentType);
    }

    if (upstreamCacheControl) {
      responseHeaders.set("cache-control", upstreamCacheControl);
    }

    return new Response(await upstreamResponse.text(), {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Realtime proxy request failed.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<unknown> },
) {
  return proxyRealtimeRequest(request, context);
}

export async function POST(
  request: Request,
  context: { params: Promise<unknown> },
) {
  return proxyRealtimeRequest(request, context);
}
