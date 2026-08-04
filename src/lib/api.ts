import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "@/lib/session";

/** Wrap a route handler body so AuthError/ZodError/etc become clean JSON error responses. */
export function withApiErrors<T>(fn: () => Promise<T>) {
  return fn().then(
    (data) => NextResponse.json(data),
    (err) => {
      if (err instanceof AuthError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      if (err instanceof ZodError) {
        return NextResponse.json({ error: "Invalid request", issues: err.issues }, { status: 400 });
      }
      console.error(err);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    },
  );
}
