import { NextResponse } from "next/server"

export const runtime = "nodejs"

export async function GET(request: Request) {
  return NextResponse.redirect(new URL("/admin/logout", request.url))
}
