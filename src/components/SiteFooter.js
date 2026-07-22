import { Code2, Cookie, FileText, Newspaper, ShieldCheck, Trophy } from "lucide-react";
import Link from "next/link";
import { CookieSettingsButton } from "./AnalyticsConsentManager";
import { ChessViewLogo } from "./ChessViewLogo";

export function SiteFooter({ analyticsCopy, copy, locale }) {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="footer-brand">
          <ChessViewLogo className="footer-logo footer-logo-light" height={40} />
          <ChessViewLogo alt="" ariaHidden className="footer-logo footer-logo-dark" height={40} variant="reversed" />
          <p>{copy.site.description}</p>
        </div>
        <nav className="footer-links" aria-label="Footer navigation">
          <Link href={`/${locale}/events`}>
            <Trophy size={16} aria-hidden="true" />
            {copy.nav.events}
          </Link>
          <Link href={`/${locale}/news`}>
            <Newspaper size={16} aria-hidden="true" />
            {copy.nav.news}
          </Link>
          <Link href={`/${locale}/terms`}>
            <FileText size={16} aria-hidden="true" />
            Terms
          </Link>
          <Link href={`/${locale}/privacy`}>
            <ShieldCheck size={16} aria-hidden="true" />
            Privacy
          </Link>
          <CookieSettingsButton>
            <Cookie size={16} aria-hidden="true" />
            {analyticsCopy.cookieSettings}
          </CookieSettingsButton>
          <Link
            data-tracking-event="collaboration_entry_click"
            data-tracking-label={copy.nav.source}
            data-tracking-placement="footer"
            href={`/${locale}/collaborate`}
          >
            <Code2 size={16} aria-hidden="true" />
            {copy.nav.source}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
