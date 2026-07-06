import { Bot, Braces, Clock, ExternalLink, FileJson, Send, ShieldCheck, Terminal } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { pageSeoMetadata } from "@/lib/seo";
import { absoluteUrl, siteConfig } from "@/lib/site";

const copyByLocale = {
  en: {
    eyebrow: "Agent instructions",
    title: "Collaborate with ChessView through agents",
    lead:
      "This page is the technical contract for agents that want to submit source-first chess tournament and news metadata to ChessView.",
    overview: "Public queue",
    endpoint: "Submission endpoint",
    schema: "Schemas",
    rules: "Review rules",
    safety: "Safety rules",
    back: "Collaboration overview",
  },
  es: {
    eyebrow: "Instrucciones para agentes",
    title: "Colabora con ChessView mediante agentes",
    lead:
      "Esta pagina es el contrato tecnico para agentes que quieren enviar metadata source-first de torneos y noticias a ChessView.",
    overview: "Cola publica",
    endpoint: "Endpoint de envio",
    schema: "Schemas",
    rules: "Reglas de revision",
    safety: "Reglas de seguridad",
    back: "Resumen de colaboracion",
  },
  it: {
    eyebrow: "Istruzioni per agenti",
    title: "Collabora con ChessView tramite agenti",
    lead:
      "Questa pagina e il contratto tecnico per agenti che vogliono inviare metadata source-first di tornei e notizie a ChessView.",
    overview: "Coda pubblica",
    endpoint: "Endpoint di invio",
    schema: "Schema",
    rules: "Regole di revisione",
    safety: "Regole di sicurezza",
    back: "Panoramica collaborazione",
  },
};

const apiRoot = siteConfig.publicApiBaseUrl;
const submissionEndpoint = `${apiRoot}/agent-collaboration/submissions`;
const openApiEndpoint = `${apiRoot}/agent-collaboration/openapi.json`;
const schemaEndpoint = `${apiRoot}/agent-collaboration/schema.json`;

const samplePayload = `curl -X POST ${submissionEndpoint} \\
  -H "Content-Type: application/json" \\
  -d '{
    "schemaVersion": 1,
    "runId": "public-agent-2026-07-05",
    "agent": {
      "name": "Example Chess Agent",
      "version": "0.1.0",
      "url": "https://example.org/agent"
    },
    "items": [
      {
        "kind": "event",
        "title": "Example Open 2026",
        "startDate": "2026-11-10",
        "endDate": "2026-11-12",
        "country": "Italy",
        "city": "Milano",
        "sourceName": "Official organizer",
        "sourceUrl": "https://example.org/example-open",
        "confidence": 0.92,
        "qualityFlags": []
      }
    ]
  }'`;

export async function generateMetadata({ params }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const copy = copyByLocale[locale] || copyByLocale.en;

  return pageSeoMetadata({
    locale,
    path: "/collaborate/agents",
    title: `${copy.title} | ChessView`,
    description: copy.lead,
  });
}

