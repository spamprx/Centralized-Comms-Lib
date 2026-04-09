import express, { Application, Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";
import apiRouter from "./routes";
import { getPrismaClient, PrismaUnitOfWork } from "./repository";
import { openapiSpec } from "./docs/openapi";
import { API_V1_PREFIX } from "./config/constants";
import { errorMiddleware } from "./middlewares/error.middleware";

const app: Application = express();

// Required for express-rate-limit and req.ip to resolve the real client
// address when running behind a proxy or load balancer.
app.set("trust proxy", 1);

app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Interactive OpenAPI documentation
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openapiSpec));

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Health check for the API process
 *     tags:
 *       - Health
 *     responses:
 *       200:
 *         description: Service is up
 */
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

// DB connectivity check (uses repository layer / Prisma). No auth required.
/**
 * @openapi
 * /health/db:
 *   get:
 *     summary: Database connectivity check
 *     tags:
 *       - Health
 *     responses:
 *       200:
 *         description: DB reachable
 *       503:
 *         description: DB not reachable
 */
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
/**
 * @openapi
 * /dev/repo-check:
 *   get:
 *     summary: Dev-only repository layer check
 *     tags:
 *       - Health
 *     responses:
 *       200:
 *         description: Repository layer working
 *       404:
 *         description: Not available in production
 *       503:
 *         description: Repository layer error
 */
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

app.use(API_V1_PREFIX, apiRouter);

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: "Route not found" });
});

app.use(errorMiddleware);

export default app;
