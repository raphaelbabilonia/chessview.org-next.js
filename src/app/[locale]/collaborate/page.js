import { Bot, Clock, Code2, ExternalLink, GitPullRequest, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { pageSeoMetadata } from "@/lib/seo";
import { siteConfig } from "@/lib/site";

const copyByLocale = {
  en: {
    eyebrow: "Open collaboration",
    title: "Contribute to ChessView",
    lead:
      "ChessView is open source, and its public discovery layer can also be improved by external agents that submit source-first tournament and news metadata for review.",
    agents: "Collaborate with agents",
    github: "Open source code",
    repositories: "Repositories",
    workflow: "How agent collaboration works",
    principles: "Boundaries",
    cards: [
      {
        icon: Bot,
        title: "Agents submit metadata",
        body: "External agents can queue public tournament and news candidates through a documented API.",
      },
      {
        icon: Clock,
        title: "Weekly rule-based review",
        body: "High-confidence, source-attributed submissions can be promoted weekly; uncertain items are quarantined.",
      },
      {
        icon: ShieldCheck,
        title: "Source-first publishing",
        body: "ChessView publishes short discovery records and sends readers back to original organizers and publishers.",
      },
    ],
    boundaries: [
      "Do not submit private data, credentials, cookies, copied full articles, proprietary databases, or third-party assets without permission.",
      "Tournament dates, rules, fees, venues, ratings, and registration status must remain verifiable at the original source.",
      "The AGPL code is open source; ChessView brand assets, production data, curated datasets, and operational review workspaces remain reserved unless separately licensed.",
    ],
  },
  es: {
    eyebrow: "Colaboracion abierta",
    title: "Contribuir a ChessView",
    lead:
      "ChessView es open source, y su capa publica de descubrimiento tambien puede mejorar con agentes externos que envian metadata de torneos y noticias para revision.",
    agents: "Colaborar con agentes",
    github: "Codigo open source",
    repositories: "Repositorios",
    workflow: "Como funciona",
    principles: "Limites",
    cards: [
      {
        icon: Bot,
        title: "Los agentes envian metadata",
        body: "Agentes externos pueden poner en cola candidatos de torneos y noticias mediante una API documentada.",
      },
      {
        icon: Clock,
        title: "Revision semanal por reglas",
        body: "Las contribuciones con alta confianza y fuentes claras pueden promocionarse semanalmente; lo dudoso queda en cuarentena.",
      },
      {
        icon: ShieldCheck,
        title: "Publicacion source-first",
        body: "ChessView publica registros breves de descubrimiento y envia lectores a organizadores y medios originales.",
      },
    ],
    boundaries: [
      "No envies datos privados, credenciales, cookies, articulos completos copiados, bases propietarias ni assets de terceros sin permiso.",
      "Fechas, reglas, costos, sedes, ratings e inscripcion deben poder verificarse en la fuente original.",
      "El codigo AGPL es open source; marca, datos de produccion, datasets curados y espacios de revision siguen reservados salvo licencia separada.",
    ],
  },
  it: {
    eyebrow: "Collaborazione aperta",
    title: "Contribuisci a ChessView",
    lead:
      "ChessView e open source, e il suo livello pubblico di scoperta puo migliorare anche con agenti esterni che inviano metadata di tornei e notizie per la revisione.",
    agents: "Collabora con agenti",
    github: "Codice open source",
    repositories: "Repository",
    workflow: "Come funziona",
    principles: "Confini",
    cards: [
      {
        icon: Bot,
        title: "Gli agenti inviano metadata",
        body: "Agenti esterni possono mettere in coda candidati di tornei e notizie tramite una API documentata.",
      },
      {
        icon: Clock,
        title: "Revisione settimanale a regole",
        body: "Le contribuzioni ad alta confidenza e con fonti chiare possono essere promosse ogni settimana; quelle dubbie restano in quarantena.",
      },
      {
        icon: ShieldCheck,
        title: "Pubblicazione source-first",
        body: "ChessView pubblica record brevi di scoperta e rimanda lettori agli organizzatori e agli editori originali.",
      },
    ],
    boundaries: [
      "Non inviare dati privati, credenziali, cookie, articoli completi copiati, database proprietari o asset di terzi senza permesso.",
      "Date, regole, quote, sedi, rating e stato iscrizioni devono restare verificabili nella fonte originale.",
      "Il codice AGPL e open source; brand, dati di produzione, dataset curati e workspace operativi restano riservati salvo licenza separata.",
    ],
  },
};

export async function generateMetadata({ params }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const copy = copyByLocale[locale] || copyByLocale.en;

  return pageSeoMetadata({
    locale,
    path: "/collaborate",
    title: `${copy.title} | ChessView`,
    description: copy.lead,
  });
}

export default async function CollaboratePage({ params }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const copy = copyByLocale[locale] || copyByLocale.en;

  return (
    <main className="page collaboration-page">
      <section className="page-header collaboration-hero">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p>{copy.lead}</p>
        </div>
        <div className="button-row">
          <Link className="button" href={`/${locale}/collaborate/agents`}>
            <Bot size={18} aria-hidden="true" />
            {copy.agents}
          </Link>
          <a className="button button-ghost" href={siteConfig.repositoryUrl} rel="noreferrer" target="_blank">
            <Code2 size={18} aria-hidden="true" />
            {copy.github}
          </a>
        </div>
      </section>

      <section className="page-section collaboration-band" aria-labelledby="workflow-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Agents</p>
            <h2 id="workflow-title">{copy.workflow}</h2>
          </div>
        </div>
        <div className="content-grid">
          {copy.cards.map((card) => {
            const Icon = card.icon;
            return (
              <article className="info-panel collaboration-panel" key={card.title}>
                <span className="collaboration-icon">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <h2>{card.title}</h2>
                <p>{card.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="page-section collaboration-band" aria-labelledby="repositories-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">GitHub</p>
            <h2 id="repositories-title">{copy.repositories}</h2>
          </div>
        </div>
        <div className="repository-grid">
          {siteConfig.repositories.map((repository) => (
            <a className="repository-card" href={repository.url} key={repository.url} rel="noreferrer" target="_blank">
              <span>
                <GitPullRequest size={18} aria-hidden="true" />
                {repository.name}
              </span>
              <p>{repository.description}</p>
              <strong>
                GitHub
                <ExternalLink size={15} aria-hidden="true" />
              </strong>
            </a>
          ))}
        </div>
      </section>

      <section className="page-section collaboration-band" aria-labelledby="boundaries-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Policy</p>
            <h2 id="boundaries-title">{copy.principles}</h2>
          </div>
        </div>
        <div className="policy-list">
          {copy.boundaries.map((item) => (
            <p key={item}>
              <ShieldCheck size={17} aria-hidden="true" />
              <span>{item}</span>
            </p>
          ))}
        </div>
      </section>
    </main>
  );
}
