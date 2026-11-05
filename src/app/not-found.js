import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page">
      <section className="info-panel">
        <p className="eyebrow">Not found</p>
        <h1>Page not found</h1>
        <p className="muted">The page may have moved, or the address may be mistyped.</p>
        <div className="button-row">
          <Link className="button" href="/events">
            Browse events
          </Link>
        </div>
      </section>
    </main>
  );
}
