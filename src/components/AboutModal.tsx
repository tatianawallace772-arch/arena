import { X } from 'lucide-react';
import { Shield } from './Icons';

export default function AboutModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="About Interstate">
        <button type="button" className="icon-btn modal-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
        <Shield highway="I-95" size={44} />
        <h2 style={{ marginTop: 14 }}>Interstate</h2>
        <p>
          A map for the open road. Search every signed U.S. interstate exit, see the gas, food,
          lodging and charging around it, and plan a route with turn-by-turn directions. Built
          entirely on open data.
        </p>
        <h3>Data</h3>
        <ul>
          <li>
            Exit, place and drive-time data: <a href="https://openinterstate.org/" target="_blank" rel="noreferrer">OpenInterstate</a>,
            derived from OpenStreetMap and released under the Open Database License (ODbL 1.0).
          </li>
          <li>
            Basemaps: <a href="https://carto.com/basemaps/" target="_blank" rel="noreferrer">CARTO Voyager</a> or standard
            <a href="https://www.openstreetmap.org/" target="_blank" rel="noreferrer"> OpenStreetMap</a> tiles, plus Esri World Imagery and OpenTopoMap.
            Geocoding uses Photon and Nominatim; routing uses the OSRM demo server.
          </li>
          <li>Rest areas and service plazas: OpenStreetMap, with truck parking counts from FHWA.</li>
          <li>Notable places: Wikidata (CC0).</li>
        </ul>
        <h3>Good to know</h3>
        <p>
          Exit data covers signed interstates. Services are the places linked to an exit in the
          OpenInterstate release, with drive times from its reachability scoring. Hours and
          amenities come from OpenStreetMap and may be out of date. Always confirm before you rely
          on them.
        </p>
        <div className="attribution-grid">
          <div className="attribution-card">
            <strong>© OpenStreetMap contributors</strong>
            <span>Map data licensed under ODbL 1.0. openstreetmap.org/copyright</span>
          </div>
          <div className="attribution-card">
            <strong>OpenInterstate</strong>
            <span>Exit, corridor and reachability data, ODbL 1.0. openinterstate.org</span>
          </div>
          <div className="attribution-card">
            <strong>Basemap © CARTO</strong>
            <span>Voyager tiles, with OpenStreetMap attribution. carto.com/attributions</span>
          </div>
          <div className="attribution-card">
            <strong>Imagery © Esri</strong>
            <span>Source: Esri, Maxar, Earthstar Geographics</span>
          </div>
          <div className="attribution-card">
            <strong>Not a navigation device</strong>
            <span>Use your own judgement. Road conditions change faster than data does.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
