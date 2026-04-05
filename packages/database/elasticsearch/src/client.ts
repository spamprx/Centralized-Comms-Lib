import { Client } from "@elastic/elasticsearch";

let client: Client | null = null;

export function getElasticsearchClient(): Client | null {
  const url = process.env.ELASTICSEARCH_URL?.trim();
  if (!url) return null;
  if (!client) {
    client = new Client({ node: url });
  }
  return client;
}