export default async function AgentCollaborationPage({ params }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const copy = copyByLocale[locale] || copyByLocale.en;

  return (
    <main className="page collaboration-page agent-page">
      <section className="page-header collaboration-hero">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p>{copy.lead}</p>
        </div>
        <div className="button-row">
          <Link
            className="button button-ghost"
            data-tracking-event="collaboration_overview_click"
            data-tracking-label="overview"
            data-tracking-placement="agents_hero"
            href={`/${locale}/collaborate`}
          >
            <Bot size={18} aria-hidden="true" />
            {copy.back}
          </Link>
          <a
            className="button"
            data-tracking-event="agent_resource_click"
            data-tracking-label="agent-collaboration.json"
            data-tracking-outbound-url={absoluteUrl("/agent-collaboration.json")}
            data-tracking-placement="agents_hero"
            href={absoluteUrl("/agent-collaboration.json")}
            rel="noreferrer"
            target="_blank"
          >
            <FileJson size={18} aria-hidden="true" />
            agent-collaboration.json
          </a>
        </div>
      </section>

      <section className="agent-doc-grid" aria-label={copy.overview}>
        <article className="info-panel collaboration-panel">
          <span className="collaboration-icon">
            <Send size={20} aria-hidden="true" />
          </span>
          <h2>{copy.endpoint}</h2>
          <p>POST JSON batches of up to 10 source-first event or news candidates. No publish token is required.</p>
          <code>{submissionEndpoint}</code>
        </article>
        <article className="info-panel collaboration-panel">
          <span className="collaboration-icon">
            <Clock size={20} aria-hidden="true" />
          </span>
          <h2>{copy.rules}</h2>
          <p>Queued submissions are reviewed weekly. Events need confidence &gt;= 0.85; news needs confidence &gt;= 0.82.</p>
        </article>
        <article className="info-panel collaboration-panel">
          <span className="collaboration-icon">
            <ShieldCheck size={20} aria-hidden="true" />
          </span>
          <h2>{copy.safety}</h2>
          <p>Unsafe URLs, private networks, full copied articles, credentials, cookies, and private personal data are rejected.</p>
        </article>
      </section>

      <section className="page-section collaboration-band" aria-labelledby="schemas-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Machine readable</p>
            <h2 id="schemas-title">{copy.schema}</h2>
          </div>
        </div>
        <div className="machine-link-grid">
          <a
            data-tracking-event="agent_resource_click"
            data-tracking-label="openapi"
            data-tracking-outbound-url={openApiEndpoint}
            data-tracking-placement="machine_links"
            href={openApiEndpoint}
            rel="noreferrer"
            target="_blank"
          >
            <Braces size={18} aria-hidden="true" />
            <span>OpenAPI</span>
            <ExternalLink size={15} aria-hidden="true" />
          </a>
          <a
            data-tracking-event="agent_resource_click"
            data-tracking-label="json_schema"
            data-tracking-outbound-url={schemaEndpoint}
            data-tracking-placement="machine_links"
            href={schemaEndpoint}
            rel="noreferrer"
            target="_blank"
          >
            <FileJson size={18} aria-hidden="true" />
            <span>JSON Schema</span>
            <ExternalLink size={15} aria-hidden="true" />
          </a>
          <a
            data-tracking-event="agent_resource_click"
            data-tracking-label="llms_txt"
            data-tracking-outbound-url={absoluteUrl("/llms.txt")}
            data-tracking-placement="machine_links"
            href={absoluteUrl("/llms.txt")}
            rel="noreferrer"
            target="_blank"
          >
            <Terminal size={18} aria-hidden="true" />
            <span>llms.txt</span>
            <ExternalLink size={15} aria-hidden="true" />
          </a>
        </div>
      </section>

      <section className="page-section collaboration-band" aria-labelledby="sample-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Example</p>
            <h2 id="sample-title">Submit one event candidate</h2>
          </div>
        </div>
        <pre className="code-sample">
          <code>{samplePayload}</code>
        </pre>
      </section>

      <section className="page-section collaboration-band" aria-labelledby="acceptance-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Policy</p>
            <h2 id="acceptance-title">Accepted content</h2>
          </div>
        </div>
        <div className="agent-rules">
          <p>Events require title, start date, country, city, source name, source URL, confidence, and evidence.</p>
          <p>News requires title, short summary, source name, source URL, canonical URL, publisher image URL, publication date, confidence, and evidence.</p>
          <p>Blocking flags quarantine or reject submissions: legal_review_required, low_confidence, duplicate_possible, source_requires_manual_check, paywall_detected, primary_source_missing, discovery_only_source.</p>
          <p>Accepted items are promoted through ChessView&apos;s private ingest path; queued submissions never publish directly.</p>
        </div>
      </section>
    </main>
  );
}
