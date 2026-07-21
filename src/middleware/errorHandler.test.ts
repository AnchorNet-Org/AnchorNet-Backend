import express, { Express, NextFunction, Request, Response } from "express";
import request from "supertest";
import { errorHandler } from "./errorHandler";
import { ApiError } from "../errors/ApiError";

function makeApp(
  handler: (req: Request, res: Response, next: NextFunction) => void,
): Express {
  const app = express();
  app.get("/boom", handler);
  app.use(errorHandler);
  return app;
}

describe("errorHandler", () => {
  it("uses the status and code carried by an ApiError", async () => {
    const app = makeApp((_req, _res, next) => next(ApiError.conflict("dup")));

    const res = await request(app).get("/boom");

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
  });

  it("maps a body-parser style 413 error to PAYLOAD_TOO_LARGE", async () => {
    const app = makeApp((_req, _res, next) => {
      const err = new Error("request entity too large") as Error & {
        status: number;
      };
      err.status = 413;
      next(err);
    });

    const res = await request(app).get("/boom");

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("PAYLOAD_TOO_LARGE");
    expect(res.body.error.message).toBe("request entity too large");
  });

  it("maps a body-parser style 400 error (using statusCode) to BAD_REQUEST", async () => {
    const app = makeApp((_req, _res, next) => {
      const err = new Error("invalid json") as Error & { statusCode: number };
      err.statusCode = 400;
      next(err);
    });

    const res = await request(app).get("/boom");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
  });

  it("falls back to a generic 500 for unexpected errors", async () => {
    const app = makeApp((_req, _res, next) => next(new Error("kaboom")));

    const res = await request(app).get("/boom");

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL");
    expect(res.body.error.message).toBe("kaboom");
  });

  describe("when NODE_ENV is production", () => {
    const originalEnv = process.env.NODE_ENV;

    beforeEach(() => {
      process.env.NODE_ENV = "production";
    });

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it("hides internal error messages for unexpected errors", async () => {
      const app = makeApp((_req, _res, next) => next(new Error("secret internal kaboom")));

      const res = await request(app).get("/boom");

      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe("INTERNAL");
      expect(res.body.error.message).toBe("unexpected error");
      expect(res.body.error.stack).toBeUndefined();
    });

    it("still surfaces intentional messages for ApiErrors", async () => {
      const app = makeApp((_req, _res, next) => next(ApiError.conflict("intentional conflict")));

      const res = await request(app).get("/boom");

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("CONFLICT");
      expect(res.body.error.message).toBe("intentional conflict");
      expect(res.body.error.stack).toBeUndefined();
    });
  });
});
