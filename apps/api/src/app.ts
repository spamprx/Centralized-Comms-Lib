import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import gatewayRouter from "./gateway/router";
import { getPrismaClient, PrismaUnitOfWork } from "./repository";

const app: Application = express();

// Required for express-rate-limit and req.ip to resolve the real client
// address when running behind a proxy or load balancer.
app.set("trust proxy", 1);

const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:5173";
app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

// DB connectivity check (uses repository layer / Prisma). No auth required.
app.get("/health/db", async (req: Request, res: Response) => {
  try {
    const prisma = getPrismaClient();
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: "ok", db: "connected" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(503).json({ status: "error", db: "disconnected", error: message });
  }
});

// Dev-only: verify repository layer (ContentRepository read). No auth. Disabled in production.
app.get("/dev/repo-check", async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === "production") {
    res.status(404).json({ error: "Not found" });
    return;
  }
  try {
    const prisma = getPrismaClient();
    const uow = new PrismaUnitOfWork(prisma);
    await uow.withTransaction(async (txRepos) => {
      await txRepos.content.getById("00000000-0000-0000-0000-000000000000");
    });
    res.status(200).json({ status: "ok", repository: "working" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(503).json({ status: "error", repository: "error", error: message });
  }
});

app.use("/api/v1", gatewayRouter);

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: "Route not found" });
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || "Internal Server Error" });
});

export default app;
