import type { Metadata } from "next";
import { LegalPageShell } from "@/components/legal/legal-page-shell";
import { impressumConfig } from "@/content/legal/impressum-config";
import { LEGAL_DOCUMENT_STAND } from "@/content/legal/legal-meta";
import { KLARO_STORAGE_NAME } from "@/lib/klaro/config";

export const metadata: Metadata = {
  title: "Datenschutz – Städte-Trip-Planner",
  description:
    "Datenschutzerklärung für den Städte-Trip-Planner (Hosting, Konto, Karten, lokale Speicherung).",
};

export default function DatenschutzPage() {
  const verantwortlich = impressumConfig;
  return (
    <LegalPageShell title="Datenschutzerklärung">
      <p className="text-xs text-muted-foreground">
        Stand: {LEGAL_DOCUMENT_STAND}. Der Verantwortliche wird aus derselben
        Konfiguration wie im Impressum geladen (
        <code className="rounded bg-muted px-1 py-px text-[11px]">impressum-config.ts</code>
        ).
      </p>

      <section className="space-y-3">
        <h2 className="font-heading text-base font-semibold text-foreground">
          1. Verantwortlicher
        </h2>
        <p>
          Verantwortlich für die Datenverarbeitung auf dieser Website im Sinne
          der DSGVO ist:
        </p>
        <p>
          <span className="text-foreground font-medium">
            {verantwortlich.anbieter}
          </span>
          <br />
          {verantwortlich.anschriftZeilen.map((line) => (
            <span key={line}>
              {line}
              <br />
            </span>
          ))}
          <br />
          E-Mail:{" "}
          <a
            href={`mailto:${verantwortlich.email}`}
            className="text-primary underline underline-offset-2"
          >
            {verantwortlich.email}
          </a>
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-base font-semibold text-foreground">
          2. Hosting
        </h2>
        <p>
          Diese Website wird bei{" "}
          <strong className="text-foreground">Netlify, Inc.</strong> gehostet.
          Beim Aufruf werden durch den Hosting-Anbieter ggf. technische Daten
          verarbeitet (z. B. IP-Adresse, Zeitpunkt, User-Agent), soweit das zum
          Betrieb und der Sicherheit des Dienstes erforderlich ist. Rechtsgrundlage
          ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einem sicheren
          und stabilen Webauftritt). Weitere Informationen:{" "}
          <a
            href="https://www.netlify.com/privacy/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2"
          >
            netlify.com/privacy
          </a>
          .
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-base font-semibold text-foreground">
          3. Nutzerkonto und Anmeldung mit Google
        </h2>
        <p>
          Optional kannst du dich mit einem{" "}
          <strong className="text-foreground">Google-Konto</strong> anmelden.
          Dabei verwenden wir die Bibliothek{" "}
          <strong className="text-foreground">Auth.js</strong> (NextAuth). Google
          übermittelt je nach Einwilligung typischerweise Name und E-Mail-Adresse.
          Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Vertrag / vorvertragliche
          Maßnahmen zur Bereitstellung der Funktion) bzw. Art. 6 Abs. 1 lit. a DSGVO,
          soweit eine Einwilligung erforderlich ist.
        </p>
        <p>
          Hinweise zum Datenschutz bei Google:{" "}
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2"
          >
            policies.google.com/privacy
          </a>
          .
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-base font-semibold text-foreground">
          4. Speicherung von Reisedaten (Cloud)
        </h2>
        <p>
          Wenn du angemeldet bist und eine Reise in der Cloud speicherst, werden
          die zugehörigen Daten (z. B. Trip-Name, Tage, Stopps, Einstellungen,
          optional öffentliche Share-Token) in einer verwalteten{" "}
          <strong className="text-foreground">PostgreSQL</strong>-Datenbank bei{" "}
          <strong className="text-foreground">Neon, Inc.</strong> gespeichert. Der
          physische Speicherort richtet sich nach der in der Neon-Konsole für dein
          Projekt gewählten <strong className="text-foreground">Region</strong>{" "}
          (z. B. EU oder USA). Bitte prüfe dort deine Konfiguration. Zweck ist die{" "}
          <strong className="text-foreground">Bereitstellung</strong> der
          Synchronisation zwischen Geräten. Rechtsgrundlage Art. 6 Abs. 1 lit. b
          DSGVO.{" "}
          <a
            href="https://neon.tech/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2"
          >
            Datenschutz bei Neon
          </a>
          .
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-base font-semibold text-foreground">
          5. Google Maps und Places (Karten und Ortssuche)
        </h2>
        <p>
          Zur Darstellung von Karten und zur Ortssuche können wir{" "}
          <strong className="text-foreground">
            Google Maps JavaScript API
          </strong>{" "}
          und die{" "}
          <strong className="text-foreground">Google Places API</strong> von{" "}
          <strong className="text-foreground">Google LLC</strong> einbinden. Die
          Karten werden{" "}
          <strong className="text-foreground">
            erst geladen, wenn du dem optionalen Dienst „Google Maps“ in den
            Cookie-/Privatsphäre-Einstellungen zustimmst
          </strong>
          . Dabei können Daten (z. B. IP-Adresse, Nutzungs- und technische
          Informationen, Suchanfragen) an Google übermittelt werden; Google kann
          eigene Cookies oder ähnliche Speicher unter eigenen Domains setzen. Für
          diese Speicher ist eine{" "}
          <strong className="text-foreground">Einwilligung</strong> erforderlich,{" "}
          soweit sie nicht strikt erforderlich sind (
          <abbr
            title="Telekommunikation-Digitale-Dienste-Datenschutz-Gesetz"
            className="cursor-help no-underline"
          >
            § 25 TDDDG
          </abbr>
          ); Rechtsgrundlage der Verarbeitung ist bei Einwilligung Art. 6 Abs. 1
          lit. a DSGVO sowie Art. 6 Abs. 1 lit. b DSGVO, soweit die Karte zur
          Nutzung der von dir gewünschten App-Funktion erforderlich ist.
        </p>
        <p>
          Weitere Infos:{" "}
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2"
          >
            Google-Datenschutzerklärung
          </a>
          ,{" "}
          <a
            href="https://business.safety.google/privacy/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2"
          >
            Google Maps / Google Maps Platform – Datenschutz
          </a>
          .
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-base font-semibold text-foreground">
          6. Geteilte Reisen (Share-Link)
        </h2>
        <p>
          Wenn du einen öffentlichen Link erzeugst, können Dritte die Reise{" "}
          <strong className="text-foreground">nur lesend</strong> einsehen. Es
          wird keine Bearbeitung ohne Anmeldung ermöglicht. Rechtsgrundlage:
          Art. 6 Abs. 1 lit. b bzw. f DSGVO.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-base font-semibold text-foreground">
          7. Lokale Speicherung im Browser
        </h2>
        <p>
          Um deinen Plan auch ohne Cloud-Verbindung zwischen Seitenaufrufen zu
          behalten, speichern wir ausgewählte Planer-Daten im{" "}
          <strong className="text-foreground">localStorage</strong> deines
          Browsers (Technologie: Zustand-Persistenz, Schlüssel z. B.{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs text-foreground">
            gmapsplanner-trip
          </code>
          ). Für die Darstellung des Hell-/Dunkelmodus kann ein Schlüssel{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs text-foreground">
            theme
          </code>{" "}
          gesetzt werden. Du kannst diese Daten jederzeit über die
          Browser-Einstellungen löschen (Website-Daten / Speicher leeren).
          Rechtsgrundlage: Art. 6 Abs. 1 lit. b bzw. f DSGVO; für die
          Theme-Speicherung § 25 Abs. 2 TDDDG, soweit unbedingt erforderlich zur
          bereitgestellten Anzeige.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-base font-semibold text-foreground">
          8. Einwilligungs-Management (Klaro)
        </h2>
        <p>
          Wir setzen die Open-Source-Lösung{" "}
          <strong className="text-foreground">Klaro!</strong> ein, um dir eine
          informierte Entscheidung über optionale Dienste (insbesondere Google
          Maps) zu ermöglichen und deine Einstellungen zu speichern. Dazu wird ein
          Cookie mit dem Namen{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs text-foreground">
            {KLARO_STORAGE_NAME}
          </code>{" "}
          gesetzt (maximale Speicherdauer derzeit 180 Tage, anschließend erneute
          Abfrage möglich). Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO
          (Betrieb eines ordnungsgemäßen, nachweisbaren Consent-Tools) sowie § 25
          Abs. 2 TDDDG, soweit die Speicherung der Entscheidung unbedingt
          erforderlich ist. Du kannst deine Auswahl jederzeit über den Link{" "}
          <strong className="text-foreground">Cookies</strong> in der Fußzeile
          der App ändern; dadurch kann die Karte aus- oder wieder eingeschaltet
          werden.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-base font-semibold text-foreground">
          9. Übersicht Cookies und Browser-Speicher
        </h2>
        <p className="text-muted-foreground text-sm">
          Die folgende Übersicht dient der Transparenz. Cookies von Drittanbietern
          (z. B. Google) sind von dieser Website aus oft nicht vollständig lesbar
          oder löschbar.
        </p>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-3 py-2 font-medium">Name / Schlüssel</th>
                <th className="px-3 py-2 font-medium">Art</th>
                <th className="px-3 py-2 font-medium">Zweck</th>
                <th className="px-3 py-2 font-medium">Speicherdauer</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-b border-border/80">
                <td className="px-3 py-2 align-top">
                  <code className="text-xs">authjs.*</code> (Präfixe{" "}
                  <code className="text-xs">__Secure-</code> /{" "}
                  <code className="text-xs">__Host-</code> möglich, ggf.{" "}
                  <code className="text-xs">.0</code>, <code className="text-xs">.1</code>{" "}
                  bei geteilten Cookies)
                </td>
                <td className="px-3 py-2 align-top">HTTP-Cookie</td>
                <td className="px-3 py-2 align-top">
                  Sitzung und Sicherheit für Auth.js (OAuth/Google-Anmeldung)
                </td>
                <td className="px-3 py-2 align-top">
                  Session bzw. begrenzte Gültigkeit (OAuth-State/PKCE typischerweise
                  Minuten)
                </td>
              </tr>
              <tr className="border-b border-border/80">
                <td className="px-3 py-2 align-top">
                  <code className="text-xs">{KLARO_STORAGE_NAME}</code>
                </td>
                <td className="px-3 py-2 align-top">HTTP-Cookie</td>
                <td className="px-3 py-2 align-top">
                  Speichert deine Einwilligungsentscheidungen (Klaro)
                </td>
                <td className="px-3 py-2 align-top">bis zu 180 Tage</td>
              </tr>
              <tr className="border-b border-border/80">
                <td className="px-3 py-2 align-top">
                  <code className="text-xs">gmapsplanner-trip</code>
                </td>
                <td className="px-3 py-2 align-top">localStorage</td>
                <td className="px-3 py-2 align-top">
                  Lokaler Zwischenspeicher des Reiseplans
                </td>
                <td className="px-3 py-2 align-top">bis zur manuellen Löschung</td>
              </tr>
              <tr className="border-b border-border/80">
                <td className="px-3 py-2 align-top">
                  <code className="text-xs">theme</code>
                </td>
                <td className="px-3 py-2 align-top">localStorage</td>
                <td className="px-3 py-2 align-top">Hell-/Dunkelmodus</td>
                <td className="px-3 py-2 align-top">bis zur manuellen Löschung</td>
              </tr>
              <tr>
                <td className="px-3 py-2 align-top">Google (z. B.{" "}
                  <code className="text-xs">.google.com</code>)</td>
                <td className="px-3 py-2 align-top">Drittanbieter</td>
                <td className="px-3 py-2 align-top">
                  Nur nach Einwilligung „Google Maps“; ggf. Cookies/Storage durch
                  Google
                </td>
                <td className="px-3 py-2 align-top">
                  siehe{" "}
                  <a
                    href="https://policies.google.com/technologies/cookies"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-2"
                  >
                    Google
                  </a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-sm">
          Für die Anmeldung fallen unter die oben genannten{" "}
          <code className="rounded bg-muted px-1 py-px text-xs">authjs.*</code>
          -Cookies; Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO bzw. § 25 Abs. 2
          TDDDG, soweit unbedingt erforderlich.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-base font-semibold text-foreground">
          10. Speicherdauer
        </h2>
        <p>
          Sitzungs- und Kontodaten werden gespeichert, solange das Konto besteht
          bzw. die Speicherung für den Zweck erforderlich ist. Cloud-Reisen kannst
          du durch Löschen in der App entfernen. LocalStorage-Daten bleiben, bis du
          sie im Browser löschst oder die App die Daten überschreibt.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-base font-semibold text-foreground">
          11. Deine Rechte
        </h2>
        <p>
          Du hast nach Maßgabe der DSGVO insbesondere Rechte auf Auskunft,
          Berichtigung, Löschung, Einschränkung der Verarbeitung, Widerspruch und
          Datenübertragbarkeit sowie das Recht, dich bei einer Aufsichtsbehörde zu
          beschweren. Zuständigkeit richtet sich nach Art. 77 DSGVO i. V. m. den
          landesspezifischen Regelungen.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-base font-semibold text-foreground">
          12. Änderungen
        </h2>
        <p>
          Wir können diese Erklärung anpassen, wenn sich die Dienste oder die
          Rechtslage ändern. Die jeweils aktuelle Fassung findest du auf dieser
          Seite.
        </p>
      </section>
    </LegalPageShell>
  );
}
