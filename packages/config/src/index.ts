import { z } from "zod";

export function parseEnv<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown = process.env,
): z.infer<TSchema> {
  const parsed = schema.safeParse(input);

  if (!parsed.success) {
    const flattenedErrors = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("\n");

    throw new Error(`Invalid environment configuration:\n${flattenedErrors}`);
  }

  return parsed.data;
}

export function normalizeUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export function splitCommaSeparated(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export function trimToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}
