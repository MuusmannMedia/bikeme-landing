"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";

import { OPEN_FREE_MAP_STYLE_URL } from "@/lib/route-map";

export type MeetingCoordinate = {
  latitude: number;
  longitude: number;
};

type MapLibreModule = typeof import("maplibre-gl");

const DEFAULT_CENTER: [longitude: number, latitude: number] = [12.5683, 55.6761];
const INITIAL_LOAD_TIMEOUT_MS = 12_000;

function markerElement(label: string): HTMLDivElement {
  const element = document.createElement("div");
  element.className = "bike-app-meeting-map-marker";
  element.setAttribute("role", "img");
  element.setAttribute("aria-label", label);
  return element;
}

export function MeetingPointMap({
  coordinate,
  onSelect,
  mapLabel,
  markerLabel,
  chooseHint,
  currentLocationLabel,
  locatingLabel,
  locationErrorLabel,
  mapErrorLabel,
  zoomInLabel,
  zoomOutLabel,
  attributionLabel
}: {
  coordinate: MeetingCoordinate | null;
  onSelect: (coordinate: MeetingCoordinate) => void;
  mapLabel: string;
  markerLabel: string;
  chooseHint: string;
  currentLocationLabel: string;
  locatingLabel: string;
  locationErrorLabel: string;
  mapErrorLabel: string;
  zoomInLabel: string;
  zoomOutLabel: string;
  attributionLabel: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const moduleRef = useRef<MapLibreModule | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const onSelectRef = useRef(onSelect);
  const initialCoordinateRef = useRef(coordinate);
  const [ready, setReady] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    let initialLoadComplete = false;
    let loadTimeout: ReturnType<typeof setTimeout> | null = null;

    const failInitialLoad = () => {
      if (cancelled || initialLoadComplete) return;
      if (loadTimeout) clearTimeout(loadTimeout);
      markerRef.current?.remove();
      markerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      setMapFailed(true);
      setReady(false);
    };

    void import("maplibre-gl").then((maplibre) => {
      if (cancelled || !containerRef.current) return;
      moduleRef.current = maplibre;
      const initialCoordinate = initialCoordinateRef.current;
      const map = new maplibre.Map({
        container: containerRef.current,
        style: OPEN_FREE_MAP_STYLE_URL,
        center: initialCoordinate
          ? [initialCoordinate.longitude, initialCoordinate.latitude]
          : DEFAULT_CENTER,
        zoom: initialCoordinate ? 14 : 10,
        minZoom: 2,
        maxZoom: 18,
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        transformRequest: (url) => ({ url, referrerPolicy: "no-referrer" }),
        locale: {
          "Map.Title": mapLabel,
          "AttributionControl.ToggleAttribution": attributionLabel,
          "NavigationControl.ZoomIn": zoomInLabel,
          "NavigationControl.ZoomOut": zoomOutLabel
        }
      });
      mapRef.current = map;
      map.dragRotate.disable();
      map.touchZoomRotate.disableRotation();
      map.addControl(new maplibre.AttributionControl({ compact: true }), "bottom-left");
      map.addControl(new maplibre.NavigationControl({ showCompass: false }), "bottom-right");
      const canvas = map.getCanvas();
      canvas.setAttribute("aria-label", mapLabel);
      canvas.setAttribute("role", "application");

      map.on("click", (event) => {
        onSelectRef.current({ latitude: event.lngLat.lat, longitude: event.lngLat.lng });
      });
      map.once("load", () => {
        if (cancelled) return;
        initialLoadComplete = true;
        if (loadTimeout) clearTimeout(loadTimeout);
        setMapFailed(false);
        setReady(true);
      });
      map.on("error", () => {
        if (!map.loaded()) failInitialLoad();
      });
      loadTimeout = setTimeout(failInitialLoad, INITIAL_LOAD_TIMEOUT_MS);
    }).catch(failInitialLoad);

    return () => {
      cancelled = true;
      if (loadTimeout) clearTimeout(loadTimeout);
      markerRef.current?.remove();
      markerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      moduleRef.current = null;
    };
  }, [attributionLabel, mapLabel, zoomInLabel, zoomOutLabel]);

  useEffect(() => {
    const map = mapRef.current;
    const maplibre = moduleRef.current;
    if (!map || !maplibre || !ready) return;
    if (!coordinate) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    const lngLat: [number, number] = [coordinate.longitude, coordinate.latitude];
    if (!markerRef.current) {
      markerRef.current = new maplibre.Marker({ element: markerElement(markerLabel), anchor: "center" })
        .setLngLat(lngLat)
        .addTo(map);
    } else {
      markerRef.current.setLngLat(lngLat);
    }
  }, [coordinate, markerLabel, ready]);

  const useCurrentLocation = () => {
    setLocationError(false);
    if (!navigator.geolocation) {
      setLocationError(true);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextCoordinate = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
        setLocating(false);
        onSelectRef.current(nextCoordinate);
        mapRef.current?.flyTo({
          center: [nextCoordinate.longitude, nextCoordinate.latitude],
          zoom: 15,
          essential: true
        });
      },
      () => {
        setLocating(false);
        setLocationError(true);
      },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 10_000 }
    );
  };

  return (
    <div className="bike-app-meeting-map-picker">
      <p>{chooseHint}</p>
      <div className="bike-app-meeting-map" data-ready={ready && !mapFailed}>
        <div ref={containerRef} className="bike-app-meeting-map-canvas" />
        {!ready || mapFailed ? (
          <div className="bike-app-meeting-map-status" role={mapFailed ? "alert" : "status"}>
            {mapFailed ? mapErrorLabel : "…"}
          </div>
        ) : null}
      </div>
      <button
        className="bike-app-button bike-app-button-secondary bike-app-button-small"
        type="button"
        disabled={locating}
        aria-busy={locating}
        onClick={useCurrentLocation}
      >
        {locating ? locatingLabel : currentLocationLabel}
      </button>
      {locationError ? <p className="bike-app-inline-error" role="alert">{locationErrorLabel}</p> : null}
    </div>
  );
}
