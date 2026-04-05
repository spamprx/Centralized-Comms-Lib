import { ObjectId } from "mongodb";

import { SNAPSHOT_PAYLOADS_COLLECTION, getMongoClient } from "./client";

const DB_NAME = process.env.MONGODB_DB_NAME?.trim() || "comms";

/**
 * Large snapshot / diff blobs; PostgreSQL `ContentSnapshot` stores `mongoDocumentId`.
 */
export const mongoSnapshotPayloadStore = {
  async save(pgSnapshotId: string, contentId: string, payload: unknown): Promise<string | null> {
    const mc = getMongoClient();
    if (!mc) return null;
    const res = await mc.db(DB_NAME).collection(SNAPSHOT_PAYLOADS_COLLECTION).insertOne({
      pgSnapshotId,
      contentId,
      payload,
      createdAt: new Date(),
    });
    return res.insertedId.toString();
  },

  async getById(documentId: string): Promise<unknown | null> {
    const mc = getMongoClient();
    if (!mc) return null;
    if (!ObjectId.isValid(documentId)) return null;
    const row = await mc
      .db(DB_NAME)
      .collection(SNAPSHOT_PAYLOADS_COLLECTION)
      .findOne({ _id: new ObjectId(documentId) });
    return row && "payload" in row ? row.payload : null;
  },
};
