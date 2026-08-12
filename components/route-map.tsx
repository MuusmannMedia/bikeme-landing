"use client";

import type { ReactNode } from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Map as MapLibreMap, Marker, NavigationControl } from "maplibre-gl";

import type { RoutePoint } from "@/lib/app-model";
import { buildRouteMapModel, OPEN_FREE_MAP_STYLE_URL, type RouteMapModel } from "@/lib/route-map";

type MapLibreModule = typeof import("maplibre-gl");

type RouteMapProps = {
  points: RoutePoint[];
  label: string;
  fullscreenTitle: string;
  openFullscreenLabel: string;
  closeFullscreenLabel: string;
  startLabel: string;
  finishLabel: string;
  zoomInLabel: string;
  zoomOutLabel: string;
  attributionLabel: string;
  fallback: ReactNode;
};

const SOURCE_ID = "bike-me-completed-route";
const CASING_LAYER_ID = "bike-me-completed-route-casing";
const ROUTE_LAYER_ID = "bike-me-completed-route-line";
const INITIAL_LOAD_TIMEOUT_MS = 12_000;

function fitRoute(map: MapLibreMap, model: RouteMapModel, fullscreen: boolean): void {
  const [[west, south], [east, north]] = model.bounds;
  if (Math.abs(east - west) < 0.000001 && Math.abs(north - south) < 0.000001) {
    map.jumpTo({ center: model.start, zoom: 15 });
    return;
  }
  map.fitBounds(model.bounds, {
    padding: fullscreen
      ? { top: 120, right: 52, bottom: 80, left: 52 }
      : { top: 36, right: 36, bottom: 36, left: 36 },
    maxZoom: 15,
    duration: 0
  });
}

function setMapInteraction(map: MapLibreMap, enabled: boolean): void {
  const handlers = [
    map.boxZoom,
    map.doubleClickZoom,
    map.dragPan,
    map.keyboard,
    map.scrollZoom,
    map.touchZoomRotate
  ];
  for (const handler of handlers) {
    if (enabled) handler.enable();
    else handler.disable();
  }
  map.dragRotate.disable();
  map.touchZoomRotate.disableRotation();
}

function markerElement(className: string, label: string): HTMLDivElement {
  const element = document.createElement("div");
  element.className = className;
  element.setAttribute("role", "img");
  element.setAttribute("aria-label", label);
  element.tabIndex = -1;
  return element;
}

function focusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(
    'button:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])'
  )).filter((element) => element.getClientRects().length > 0);
}

