"use client";

import { useMap } from "@vis.gl/react-google-maps";
import { useEffect, useRef, useState } from "react";

export type StopLabelPayload = {
  id: string;
  position: google.maps.LatLngLiteral;
  index: number;
  title: string;
  /** Berechnetes Zeitfenster „Ankunft–Abreise“ (En-Dash), z. B. „09:30–10:15“ */
  timeWindowLabel: string | null;
  /** Ankunft nach implizitem Rückweg (nur Unterkunft / Rückziel), z. B. „22:40“ */
  homeReturnArrivalLabel?: string | null;
  thumbnailUrl?: string | null;
  isAccommodation?: boolean;
  /**
   * Primary: Karte oberhalb des Punkts (wie bisher).
   * Secondary (graue Zusatz-Nadel): unten, damit die Always-on-Karte die Zahl auf der Nadel nicht verdeckt.
   */
  labelAnchor?: "above" | "below";
};

type Props = {
  stops: StopLabelPayload[];
  /** Welche Karte liegt oben (nach Tap); null = alle gleich. */
  focusStopId: string | null;
  onActivateStopCard: (stopId: string) => void;
};

type LabelTier = "full" | "compact" | "micro";

const FRONT_Z = "10000";
const BASE_Z = "1";

function zoomToLabelTier(zoom: number, coarsePointer: boolean): LabelTier {
  const bump = coarsePointer ? 1 : 0;
  if (zoom >= 15 + bump) return "full";
  if (zoom >= 12 + bump) return "compact";
  return "micro";
}

