import * as z from 'zod';
import { sectionFields } from '@/site/content';
import { youtubeUrl } from '@/site/youtube';

/**
 * Front matter for one favorite level in content/levels/favorites/. `order`
 * places it in the list, hardest first. The body stays empty.
 */
export const favoriteLevel = sectionFields.extend({
  order: z.int(),
  title: z.string().min(1),
  url: youtubeUrl,
  creator: z.string().min(1).optional(),
});

/**
 * Front matter for one entry in content/levels/progress/: the hardest level
 * beaten, or the one being played, with the best run so far in percent.
 */
export const progressLevel = z.discriminatedUnion('status', [
  favoriteLevel.extend({ status: z.literal('hardest') }),
  favoriteLevel.extend({ status: z.literal('next'), progress: z.int().min(0).max(99).optional() }),
]);

export type FavoriteLevel = z.output<typeof favoriteLevel>;
export type ProgressLevel = z.output<typeof progressLevel>;
