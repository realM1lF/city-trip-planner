export type TravelModeOption = "DRIVING" | "WALKING" | "BICYCLING" | "TRANSIT";

export type TripStop = {
  id: string;
  order: number;
  label: string;
  placeId?: string;
  lat: number;
  lng: number;
  formattedAddress: string;
  /** Vorschaubild von Places (falls beim Hinzufügen verfügbar) */
  thumbnailUrl?: string;
  /** Tagesanker (erster Stopp) oder Ankunft an der Unterkunft; bei normalen Stopps ab Index 1 unbenutzt. */
  arrivalTime?: string;
  /** Nur Unterkunft: geplantes Ende; sonst Abreise = Ankunft + Verweildauer. */
  departureTime?: string;
  dwellMinutes: number;
  notes?: string;
  /** Max. eine pro Tag — wird beim Anhaken anderer Stopps automatisch zurückgesetzt. */
  isAccommodation?: boolean;
};

export type TripDay = {
  id: string;
  label: string;
  date: string | null;
  stops: TripStop[];
  /**
   * Länge = (stops − 1) Hauptroute + optional 1 Modus für impliziten Rückweg;
   * fehlende Indizes gelten wie globaler Reisemodus.
   */
  legTravelModes?: TravelModeOption[];
  /**
   * Optional: Rückweg auf der Karte vom letzten Stopp zu einem bereits existierenden Stopp,
   * ohne zweiten Listen-Eintrag (z. B. Zurück zur Unterkunft).
   */
  implicitReturnToStopId?: string | null;
};

export type Trip = {
  id: string;
  name: string;
  days: TripDay[];
};

/** Pro Teilstrecke Dauer in Sekunden je Modus (null = keine Route). */
export type MultiModeLegSeconds = {
  walking: (number | null)[];
  driving: (number | null)[];
  transit: (number | null)[];
};

export type PersistedPlannerStateV1 = {
  version: 1;
  trip: Trip;
  activeDayId: string;
  travelMode: TravelModeOption;
  optimizeWaypoints: boolean;
};

/** Export/Import v2: optional gecachte Hauptrouten-Legs (wie im Store). */
export type PersistedPlannerStateV2 = {
  version: 2;
  trip: Trip;
  activeDayId: string;
  travelMode: TravelModeOption;
  optimizeWaypoints: boolean;
  routeLegDurationsByDayId?: Record<string, number[] | null>;
  /** Optional: gecachte Fuß-/Auto-/ÖPNV-Vergleichsdauern pro Tag. */
  multiModeLegSecondsByDayId?: Record<string, MultiModeLegSeconds | null>;
};