function truncateTitle(title: string, maxChars: number): string {
  const t = title.trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, maxChars - 1)}…`;
}

function applyStackOrder(
  entries: { id: string; el: HTMLDivElement }[],
  focusId: string | null
): void {
  for (const { id, el } of entries) {
    el.style.zIndex = focusId === id ? FRONT_Z : BASE_Z;
  }
}

/** Dauerhafte Karten-Labels oberhalb jedes Stopps (Titel, Zeitfenster). */
export function StopMapLabels({
  stops,
  focusStopId,
  onActivateStopCard,
}: Props) {
  const map = useMap();
  const [labelTier, setLabelTier] = useState<LabelTier>("full");
  const [coarsePointer, setCoarsePointer] = useState(false);
  const overlaysRef = useRef<google.maps.OverlayView[]>([]);
  const labelElsRef = useRef<{ id: string; el: HTMLDivElement }[]>([]);
  const onActivateRef = useRef(onActivateStopCard);
  onActivateRef.current = onActivateStopCard;
  const focusStopIdRef = useRef(focusStopId);
  focusStopIdRef.current = focusStopId;

  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const apply = () => setCoarsePointer(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (!map || typeof google === "undefined") return;

    const syncTier = () => {
      const z = map.getZoom();
      if (z === undefined || z === null) return;
      setLabelTier(zoomToLabelTier(z, coarsePointer));
    };

    syncTier();
    const zL = map.addListener("zoom_changed", syncTier);
    const idleL = map.addListener("idle", syncTier);

    return () => {
      zL.remove();
      idleL.remove();
    };
  }, [map, coarsePointer]);

  useEffect(() => {
    applyStackOrder(labelElsRef.current, focusStopId);
  }, [focusStopId]);

  useEffect(() => {
    if (!map || typeof google === "undefined") return;

    overlaysRef.current.forEach((o) => o.setMap(null));
    overlaysRef.current = [];
    labelElsRef.current = [];

    class StopCardOverlay extends google.maps.OverlayView {
      private el: HTMLDivElement | null = null;
      private readonly onPointerDownBound: (e: PointerEvent) => void;

      constructor(
        private readonly data: StopLabelPayload,
        private readonly tier: LabelTier
      ) {
        super();
        this.onPointerDownBound = (e: PointerEvent) => {
          e.stopPropagation();
          onActivateRef.current(this.data.id);
        };
      }

      onAdd(): void {
        const wrap = document.createElement("div");
        const anchor = this.data.labelAnchor ?? "above";
        const pinGapPx = this.tier === "micro" ? 36 : this.tier === "compact" ? 40 : 42;
        const transform =
          anchor === "below"
            ? "translate(-50%,12px)"
            : `translate(-50%,calc(-100% - ${pinGapPx}px))`;
        const maxW =
          this.tier === "micro" ? 168 : this.tier === "compact" ? 188 : 220;
        wrap.style.cssText = [
          "position:absolute",
          `transform:${transform}`,
          "pointer-events:auto",
          "touch-action:manipulation",
          "cursor:pointer",
          `max-width:${maxW}px`,
        ].join(";");

        wrap.style.zIndex =
          focusStopIdRef.current === this.data.id ? FRONT_Z : BASE_Z;

        wrap.addEventListener("pointerdown", this.onPointerDownBound, {
          capture: true,
        });

        const isAcc = !!this.data.isAccommodation;

        const card = document.createElement("div");

        if (this.tier === "micro") {
          const line = document.createElement("div");
          const titleShort = truncateTitle(this.data.title, 22);
          let chipText = `${this.data.index}. ${titleShort}`;
          if (this.data.timeWindowLabel) {
            chipText += ` · ${this.data.timeWindowLabel}`;
          }
          line.textContent = chipText;
          line.style.cssText = [
            "font-family:var(--font-inter),system-ui,-apple-system,sans-serif",
            "font-size:11px",
            "font-weight:600",
            "line-height:1.25",
            "color:#0a0a0a",
            "padding:5px 10px",
            "border-radius:999px",
            "background:#ffffff",
            "box-shadow:0 4px 16px rgba(0,0,0,.14),0 0 0 1px rgba(0,0,0,.07)",
            "white-space:nowrap",
            "overflow:hidden",
            "text-overflow:ellipsis",
            "max-width:100%",
          ].join(";");
          if (isAcc) {
            line.style.background =
              "linear-gradient(165deg,#fffbeb 0%,#ffffff 50%,#fefce8 100%)";
            line.style.boxShadow =
              "0 4px 16px rgba(146,64,14,0.12),0 0 0 1px rgba(251,191,36,0.5)";
          }
          card.appendChild(line);
          wrap.appendChild(card);
          this.el = wrap;
          labelElsRef.current.push({ id: this.data.id, el: wrap });
          const panes = this.getPanes();
          (panes?.overlayMouseTarget ?? panes?.floatPane)?.appendChild(wrap);
          return;
        }

        const baseCard = [
          "font-family:var(--font-inter),system-ui,-apple-system,sans-serif",
          "line-height:1.35",
          "color:#0a0a0a",
          "border-radius:14px",
        ].join(";");
        const pad = this.tier === "compact" ? "6px 9px" : "9px 11px";
        const baseFs = this.tier === "compact" ? "11px" : "12px";

        if (isAcc) {
          card.style.cssText =
            baseCard +
            `;font-size:${baseFs};padding:${pad}` +
            ";background:linear-gradient(165deg,#fffbeb 0%,#ffffff 42%,#fef9c3 100%)" +
            ";box-shadow:0 10px 32px rgba(146,64,14,0.16),0 0 0 2px rgba(251,191,36,0.55),0 0 32px rgba(251,191,36,0.25)";
        } else {
          card.style.cssText =
            baseCard +
            `;font-size:${baseFs};padding:${pad}` +
            ";background:#ffffff" +
            ";box-shadow:0 6px 24px rgba(0,0,0,.12),0 0 0 1px rgba(0,0,0,.06)";
        }

        if (this.tier === "full" && this.data.thumbnailUrl) {
          const img = document.createElement("img");
          img.src = this.data.thumbnailUrl;
          img.alt = "";
          img.style.cssText =
            "width:100%;height:68px;object-fit:cover;border-radius:8px;margin-bottom:6px;display:block";
          if (isAcc) {
            img.style.boxShadow =
              "0 0 0 2px rgba(251,191,36,0.45),0 4px 12px rgba(180,83,9,0.12)";
          }
          card.appendChild(img);
        }

        if (isAcc) {
          if (this.tier === "full") {
            const accHeader = document.createElement("div");
            accHeader.style.cssText =
              "display:flex;flex-direction:column;align-items:center;gap:5px;margin-bottom:6px;width:100%";

            const iconWrap = document.createElement("div");
            iconWrap.setAttribute("aria-hidden", "true");
            iconWrap.style.cssText = [
              "display:flex",
              "align-items:center",
              "justify-content:center",
              "width:48px",
              "height:48px",
              "border-radius:16px",
              "background:linear-gradient(155deg,#fde68a 0%,#fcd34d 55%,#fbbf24 100%)",
              "box-shadow:0 3px 12px rgba(180,83,9,0.28),inset 0 1px 0 rgba(255,255,255,0.65)",
            ].join(";");

            const houseSvgW = 28;
            iconWrap.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${houseSvgW}" height="${houseSvgW}" viewBox="0 0 24 24" fill="none" stroke="#78350f" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;

            const accBadge = document.createElement("span");
            accBadge.textContent = "Unterkunft";
            accBadge.setAttribute("aria-label", "Unterkunft");
            accBadge.style.cssText = [
              "font-size:10px",
              "font-weight:800",
              "letter-spacing:0.08em",
              "text-transform:uppercase",
              "color:#92400e",
              "line-height:1",
            ].join(";");

            accHeader.appendChild(iconWrap);
            accHeader.appendChild(accBadge);
            card.appendChild(accHeader);
          } else {
            const accRow = document.createElement("div");
            accRow.style.cssText =
              "display:flex;align-items:center;gap:6px;margin-bottom:5px;width:100%";
            const mini = document.createElement("span");
            mini.setAttribute("aria-hidden", "true");
            mini.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#92400e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
            const accLbl = document.createElement("span");
            accLbl.textContent = "Unterkunft";
            accLbl.style.cssText =
              "font-size:9px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:#92400e";
            accRow.appendChild(mini);
            accRow.appendChild(accLbl);
            card.appendChild(accRow);
          }
        }

        const titleFs = this.tier === "compact" ? "12px" : "13px";
        const titleWrap = document.createElement("div");
        titleWrap.style.cssText = isAcc
          ? `font-weight:600;font-size:${titleFs};letter-spacing:-0.02em;margin-bottom:2px;text-align:center;width:100%;min-width:0;overflow-wrap:anywhere`
          : `font-weight:600;font-size:${titleFs};letter-spacing:-0.02em;margin-bottom:2px;display:flex;align-items:center;gap:5px;min-width:0`;

        const titleSpan = document.createElement("span");
        titleSpan.textContent = `${this.data.index}. ${this.data.title}`;
        titleSpan.style.cssText = "min-width:0;overflow-wrap:anywhere";
        titleWrap.appendChild(titleSpan);
        card.appendChild(titleWrap);

        if (this.data.timeWindowLabel) {
          const t = document.createElement("div");
          t.textContent =
            this.tier === "compact"
              ? this.data.timeWindowLabel
              : `Ankunft–Abreise: ${this.data.timeWindowLabel}`;
          const timeFs = this.tier === "compact" ? "10px" : "12px";
          t.style.cssText = [
            "opacity:0.88",
            "font-variant-numeric:tabular-nums",
            `font-size:${timeFs}`,
            isAcc ? "text-align:center" : "",
          ]
            .filter(Boolean)
            .join(";");
          card.appendChild(t);
        }

        if (
          isAcc &&
          this.data.homeReturnArrivalLabel &&
          this.data.homeReturnArrivalLabel.trim()
        ) {
          const h = document.createElement("div");
          h.textContent = `Heimkehr ca. ${this.data.homeReturnArrivalLabel}`;
          const hFs = this.tier === "compact" ? "10px" : "12px";
          h.style.cssText = [
            "margin-top:6px",
            "padding-top:6px",
            "border-top:1px solid rgba(180,83,9,0.22)",
            "font-variant-numeric:tabular-nums",
            `font-size:${hFs}`,
            "font-weight:600",
            "color:#78350f",
            "text-align:center",
          ].join(";");
          card.appendChild(h);
        }

        wrap.appendChild(card);
        this.el = wrap;
        labelElsRef.current.push({ id: this.data.id, el: wrap });

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
        if (this.el) {
          this.el.removeEventListener("pointerdown", this.onPointerDownBound, {
            capture: true,
          });
          this.el.remove();
        }
        this.el = null;
      }
    }

    for (const s of stops) {
      const o = new StopCardOverlay(s, labelTier);
      o.setMap(map);
      overlaysRef.current.push(o);
    }

    applyStackOrder(labelElsRef.current, focusStopIdRef.current);

    return () => {
      overlaysRef.current.forEach((o) => o.setMap(null));
      overlaysRef.current = [];
      labelElsRef.current = [];
    };
  }, [map, stops, labelTier]);

  return null;
}
