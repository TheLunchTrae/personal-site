// The floor grid seen in perspective, in a 1000 by 100 box under the horizon.
// Rays run from a vanishing point above the horizon's center, and the cross
// lines get closer toward the horizon, so the floor reads as receding.
const vanishingX = 500;
const vanishingY = -60;
const rays = Array.from({ length: 25 }, (_, index) => -3000 + index * 250);
const crossLines = [6, 14, 26, 44, 70];

/**
 * Where a story page's 3D scene goes. Until the scene exists, it shows a
 * still horizon and says the scene is coming. docs/story.md describes the plan.
 */
export function SceneSlot() {
  return (
    <div className="scene-slot">
      <svg className="scene-slot__floor" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true">
        {rays.map((x) => {
          // Start each ray at the horizon, where it leaves the vanishing point.
          const t = -vanishingY / (100 - vanishingY);
          return <line key={x} x1={vanishingX + (x - vanishingX) * t} y1={0} x2={x} y2={100} />;
        })}
        {crossLines.map((y) => (
          <line key={y} x1={0} y1={y} x2={1000} y2={y} />
        ))}
      </svg>
      <p className="scene-slot__label">Background scene coming soon</p>
    </div>
  );
}
