import "dotenv/config";
import app from "./app";
import http from "node:http";
import { attachWebsocketServer } from "./realtime/wsServer";
import { processComponentAndAssetOutbox } from "./modules/component/componentEvents.consumer";
import { runAssetLinkIntegrityScan } from "./jobs/assetLinkIntegrityScan";

const PORT = process.env.PORT || 8000;

const server = http.createServer(app);
attachWebsocketServer(server);

server.listen(PORT, () => {
  console.log(`Server running on http://127.0.0.1:${PORT}`);
});

/**
 * Opt-in reindex (prefer external cron + `npm run job:vector-reindex` in production).
 * First run after `NIGHTLY_VECTOR_REINDEX_INITIAL_DELAY_MS` (default 1h), then every 24h.
 */
if (process.env.ENABLE_NIGHTLY_VECTOR_REINDEX === "true") {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const initialMs = parseInt(
    process.env.NIGHTLY_VECTOR_REINDEX_INITIAL_DELAY_MS ?? "3600000",
    10,
  );
  const tick = (): void => {
    import("./jobs/nightlyVectorReindex")
      .then((m) => m.runNightlyVectorReindex())
      .catch((e) =>
        console.error(
          "[nightlyVectorReindex]",
          e instanceof Error ? e.message : e,
        ),
      );
  };
  setTimeout(
    () => {
      tick();
      setInterval(tick, DAY_MS).unref();
    },
    Math.max(0, initialMs),
  ).unref();
}

if (process.env.ENABLE_OUTBOX_WORKER === "true") {
  const pollMs = Number.parseInt(process.env.OUTBOX_POLL_INTERVAL_MS ?? "10000", 10);
  const tick = (): void => {
    void processComponentAndAssetOutbox(
      Number.parseInt(process.env.OUTBOX_BATCH_SIZE ?? "50", 10),
    ).catch(() => undefined);
  };
  setInterval(tick, Math.max(2000, pollMs)).unref();
}

if (process.env.ENABLE_ASSET_LINK_SCAN === "true") {
  const intervalMs = Number.parseInt(process.env.ASSET_LINK_SCAN_INTERVAL_MS ?? "300000", 10);
  const tick = (): void => {
    void runAssetLinkIntegrityScan(
      Number.parseInt(process.env.LINK_SCAN_BATCH_SIZE ?? "100", 10),
    ).catch(() => undefined);
  };
  setInterval(tick, Math.max(30000, intervalMs)).unref();
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
