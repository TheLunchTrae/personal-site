import { gameThemes } from '@/themes/registry';
import { ThemeTour } from '@/themes/theme-tour';

export default function Home() {
  return (
    <article className="prose-page" data-section="home">
      <h1>Trae</h1>
      <p className="lede">Software engineer. Site coming soon.</p>
      <a href="/TraeStevens_Resume.pdf" download="TraeStevens_Resume.pdf" className="button">
        Download resume (PDF)
      </a>
      {gameThemes.length > 0 ? (
        <section className="home-tour" aria-labelledby="home-tour-title">
          <h2 id="home-tour-title">Get to know me, one game at a time</h2>
          <p>
            A few games shaped how I build software. Each theme restyles this whole site after one of them, with
            gameplay you can use to get around. Try each one, then read what it taught me.
          </p>
          <ThemeTour heading="h3" />
        </section>
      ) : null}
    </article>
  );
}