export function RouteMap({
  points,
  label,
  fullscreenTitle,
  openFullscreenLabel,
  closeFullscreenLabel,
  startLabel,
  finishLabel,
  zoomInLabel,
  zoomOutLabel,
  attributionLabel,
  fallback
}: RouteMapProps) {
  const model = useMemo(() => buildRouteMapModel(points), [points]);
  const [ready, setReady] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const moduleRef = useRef<MapLibreModule | null>(null);
  const navigationRef = useRef<NavigationControl | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const titleId = useId();

  useEffect(() => {
    if (!model || !containerRef.current) return;
    let cancelled = false;
    let failed = false;
    let initialLoadComplete = false;
    let resizeObserver: ResizeObserver | null = null;
    let loadTimeout: ReturnType<typeof setTimeout> | null = null;
    setReady(false);

    const failInitialLoad = () => {
      if (failed || cancelled || initialLoadComplete) return;
      failed = true;
      if (loadTimeout) clearTimeout(loadTimeout);
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
      setReady(false);
    };

    void import("maplibre-gl").then((maplibre) => {
      if (cancelled || !containerRef.current) return;
      moduleRef.current = maplibre;
      const map = new maplibre.Map({
        container: containerRef.current,
        style: OPEN_FREE_MAP_STYLE_URL,
        center: model.start,
        zoom: 11,
        minZoom: 2,
        maxZoom: 18,
        interactive: true,
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        transformRequest: (url) => ({ url, referrerPolicy: "no-referrer" }),
        locale: {
          "Map.Title": label,
          "AttributionControl.ToggleAttribution": attributionLabel,
          "NavigationControl.ZoomIn": zoomInLabel,
          "NavigationControl.ZoomOut": zoomOutLabel
        }
      });
      mapRef.current = map;
      setMapInteraction(map, false);
      const attribution = new maplibre.AttributionControl({ compact: true });
      map.addControl(attribution, "bottom-left");

      const canvas = map.getCanvas();
      canvas.setAttribute("aria-label", label);
      canvas.setAttribute("role", "img");
      canvas.tabIndex = -1;

      const onLoad = () => {
        if (cancelled || failed) return;
        try {
          map.addSource(SOURCE_ID, {
            type: "geojson",
            data: {
              type: "FeatureCollection",
              features: model.segments.map((segment, index) => ({
                type: "Feature",
                id: index,
                properties: {},
                geometry: { type: "LineString", coordinates: segment }
              }))
            }
          });
          map.addLayer({
            id: CASING_LAYER_ID,
            type: "line",
            source: SOURCE_ID,
            paint: { "line-color": "rgba(2,8,23,.62)", "line-width": 9, "line-opacity": 0.92 },
            layout: { "line-cap": "round", "line-join": "round" }
          });
          map.addLayer({
            id: ROUTE_LAYER_ID,
            type: "line",
            source: SOURCE_ID,
            paint: { "line-color": "#FF6A00", "line-width": 5 },
            layout: { "line-cap": "round", "line-join": "round" }
          });

          const startMarker = new maplibre.Marker({
            element: markerElement("bike-app-route-map-marker bike-app-route-map-marker-start", startLabel),
            anchor: "center"
          }).setLngLat(model.start).addTo(map);
          const finishMarker = new maplibre.Marker({
            element: markerElement("bike-app-route-map-marker bike-app-route-map-marker-finish", finishLabel),
            anchor: "center"
          }).setLngLat(model.finish).addTo(map);
          markersRef.current = [startMarker, finishMarker];
          fitRoute(map, model, false);
          initialLoadComplete = true;
          if (loadTimeout) clearTimeout(loadTimeout);
          requestAnimationFrame(() => {
            if (!cancelled && !failed) setReady(true);
          });
        } catch {
          failInitialLoad();
        }
      };
      map.once("load", onLoad);
      map.on("error", () => {
        if (!map.loaded()) failInitialLoad();
      });
      loadTimeout = setTimeout(failInitialLoad, INITIAL_LOAD_TIMEOUT_MS);

      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(() => map.resize());
        resizeObserver.observe(containerRef.current);
      }
    }).catch(failInitialLoad);

    return () => {
      cancelled = true;
      if (loadTimeout) clearTimeout(loadTimeout);
      resizeObserver?.disconnect();
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
      moduleRef.current = null;
      navigationRef.current = null;
    };
  }, [attributionLabel, finishLabel, label, model, startLabel, zoomInLabel, zoomOutLabel]);

  useEffect(() => {
    const map = mapRef.current;
    const maplibre = moduleRef.current;
    if (!map || !model || !ready || !maplibre) return;

    setMapInteraction(map, fullscreen);
    const canvas = map.getCanvas();
    canvas.setAttribute("role", fullscreen ? "region" : "img");
    canvas.tabIndex = fullscreen ? 0 : -1;

    if (fullscreen && !navigationRef.current) {
      const navigation = new maplibre.NavigationControl({ showCompass: false });
      navigationRef.current = navigation;
      map.addControl(navigation, "bottom-right");
    } else if (!fullscreen && navigationRef.current) {
      map.removeControl(navigationRef.current);
      navigationRef.current = null;
    }

    requestAnimationFrame(() => {
      map.resize();
      fitRoute(map, model, fullscreen);
    });
  }, [fullscreen, model, ready]);

  useEffect(() => {
    if (!fullscreen) return;
    const shell = shellRef.current;
    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => closeRef.current?.focus());

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setFullscreen(false);
        return;
      }
      if (event.key !== "Tab" || !shell) return;
      const elements = focusableElements(shell);
      if (elements.length === 0) return;
      const first = elements[0];
      const last = elements.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      requestAnimationFrame(() => {
        const focusTarget = trigger?.isConnected
          ? trigger
          : shell?.querySelector<HTMLButtonElement>(".bike-app-route-map-open");
        if (focusTarget?.isConnected && !focusTarget.hidden) focusTarget.focus();
      });
    };
  }, [fullscreen]);

  if (!model) return fallback;

  return (
    <div
      ref={shellRef}
      className="bike-app-route-map"
      data-fullscreen={fullscreen ? "true" : "false"}
      data-ready={ready ? "true" : "false"}
      role={fullscreen ? "dialog" : undefined}
      aria-modal={fullscreen ? true : undefined}
      aria-labelledby={fullscreen ? titleId : undefined}
    >
      <div ref={containerRef} className="bike-app-route-map-canvas" aria-hidden={!ready} />
      {!ready ? <div className="bike-app-route-map-fallback">{fallback}</div> : null}
      {ready ? (
        <button
          ref={triggerRef}
          className="bike-app-route-map-open"
          type="button"
          hidden={fullscreen}
          onClick={() => setFullscreen(true)}
          aria-label={openFullscreenLabel}
        >
          <span>{openFullscreenLabel}</span>
        </button>
      ) : null}
      {fullscreen ? (
        <header className="bike-app-route-map-fullscreen-header">
          <h2 id={titleId}>{fullscreenTitle}</h2>
          <button
            ref={closeRef}
            type="button"
            className="bike-app-route-map-close"
            onClick={() => setFullscreen(false)}
            aria-label={closeFullscreenLabel}
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>
      ) : null}
    </div>
  );
}
