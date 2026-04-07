import type { Metadata } from "next";
import { LegalPageShell } from "@/components/legal/legal-page-shell";
import { impressumConfig } from "@/content/legal/impressum-config";
import { LEGAL_DOCUMENT_STAND } from "@/content/legal/legal-meta";

export const metadata: Metadata = {
  title: "Impressum – Städte-Trip-Planner",
  description: "Impressum und Anbieterkennzeichnung des Städte-Trip-Planners.",
};

export default function ImpressumPage() {
  const c = impressumConfig;
  return (
    <LegalPageShell title="Impressum">
      <p className="text-xs text-muted-foreground">Stand: {LEGAL_DOCUMENT_STAND}</p>

      <section className="space-y-3">
        <h2 className="font-heading text-base font-semibold text-foreground">
          Angaben gemäß § 5 DDG / Anbieterkennzeichnung
        </h2>
        <p>
          <span className="text-foreground font-medium">{c.anbieter}</span>
          <br />
          {c.anschriftZeilen.map((line) => (
            <span key={line}>
              {line}
              <br />
            </span>
          ))}
        </p>
        <p>
          E-Mail:{" "}
          <a
            href={`mailto:${c.email}`}
            className="text-primary underline underline-offset-2"
          >
            {c.email}
          </a>
        </p>
        <p>
          Website:{" "}
          <a
            href={c.websiteUrl}
            className="text-primary underline underline-offset-2"
            rel="noopener noreferrer"
          >
            {c.websiteLabel}
          </a>
        </p>
        {typeof c.ustId === "string" && c.ustId.trim() !== "" ? (
          <p>
            Umsatzsteuer-ID:{" "}
            <span className="text-foreground">{c.ustId.trim()}</span>
          </p>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-base font-semibold text-foreground">
          Haftung für Inhalte
        </h2>
        <p>
          Als Diensteanbieter sind wir gemäß den allgemeinen Gesetzen für eigene
          Inhalte auf diesen Seiten verantwortlich. Für die Inhalte
          nutzergenerierter Daten (z. B. gespeicherte Reisepläne) sind die
          jeweiligen Nutzer verantwortlich.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-base font-semibold text-foreground">
          Haftung für Links
        </h2>
        <p>
          Unser Angebot enthält ggf. Links zu externen Websites Dritter, auf
          deren Inhalte wir keinen Einfluss haben. Für die Inhalte der verlinkten
          Seiten ist stets der jeweilige Anbieter verantwortlich.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-base font-semibold text-foreground">
          Streitbeilegung / Verbraucherstreitbeilegung
        </h2>
        <p>
          Wir sind nicht bereit und nicht verpflichtet, an
          Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle
          teilzunehmen, sofern nicht gesetzlich anders vorgeschrieben.
        </p>
      </section>
    </LegalPageShell>
  );
}
