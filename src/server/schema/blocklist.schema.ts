import * as z from 'zod/v4';
import { BlocklistType } from '~/server/common/enums';

export const getBlocklistSchema = z.object({
  type: z.nativeEnum(BlocklistType),
});

export type UpsertBlocklistSchema = z.infer<typeof upsertBlocklistSchema>;
export const upsertBlocklistSchema = z.object({
  id: z.number().optional(),
  type: z.string(),
  blocklist: z.string().array(),
});

export type RemoveBlocklistItemSchema = z.infer<typeof removeBlocklistItemSchema>;
export const removeBlocklistItemSchema = z.object({
  id: z.number(),
  items: z.string().array(),
});
