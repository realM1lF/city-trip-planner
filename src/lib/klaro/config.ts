/** Cookie-Name für die gespeicherte Einwilligung (Klaro storageName). */
export const KLARO_STORAGE_NAME = "klaro-consent";

/** App-Name in Klaro config.services – für React-Gating (Google Maps). */
export const KLARO_GOOGLE_MAPS_SERVICE = "google-maps";

/**
 * Klaro-CMP-Konfiguration. Wird clientseitig an getManager/render übergeben.
 * @see https://klaro.org/docs/integration/annotated-configuration
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Klaro erwartet flexibles Config-Objekt
export const klaroConfig: any = {
  version: 2,
  elementID: "klaro",
  storageMethod: "cookie",
  storageName: KLARO_STORAGE_NAME,
  cookieExpiresAfterDays: 180,
  default: false,
  mustConsent: false,
  acceptAll: true,
  hideDeclineAll: false,
  hideLearnMore: false,
  htmlTexts: true,
  translations: {
    zz: {
      privacyPolicyUrl: "/datenschutz",
    },
    de: {
      privacyPolicyUrl: "/datenschutz",
      consentNotice: {
        description:
          'Wir verwenden Cookies und ähnliche Techniken. Für die interaktive Karte nutzen wir <strong>Google Maps</strong> (Drittanbieter). Details in unserer <a href="/datenschutz" rel="noopener noreferrer">Datenschutzerklärung</a>.',
        learnMore: "Anpassen",
        changeDescription: "Einstellungen anpassen",
      },
      consentModal: {
        title: "Privatsphäre-Einstellungen",
        description:
          'Hier kannst du auswählen, welche optionalen Dienste wir laden dürfen. Technisch notwendige Cookies kannst du nicht abwählen. Weitere Infos: <a href="/datenschutz" rel="noopener noreferrer">Datenschutz</a>.',
        acceptAll: "Alle akzeptieren",
        acceptSelected: "Auswahl speichern",
        decline: "Alle ablehnen",
        close: "Schließen",
        learnMore: "Anpassen",
      },
      purposes: {
        essential: {
          title: "Technisch notwendig",
          description:
            "Erforderlich für Login, Sitzung und die Speicherung deiner Cookie-Entscheidung.",
        },
        externalMaps: {
          title: "Karten & Geodaten (Drittanbieter)",
          description:
            "Einbindung von Google Maps zur Kartenansicht; dabei können Daten an Google übermittelt werden.",
        },
      },
      "google-maps": {
        title: "Google Maps",
        description:
          "Lädt Karten- und Places-Funktionen von Google LLC. Dabei können u. a. IP-Adresse und Nutzungsdaten an Google übertragen werden; Google kann Cookies oder lokale Speicher unter eigenen Domains setzen. Hinweise: <a href=\"https://policies.google.com/privacy\" target=\"_blank\" rel=\"noopener noreferrer\">Google Datenschutz</a>.",
      },
      essential: {
        title: "Notwendige Funktionen",
        description:
          "Session-Cookies für die Anmeldung (Google OAuth über Auth.js), das Einwilligungs-Cookie von Klaro sowie lokale Speicherung deines Reiseplans und des Darstellungs-Themes im Browser (localStorage). Diese Techniken sind für die Kernfunktion der App erforderlich.",
      },
    },
  },
  services: [
    {
      name: "essential",
      required: true,
      default: true,
      purposes: ["essential"],
      translations: {
        zz: {
          title: "Notwendige Funktionen",
        },
      },
      cookies: [
        [/^(__Secure-|__Host-)?authjs\..*$/, "/"],
        [new RegExp(`^${escapeRegex(KLARO_STORAGE_NAME)}$`), "/"],
      ],
    },
    {
      name: KLARO_GOOGLE_MAPS_SERVICE,
      required: false,
      default: false,
      purposes: ["externalMaps"],
      translations: {
        zz: {
          title: "Google Maps",
        },
      },
      cookies: [],
    },
  ],
};

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
