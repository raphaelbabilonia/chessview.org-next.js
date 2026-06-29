import { CalendarSearch, Code2 } from "lucide-react";
import Link from "next/link";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeToggle } from "./ThemeToggle";

export function SiteHeader({ copy, locale }) {
  return (
    <header className="site-header">
      <Link className="brand" href={`/${locale}`}>
        <span className="brand-mark">CV</span>
        <span>Chess View</span>
      </Link>
      <nav className="site-nav" aria-label="Main navigation">
        <Link href={`/${locale}/events`}>
          <CalendarSearch size={18} aria-hidden="true" />
          {copy.nav.events}
        </Link>
      </nav>
      <div className="header-actions">
        <LanguageSwitcher label={copy.nav.language} locale={locale} />
        <ThemeToggle label={copy.nav.theme} />
        <a
          className="icon-link"
          href="https://github.com/raphaelbabilonia/chessview.org-next.js"
          rel="noreferrer"
          target="_blank"
          aria-label={copy.nav.source}
        >
          <Code2 size={18} aria-hidden="true" />
        </a>
      </div>
    </header>
  );
}
