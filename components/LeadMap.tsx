"use client";

import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { Lead } from "@/lib/types";

export default function LeadMap({ leads }: { leads: Lead[] }) {
  if (leads.length === 0) {
    return <div className="h-[320px] rounded-lg border border-dashed border-border flex items-center justify-center text-sm text-muted-foreground">Map appears once leads are scraped</div>;
  }
  const center: [number, number] = [
    leads.reduce((s, l) => s + l.lat, 0) / leads.length,
    leads.reduce((s, l) => s + l.lng, 0) / leads.length,
  ];
  return (
    <div className="h-[320px] rounded-lg overflow-hidden border border-border">
      <MapContainer center={center} zoom={14} className="h-full w-full" scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; OpenStreetMap &copy; CARTO'
          url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
        />
        {leads.map((l) => (
          <CircleMarker
            key={l.id}
            center={[l.lat, l.lng]}
            radius={7}
            pathOptions={{ color: "#7a5c3e", fillColor: "#a8866a", fillOpacity: 0.85, weight: 1.5 }}
          >
            <Tooltip>{l.name}</Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
