import "dotenv/config";
import app from "./app";

const PORT = process.env.PORT || 8000;

const server = app.listen(PORT, () => {
  console.log(`Server running on http://127.0.0.1:${PORT}`);
});

/**
 * Opt-in reindex (prefer external cron + `npm run job:vector-reindex` in production).
 * First run after `NIGHTLY_VECTOR_REINDEX_INITIAL_DELAY_MS` (default 1h), then every 24h.
 */
if (process.env.ENABLE_NIGHTLY_VECTOR_REINDEX === "true") {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const initialMs = parseInt(process.env.NIGHTLY_VECTOR_REINDEX_INITIAL_DELAY_MS ?? "3600000", 10);
  const tick = (): void => {
    import("./jobs/nightlyVectorReindex")
      .then((m) => m.runNightlyVectorReindex())
      .catch((e) => console.error("[nightlyVectorReindex]", e instanceof Error ? e.message : e));
  };
  setTimeout(() => {
    tick();
    setInterval(tick, DAY_MS).unref();
  }, Math.max(0, initialMs)).unref();
}

process.on("SIGTERM", () => {
  console.log("SIGTERM received. Shutting down gracefully...");
  server.close(() => {
    console.log("Server closed.");
    process.exit(0);
  });
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});
