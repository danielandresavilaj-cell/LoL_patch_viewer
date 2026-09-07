import type { FastifyInstance, FastifyError } from "fastify";
import { DDragonError } from "../services/ddragonClient.js";

export interface ApiErrorBody {
  error: string;
  statusCode: number;
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((err: FastifyError | Error, _request, reply) => {
    if (err instanceof DDragonError) {
      const body: ApiErrorBody = {
        error: err.message,
        statusCode: err.statusCode,
      };
      return reply.status(err.statusCode).send(body);
    }

    const fastifyErr = err as FastifyError;
    if (typeof fastifyErr.statusCode === "number" && fastifyErr.statusCode >= 400) {
      const body: ApiErrorBody = {
        error: fastifyErr.message,
        statusCode: fastifyErr.statusCode,
      };
      return reply.status(fastifyErr.statusCode).send(body);
    }

    app.log?.error?.(err);
    const body: ApiErrorBody = {
      error: "Internal Server Error",
      statusCode: 500,
    };
    return reply.status(500).send(body);
  });
}
