export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-24">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Trae</h1>
      <p className="mt-4 text-lg text-foreground/70">Software engineer. Site coming soon.</p>
      <a
        href="/resume.pdf"
        download
        className="mt-8 w-fit rounded-md border border-foreground/20 px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
      >
        Download resume (PDF)
      </a>
    </main>
  );
}
