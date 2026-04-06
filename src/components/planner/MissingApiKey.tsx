import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function MissingApiKey() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <CardTitle>API-Key fehlt</CardTitle>
          <CardDescription>
            Lege im Projektroot eine Datei <code className="text-xs">.env.local</code>{" "}
            an und setze <code className="text-xs">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>{" "}
            auf deinen Google-Maps-Browser-Key (siehe{" "}
            <a
              className="underline text-primary"
              href="https://developers.google.com/maps/documentation/javascript/get-api-key"
              target="_blank"
              rel="noreferrer"
            >
              Anleitung
            </a>
            ).
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Aktiviere in der Google Cloud Console mindestens:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Maps JavaScript API</li>
            <li>Places API</li>
            <li>Directions API</li>
          </ul>
          <p>
            Schränke den Key per HTTP-Referrer ein (<code className="text-xs">localhost:*</code>{" "}
            für die Entwicklung).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
