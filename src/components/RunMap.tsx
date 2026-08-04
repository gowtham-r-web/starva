import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { GeoPoint, RunActivity } from '../types';
import { getZoneForHr, formatPace } from '../lib/bluetoothHr';
import { Layers, Maximize2, Minimize2, MapPin, Navigation, Eye } from 'lucide-react';

interface RunMapProps {
  activity: RunActivity;
  hoveredPointIndex?: number | null;
  onPointHover?: (index: number | null) => void;
  colorBy?: 'hr' | 'elevation' | 'pace' | 'single';
}

type MapTileStyle = 'dark' | 'satellite' | 'topo' | 'street';

const TILE_SERVERS: Record<MapTileStyle, { url: string; attribution: string; name: string }> = {
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://openstreetmap.org">OpenStreetMap</a>',
    name: 'Strava Dark',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    name: 'Satellite',
  },
  topo: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
    name: 'Topographic',
  },
  street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    name: 'Standard Street',
  },
};

export const RunMap: React.FC<RunMapProps> = ({
  activity,
  hoveredPointIndex = null,
  onPointHover,
  colorBy = 'hr',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const polylineLayersRef = useRef<L.Polyline[]>([]);
  const markersLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const hoverMarkerRef = useRef<L.Marker | null>(null);

  const [tileStyle, setTileStyle] = useState<MapTileStyle>('dark');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [selectedPoint, setSelectedPoint] = useState<GeoPoint | null>(null);
  const [colorMode, setColorMode] = useState<'hr' | 'elevation' | 'pace'>(colorBy);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
      });

      tileLayerRef.current = L.tileLayer(TILE_SERVERS[tileStyle].url, {
        maxZoom: 19,
        attribution: TILE_SERVERS[tileStyle].attribution,
      }).addTo(map);

      // Add zoom control at top right
      L.control.zoom({ position: 'topright' }).addTo(map);

      markersLayerGroupRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Handle tile style updates
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    tileLayerRef.current.setUrl(TILE_SERVERS[tileStyle].url);
  }, [tileStyle]);

  // Draw Polylines & Markers when activity or colorMode changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !activity.routePoints || activity.routePoints.length === 0) return;

    // Clear old polylines
    polylineLayersRef.current.forEach((pl) => map.removeLayer(pl));
    polylineLayersRef.current = [];

    if (markersLayerGroupRef.current) {
      markersLayerGroupRef.current.clearLayers();
    }

    const points = activity.routePoints;
    const latLngs = points.map((p) => [p.lat, p.lng] as [number, number]);

    // Fit map bounds to route with comfortable padding
    const bounds = L.latLngBounds(latLngs);
    map.fitBounds(bounds, { padding: [40, 40] });

    // Draw multi-colored segment polylines based on HR / Elevation / Pace
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const segmentCoords: [number, number][] = [
        [p1.lat, p1.lng],
        [p2.lat, p2.lng],
      ];

      let strokeColor = '#FC5200'; // Default Strava Orange

      if (colorMode === 'hr') {
        const zone = getZoneForHr(p1.hr);
        strokeColor = zone.color;
      } else if (colorMode === 'elevation') {
        // Normalize elevation
        const minEle = Math.min(...points.map((p) => p.ele));
        const maxEle = Math.max(...points.map((p) => p.ele));
        const eleRange = maxEle - minEle || 1;
        const ratio = (p1.ele - minEle) / eleRange;
        // Green to Yellow to Purple
        strokeColor = ratio < 0.33 ? '#10b981' : ratio < 0.66 ? '#f59e0b' : '#8b5cf6';
      } else if (colorMode === 'pace') {
        // Fast = Green, Slow = Red
        const speed = p1.speed; // m/s
        strokeColor = speed > 3.5 ? '#10b981' : speed > 2.8 ? '#3b82f6' : '#ef4444';
      }

      const polyline = L.polyline(segmentCoords, {
        color: strokeColor,
        weight: 5,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);

      // Click event on segment
      polyline.on('click', () => {
        setSelectedPoint(p1);
        if (onPointHover) onPointHover(i);
      });

      polylineLayersRef.current.push(polyline);
    }

    // Add Start Marker (Green Pin)
    const startPt = points[0];
    const startIcon = L.divIcon({
      className: 'custom-start-marker',
      html: `
        <div class="flex items-center justify-center w-7 h-7 bg-emerald-500 text-white rounded-full font-bold text-xs border-2 border-white shadow-lg shadow-emerald-500/40 transform hover:scale-110 transition-transform">
          S
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    const startMarker = L.marker([startPt.lat, startPt.lng], { icon: startIcon })
      .bindTooltip('<strong>Start Point</strong><br/>Time: 00:00', { direction: 'top' });
    markersLayerGroupRef.current?.addLayer(startMarker);

    // Add Finish Marker (Checkered Flag / Red Pin)
    const endPt = points[points.length - 1];
    const finishIcon = L.divIcon({
      className: 'custom-finish-marker',
      html: `
        <div class="flex items-center justify-center w-7 h-7 bg-[#FC5200] text-white rounded-full font-bold text-xs border-2 border-white shadow-lg shadow-[#FC5200]/40 transform hover:scale-110 transition-transform">
          🏁
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    const finishMarker = L.marker([endPt.lat, endPt.lng], { icon: finishIcon })
      .bindTooltip(`<strong>Finish Line</strong><br/>Distance: ${activity.distanceKm.toFixed(2)} km`, { direction: 'top' });
    markersLayerGroupRef.current?.addLayer(finishMarker);

    // Add Kilometer Split Markers along route
    activity.splits.forEach((split) => {
      const targetDistMeters = split.splitKm * 1000;
      const splitPoint = points.find((p) => p.distance >= targetDistMeters);

      if (splitPoint) {
        const splitIcon = L.divIcon({
          className: 'custom-split-marker',
          html: `
            <div class="flex items-center justify-center px-1.5 py-0.5 bg-[#181a20] border border-[#FC5200]/60 text-[#FC5200] text-[10px] font-bold rounded-md shadow-md backdrop-blur-md">
              ${split.splitKm}k
            </div>
          `,
          iconSize: [28, 20],
          iconAnchor: [14, 10],
        });

        const marker = L.marker([splitPoint.lat, splitPoint.lng], { icon: splitIcon })
          .bindTooltip(
            `<div class="p-1">
              <strong class="text-[#FC5200]">Split ${split.splitKm} KM</strong><br/>
              Pace: <b>${split.paceStr} /km</b><br/>
              Avg HR: <b>${split.avgHr} BPM</b><br/>
              Ele: <b>+${split.eleGain}m</b>
            </div>`,
            { direction: 'top', opacity: 0.95 }
          );

        markersLayerGroupRef.current?.addLayer(marker);
      }
    });
  }, [activity, colorMode]);

  // Handle Live Chart Hover Marker sync
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !activity.routePoints) return;

    if (hoveredPointIndex !== null && hoveredPointIndex >= 0 && hoveredPointIndex < activity.routePoints.length) {
      const targetPt = activity.routePoints[hoveredPointIndex];
      const zone = getZoneForHr(targetPt.hr);

      if (!hoverMarkerRef.current) {
        const pulseIcon = L.divIcon({
          className: 'hover-pulse-marker',
          html: `
            <div class="relative flex items-center justify-center">
              <div class="absolute w-8 h-8 rounded-full bg-[#FC5200]/40 animate-ping"></div>
              <div class="w-5 h-5 rounded-full border-2 border-white shadow-xl shadow-black/80 flex items-center justify-center text-[9px] font-bold text-white" id="pulse-bg">
                🏃
              </div>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        hoverMarkerRef.current = L.marker([targetPt.lat, targetPt.lng], {
          icon: pulseIcon,
          zIndexOffset: 1000,
        }).addTo(map);
      } else {
        hoverMarkerRef.current.setLatLng([targetPt.lat, targetPt.lng]);
      }

      // Update tooltip content
      hoverMarkerRef.current
        .bindTooltip(
          `<div class="text-xs space-y-1">
            <div class="font-bold text-[#FC5200] flex items-center gap-1">
              <span>❤️ ${targetPt.hr} BPM</span>
              <span class="px-1 py-0.2 rounded text-[9px]" style="background-color: ${zone.bgColor}; color: ${zone.color}">Z${zone.zone}</span>
            </div>
            <div>Elev: <b>${targetPt.ele}m</b></div>
            <div>Distance: <b>${(targetPt.distance / 1000).toFixed(2)} km</b></div>
            <div>Speed: <b>${formatPace(1000 / (targetPt.speed || 3))} /km</b></div>
          </div>`,
          { direction: 'top', permanent: false, opacity: 0.95 }
        )
        .openTooltip();
    } else {
      if (hoverMarkerRef.current) {
        hoverMarkerRef.current.remove();
        hoverMarkerRef.current = null;
      }
    }
  }, [hoveredPointIndex, activity]);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 200);
  };

  const recenterMap = () => {
    if (!mapInstanceRef.current || !activity.routePoints.length) return;
    const latLngs = activity.routePoints.map((p) => [p.lat, p.lng] as [number, number]);
    mapInstanceRef.current.fitBounds(L.latLngBounds(latLngs), { padding: [40, 40] });
  };

  return (
    <div
      className={`relative w-full rounded-2xl overflow-hidden border border-[#2e323d] bg-[#111318] transition-all duration-300 shadow-2xl ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none border-none' : 'h-[440px] md:h-[500px]'
      }`}
    >
      {/* Map DOM Container */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Top Map Control Glass Overlay */}
      <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2">
        {/* Tile Style Selector Dropdown */}
        <div className="flex items-center p-1 bg-[#181a20]/90 backdrop-blur-md border border-[#2e323d] rounded-xl text-xs">
          <Layers className="w-3.5 h-3.5 text-slate-400 ml-2 mr-1" />
          <select
            value={tileStyle}
            onChange={(e) => setTileStyle(e.target.value as MapTileStyle)}
            className="bg-transparent text-slate-200 font-medium focus:outline-none pr-1 cursor-pointer"
          >
            {Object.entries(TILE_SERVERS).map(([key, value]) => (
              <option key={key} value={key} className="bg-[#181a20] text-slate-200">
                {value.name}
              </option>
            ))}
          </select>
        </div>

        {/* Route Color Mode Selector */}
        <div className="flex items-center p-1 bg-[#181a20]/90 backdrop-blur-md border border-[#2e323d] rounded-xl text-xs gap-1">
          <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider px-1">Color:</span>
          <button
            onClick={() => setColorMode('hr')}
            className={`px-2 py-1 rounded-lg font-semibold transition-colors ${
              colorMode === 'hr' ? 'bg-[#FC5200] text-white shadow-md' : 'text-slate-300 hover:text-white'
            }`}
          >
            Heart Rate
          </button>
          <button
            onClick={() => setColorMode('elevation')}
            className={`px-2 py-1 rounded-lg font-semibold transition-colors ${
              colorMode === 'elevation' ? 'bg-[#8b5cf6] text-white shadow-md' : 'text-slate-300 hover:text-white'
            }`}
          >
            Elevation
          </button>
          <button
            onClick={() => setColorMode('pace')}
            className={`px-2 py-1 rounded-lg font-semibold transition-colors ${
              colorMode === 'pace' ? 'bg-[#10b981] text-white shadow-md' : 'text-slate-300 hover:text-white'
            }`}
          >
            Speed
          </button>
        </div>
      </div>

      {/* Top Right Map Actions */}
      <div className="absolute top-4 right-14 z-10 flex items-center gap-2">
        <button
          onClick={recenterMap}
          title="Recenter Route"
          className="p-2 bg-[#181a20]/90 hover:bg-[#282c38] text-slate-200 rounded-xl border border-[#2e323d] backdrop-blur-md shadow-lg transition-colors"
        >
          <Navigation className="w-4 h-4 text-[#FC5200]" />
        </button>

        <button
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Map'}
          className="p-2 bg-[#181a20]/90 hover:bg-[#282c38] text-slate-200 rounded-xl border border-[#2e323d] backdrop-blur-md shadow-lg transition-colors"
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4 text-slate-300" /> : <Maximize2 className="w-4 h-4 text-slate-300" />}
        </button>
      </div>

      {/* Map Legend (Bottom Overlay) */}
      <div className="absolute bottom-4 left-4 z-10 p-3 bg-[#181a20]/90 backdrop-blur-md border border-[#2e323d] rounded-xl max-w-xs text-xs space-y-1.5 shadow-xl hidden sm:block">
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#FC5200]"></span>
            {colorMode === 'hr' ? 'Heart Rate Intensity Zones' : colorMode === 'elevation' ? 'Elevation Profile' : 'Running Speed'}
          </span>
        </div>

        {colorMode === 'hr' && (
          <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
            <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-bold">Z1</span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">Z2</span>
            <span className="px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 font-bold">Z3</span>
            <span className="px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 font-bold">Z4</span>
            <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-bold">Z5</span>
          </div>
        )}

        {colorMode === 'elevation' && (
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>Low ({Math.min(...activity.routePoints.map((p) => p.ele))}m)</span>
            <div className="h-1.5 flex-1 mx-2 rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-purple-600"></div>
            <span>High ({Math.max(...activity.routePoints.map((p) => p.ele))}m)</span>
          </div>
        )}

        {colorMode === 'pace' && (
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span className="text-emerald-400 font-bold">Fast Pace</span>
            <div className="h-1.5 flex-1 mx-2 rounded-full bg-gradient-to-r from-emerald-500 via-blue-500 to-red-500"></div>
            <span className="text-red-400 font-bold">Slower</span>
          </div>
        )}
      </div>

      {/* Inspector Details Modal on Point Selection */}
      {selectedPoint && (
        <div className="absolute bottom-4 right-4 z-10 p-3.5 bg-[#1c1e26] border border-[#FC5200]/40 rounded-2xl shadow-2xl backdrop-blur-lg max-w-xs space-y-2 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-[#FC5200] flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" /> Point Telemetry
            </span>
            <button
              onClick={() => setSelectedPoint(null)}
              className="text-slate-400 hover:text-white text-xs font-bold px-1"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 rounded-xl bg-[#111318] border border-[#2e323d]">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Heart Rate</div>
              <div className="font-display text-base font-bold text-red-400">{selectedPoint.hr} BPM</div>
            </div>
            <div className="p-2 rounded-xl bg-[#111318] border border-[#2e323d]">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Elevation</div>
              <div className="font-display text-base font-bold text-amber-400">{selectedPoint.ele} m</div>
            </div>
            <div className="p-2 rounded-xl bg-[#111318] border border-[#2e323d]">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Distance</div>
              <div className="font-display text-base font-bold text-slate-200">
                {(selectedPoint.distance / 1000).toFixed(2)} km
              </div>
            </div>
            <div className="p-2 rounded-xl bg-[#111318] border border-[#2e323d]">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Cadence</div>
              <div className="font-display text-base font-bold text-blue-400">{selectedPoint.cadence} SPM</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
