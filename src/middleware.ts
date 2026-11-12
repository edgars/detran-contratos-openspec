import { NextResponse, type NextRequest } from "next/server";
import { corsHeaders } from "@/lib/api/cors";

/** CORS só para a origem do frontend (`APP_ORIGIN`). */
export function middleware(request: NextRequest) {
  const headers = corsHeaders(request.headers.get("origin"), process.env.APP_ORIGIN);
  if (request.method === "OPTIONS") return new NextResponse(null, { status: 204, headers });
  const response = NextResponse.next();
  headers.forEach((value, key) => response.headers.set(key, value));
  return response;
}

export const config = { matcher: "/api/:path*" };
