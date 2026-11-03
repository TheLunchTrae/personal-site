import * as z from 'zod';
import { sectionFields } from '@/site/content';
import { youtubeUrl } from '@/site/youtube';

/**
 * Front matter for one favorite level in content/levels/favorites/. `order`
 * places it in the list, hardest first; the body is optional notes.
 */
export const favoriteLevel = sectionFields.extend({
  order: z.int(),
  title: z.string().min(1),
  url: youtubeUrl,
  creator: z.string().min(1).optional(),
});

/** Front matter for one entry in content/levels/progress/: the hardest level beaten, or the one being played. */
export const progressLevel = favoriteLevel.extend({
  status: z.enum(['hardest', 'next']),
  /** Best run so far, in percent, for a level not beaten yet. */
  progress: z.int().min(0).max(99).optional(),
});

export type FavoriteLevel = z.output<typeof favoriteLevel>;
export type ProgressLevel = z.output<typeof progressLevel>;
