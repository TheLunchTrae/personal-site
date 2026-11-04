import Link from 'next/link';

/** A link to the credits, on every page. A story chapter adds its game's notice above it. */
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <Link href="/credits/">Credits</Link>
    </footer>
  );
}
