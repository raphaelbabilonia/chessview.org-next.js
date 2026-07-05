import { CalendarSearch, Code2, MapPinned, Newspaper } from "lucide-react";
import Link from "next/link";
import { ChessViewLogo } from "./ChessViewLogo";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeToggle } from "./ThemeToggle";

export function SiteHeader({ copy, locale }) {
  return (
    <header className="site-header">
      <Link className="brand" href={`/${locale}`}>
        <ChessViewLogo className="brand-logo brand-logo-light" height={56} />
        <ChessViewLogo alt="" ariaHidden className="brand-logo brand-logo-dark" height={56} variant="reversed" />
      </Link>
      <nav className="site-nav" aria-label="Main navigation">
        <Link href={`/${locale}/events`}>
          <CalendarSearch size={18} aria-hidden="true" />
          {copy.nav.events}
        </Link>
        <Link href={`/${locale}/news`}>
          <Newspaper size={18} aria-hidden="true" />
          {copy.nav.news}
        </Link>
        <Link href={`/${locale}/coverage`}>
          <MapPinned size={18} aria-hidden="true" />
          {copy.nav.maps}
        </Link>
      </nav>
      <div className="header-actions">
        <LanguageSwitcher label={copy.nav.language} locale={locale} />
        <ThemeToggle label={copy.nav.theme} />
        <Link
          className="icon-link"
          data-tracking-event="collaboration_entry_click"
          data-tracking-label={copy.nav.source}
          data-tracking-placement="header"
          href={`/${locale}/collaborate`}
          aria-label={copy.nav.source}
        >
          <Code2 size={18} aria-hidden="true" />
        </Link>
      </div>
    </header>
  );
}
