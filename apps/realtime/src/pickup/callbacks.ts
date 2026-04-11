import type express from "express";
import type {
  PickupMatchRow,
  PickupPlayerIdentity,
  RawBodyRequest,
} from "./types.js";

type PickupCallbackDeps = {
  applyMatchLive: (matchId: string, payload: Record<string, unknown>) => Promise<void>;
  applyMatchResult: (matchId: string, payload: Record<string, unknown>) => Promise<void>;
  applyMatchStats: (matchId: string, payload: Record<string, unknown>) => Promise<void>;
  applyProvisionResult: (
    matchId: string,
    payload: Record<string, unknown>,
  ) => Promise<void>;
  authenticatePickupSession: (
    token: string,
  ) => Promise<{ player: PickupPlayerIdentity } | null>;
  createSignature: (secret: string, body: string) => string;
  getPickupSettings: () => Promise<{ callbackSecret: string | null }>;
  getLatestMatchById: (matchId: string) => Promise<PickupMatchRow | null>;
  getPlayerState: (player: PickupPlayerIdentity) => Promise<unknown>;
};

export function createPickupCallbackApi(deps: PickupCallbackDeps) {
  async function getPlayerStateByToken(token: string) {
    const session = await deps.authenticatePickupSession(token);
    if (!session) {
      return null;
    }

    return deps.getPlayerState(session.player);
  }

  async function verifyCallbackSignature(
    matchId: string,
    request: RawBodyRequest,
  ) {
    const match = await deps.getLatestMatchById(matchId);
    if (!match) {
      throw new Error("Pickup match was not found.");
    }

    const settings = await deps.getPickupSettings();
    if (!settings.callbackSecret) {
      throw new Error("Pickup callback secret is not configured.");
    }

    const signature = request.header("x-pickup-signature")?.trim();
    const rawBody = request.rawBody ?? JSON.stringify(request.body ?? {});
    if (!signature) {
      throw new Error("Missing pickup callback signature.");
    }

    const expected = deps.createSignature(settings.callbackSecret, rawBody);
    if (signature !== expected) {
      throw new Error("Invalid pickup callback signature.");
    }

    return match;
  }

  async function handleProvisionCallback(
    request: RawBodyRequest,
    response: express.Response,
  ) {
    try {
      const matchId =
        typeof request.body?.matchId === "string" ? request.body.matchId.trim() : "";
      if (!matchId) {
        response.status(400).json({ ok: false, error: "matchId is required." });
        return;
      }

      await verifyCallbackSignature(matchId, request);
      await deps.applyProvisionResult(matchId, request.body as Record<string, unknown>);
      response.json({ ok: true });
    } catch (error) {
      response.status(400).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function handleLiveCallback(
    request: RawBodyRequest,
    response: express.Response,
  ) {
    try {
      const matchId =
        typeof request.body?.matchId === "string" ? request.body.matchId.trim() : "";
      if (!matchId) {
        response.status(400).json({ ok: false, error: "matchId is required." });
        return;
      }

      await verifyCallbackSignature(matchId, request);
      await deps.applyMatchLive(matchId, request.body as Record<string, unknown>);
      response.json({ ok: true });
    } catch (error) {
      response.status(400).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function handleResultCallback(
    request: RawBodyRequest,
    response: express.Response,
  ) {
    try {
      const matchId =
        typeof request.body?.matchId === "string" ? request.body.matchId.trim() : "";
      if (!matchId) {
        response.status(400).json({ ok: false, error: "matchId is required." });
        return;
      }

      await verifyCallbackSignature(matchId, request);
      await deps.applyMatchResult(matchId, request.body as Record<string, unknown>);
      response.json({ ok: true });
    } catch (error) {
      response.status(400).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function handleStatsCallback(
    request: RawBodyRequest,
    response: express.Response,
  ) {
    try {
      const matchId =
        typeof request.body?.matchId === "string" ? request.body.matchId.trim() : "";
      if (!matchId) {
        response.status(400).json({ ok: false, error: "matchId is required." });
        return;
      }

      await verifyCallbackSignature(matchId, request);
      await deps.applyMatchStats(matchId, request.body as Record<string, unknown>);
      response.json({ ok: true });
    } catch (error) {
      response.status(400).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    getPlayerStateByToken,
    handleLiveCallback,
    handleProvisionCallback,
    handleResultCallback,
    handleStatsCallback,
    verifyCallbackSignature,
  };
}
