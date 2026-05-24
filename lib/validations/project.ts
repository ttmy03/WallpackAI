import { z } from "zod";

import { promptInputSchema } from "@/lib/prompts/schema";

export const createProjectSchema = z.object({
  name: z.string().trim().min(2).max(80),
  promptInputs: promptInputSchema
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
