import z from 'zod';
import { GenerationType } from '~/server/orchestrator/infrastructure/base.enums';

export const promptSchema = z
  .string()
  .max(1500, 'Prompt cannot be longer than 1500 characters')
  .default('');

export const negativePromptSchema = z
  .string()
  .max(1000, 'Prompt cannot be longer than 1000 characters')
  .default('');

export const seedSchema = z.number().optional();

export const textEnhancementSchema = z.object({
  type: z.literal(GenerationType.txt2vid).catch(GenerationType.txt2vid),
  prompt: promptSchema,
});

export const imageEnhancementSchema = z.object({
  type: z.literal(GenerationType.img2vid).catch(GenerationType.img2vid),
  sourceImage: z.string(),
  height: z.number().optional(),
  width: z.number().optional(),
});
