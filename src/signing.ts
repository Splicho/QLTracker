import crypto from "node:crypto";

export function createSignature(secret: string, body: string) {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

export function randomToken() {
  return crypto.randomBytes(24).toString("hex");
}
