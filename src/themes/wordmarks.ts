import type { StaticImageData } from 'next/image';
import geometryDashTitle from './geometry-dash/title.png';
import type { GameThemeId } from './registry';

/**
 * Title images that stand in for a theme's name where it shows as a heading.
 * Only Geometry Dash has one: Trae made it with GD Colon's font generator, in
 * Oxygene 1 lettering with RobTop Games' textures. It appears nowhere else.
 */
export const wordmarks: Partial<Record<GameThemeId, StaticImageData>> = {
  'geometry-dash': geometryDashTitle,
};
