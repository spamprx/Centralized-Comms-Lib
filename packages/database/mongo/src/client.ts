import { MongoClient } from "mongodb";

let client: MongoClient | null = null;

export function getMongoClient(): MongoClient | null {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) return null;
  if (!client) {
    client = new MongoClient(uri);
  }
  return client;
}

export const SNAPSHOT_PAYLOADS_COLLECTION = "content_snapshot_payloads";
