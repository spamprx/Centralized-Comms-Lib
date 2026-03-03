import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import gatewayRouter from "./gateway/router";

const app: Application = express();

// Required for express-rate-limit and req.ip to resolve the real client
// address when running behind a proxy or load balancer.
app.set("trust proxy", 1);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
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
