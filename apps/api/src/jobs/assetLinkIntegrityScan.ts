import "dotenv/config";

import { linkIntegrityService } from "../modules/assets/linkIntegrity.service";

export async function runAssetLinkIntegrityScan(batchSize = 100): Promise<{
  scanned: number;
  broken: number;
}> {
  return linkIntegrityService.scanPending(batchSize);
}

async function main(): Promise<void> {
  const out = await runAssetLinkIntegrityScan(
    Number.parseInt(process.env.LINK_SCAN_BATCH_SIZE ?? "100", 10),
  );
  console.log(JSON.stringify({ ok: true, ...out, at: new Date().toISOString() }));
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
