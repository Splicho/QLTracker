import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class RouteError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "RouteError";
    this.status = status;
  }
}

export function routeError(status: number, message: string): never {
  throw new RouteError(status, message);
}

export function handleRouteError(
  error: unknown,
  fallbackMessage = "Request failed.",
) {
  if (error instanceof RouteError) {
    return NextResponse.json({ message: error.message }, { status: error.status });
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      { message: fallbackMessage },
      { status: 500 },
    );
  }

  console.error(error);

  return NextResponse.json(
    { message: fallbackMessage },
    { status: 500 },
  );
}
