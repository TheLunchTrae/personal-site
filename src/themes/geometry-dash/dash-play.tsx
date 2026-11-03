'use client';

import { usePathname, useRouter } from 'next/navigation';
import { sectionHref } from '@/site/sections';
import type { PlayProps } from '../play-layer';
import { DashStage } from './dash-stage';

/** Geometry Dash gameplay: a runner strip under the header whose gates open pages. */
export function DashPlay({ sections, reducedMotion, onExit, onFail }: PlayProps) {
  const router = useRouter();
  return (
    <DashStage
      sections={sections}
      currentHref={sectionHref(usePathname())}
      onNavigate={(href) => router.push(href)}
      reducedMotion={reducedMotion}
      onExit={onExit}
      onFail={onFail}
    />
  );
}
