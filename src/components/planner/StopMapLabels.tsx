"use client";

import { useMap } from "@vis.gl/react-google-maps";
import { useEffect, useRef } from "react";

export type StopLabelPayload = {
  id: string;
  position: google.maps.LatLngLiteral;
  index: number;
  title: string;
  /** Berechnetes Zeitfenster „Ankunft–Abreise“ (En-Dash), z. B. „09:30–10:15“ */
  timeWindowLabel: string | null;
  thumbnailUrl?: string | null;
  isAccommodation?: boolean;
};

type Props = { stops: StopLabelPayload[] };

/** Dauerhafte Karten-Labels oberhalb jedes Stopps (Titel, Zeitfenster). */
export function StopMapLabels({ stops }: Props) {
  const map = useMap();
  const overlaysRef = useRef<google.maps.OverlayView[]>([]);

  useEffect(() => {
    if (!map || typeof google === "undefined") return;

    overlaysRef.current.forEach((o) => o.setMap(null));
    overlaysRef.current = [];

    class StopCardOverlay extends google.maps.OverlayView {
      private el: HTMLDivElement | null = null;

      constructor(private readonly data: StopLabelPayload) {
        super();
      }

      onAdd(): void {
        const wrap = document.createElement("div");
        wrap.style.cssText = [
          "position:absolute",
          // Mehr Abstand nach oben, damit die Kartenkarte die rote Nadel nicht überdeckt
          "transform:translate(-50%,calc(-100% - 42px))",
          "pointer-events:none",
          "z-index:0",
          "max-width:220px",
        ].join(";");

        const card = document.createElement("div");
        card.style.cssText = [
          "font-family:var(--font-inter),system-ui,-apple-system,sans-serif",
          "font-size:12px",
          "line-height:1.35",
          "color:#0a0a0a",
          "background:#ffffff",
          "border-radius:12px",
          "box-shadow:0 6px 24px rgba(0,0,0,.12),0 0 0 1px rgba(0,0,0,.06)",
          "padding:8px 10px",
        ].join(";");

        if (this.data.thumbnailUrl) {
          const img = document.createElement("img");
          img.src = this.data.thumbnailUrl;
          img.alt = "";
          img.referrerPolicy = "no-referrer";
          img.style.cssText =
            "width:100%;height:68px;object-fit:cover;border-radius:8px;margin-bottom:6px;display:block";
          card.appendChild(img);
        }

        const idx = document.createElement("div");
        idx.style.cssText =
          "font-weight:600;font-size:13px;letter-spacing:-0.02em;margin-bottom:2px;display:flex;align-items:center;gap:5px;min-width:0";
        if (this.data.isAccommodation) {
          const house = document.createElement("span");
          house.setAttribute("aria-label", "Unterkunft");
          house.title = "Unterkunft";
          house.style.cssText = "flex-shrink:0;line-height:0;display:flex";
          house.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
          idx.appendChild(house);
        }
        const titleSpan = document.createElement("span");
        titleSpan.textContent = `${this.data.index}. ${this.data.title}`;
        titleSpan.style.cssText = "min-width:0;overflow-wrap:anywhere";
        idx.appendChild(titleSpan);
        card.appendChild(idx);

        if (this.data.timeWindowLabel) {
          const t = document.createElement("div");
          t.textContent = `Ankunft–Abreise: ${this.data.timeWindowLabel}`;
          t.style.cssText =
            "opacity:0.88;font-variant-numeric:tabular-nums;font-size:12px";
          card.appendChild(t);
        }

        wrap.appendChild(card);
        this.el = wrap;
        /** Unterhalb von floatPane, damit das Google-InfoWindow garantiert darüber liegt. */
        const panes = this.getPanes();
        (panes?.overlayMouseTarget ?? panes?.floatPane)?.appendChild(wrap);
      }

      draw(): void {
        const proj = this.getProjection();
        if (!proj || !this.el) return;
        const pixel = proj.fromLatLngToDivPixel(
          new google.maps.LatLng(this.data.position.lat, this.data.position.lng)
        );
        if (!pixel) return;
        this.el.style.left = `${pixel.x}px`;
        this.el.style.top = `${pixel.y}px`;
      }

      onRemove(): void {
        this.el?.remove();
        this.el = null;
      }
    }

    for (const s of stops) {
      const o = new StopCardOverlay(s);
      o.setMap(map);
      overlaysRef.current.push(o);
    }

    return () => {
      overlaysRef.current.forEach((o) => o.setMap(null));
      overlaysRef.current = [];
    };
  }, [map, stops]);

  return null;
}
