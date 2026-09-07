import { describe, it, expect } from "vitest";
import { registerErrorHandler } from "../src/plugins/errorHandler.js";
import Fastify from "fastify";
import { DDragonError } from "../src/services/ddragonClient.js";

describe("errorHandler", () => {
  it("serializes DDragonError status codes", async () => {
    const app = Fastify({ logger: false });
    registerErrorHandler(app);
    app.get("/boom", async () => {
      throw new DDragonError("Failed to reach Data Dragon", 502);
    });

    const res = await app.inject({ method: "GET", url: "/boom" });
    expect(res.statusCode).toBe(502);
    expect(res.json()).toEqual({
      error: "Failed to reach Data Dragon",
      statusCode: 502,
    });
    await app.close();
  });

  it("falls back to 500 for unexpected errors", async () => {
    const app = Fastify({ logger: false });
    registerErrorHandler(app);
    app.get("/crash", async () => {
      throw new Error("unexpected");
    });

    const res = await app.inject({ method: "GET", url: "/crash" });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({
      error: "Internal Server Error",
      statusCode: 500,
    });
    await app.close();
  });
});
