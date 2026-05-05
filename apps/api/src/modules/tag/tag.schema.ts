import { z } from "zod";

export const createTagBodySchema = z.object({
  name: z.string().min(1).max(200),
  parentId: z.union([z.string().uuid(), z.null()]).optional(),
});
