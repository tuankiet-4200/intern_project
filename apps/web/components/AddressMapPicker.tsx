'use client';

import type { CircleMarker, Map as LeafletMap } from 'leaflet';
import { LocateFixed, MapPin, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { addressDraftFromPlace, type AddressDraft, type NominatimPlace } from '@/lib/address';

const DEFAULT_CENTER: [number, number] = [10.7769, 106.7009];
const responseCache = new Map<string, unknown>();

export function AddressMapPicker({ onAddress }: { onAddress: (address: Partial<AddressDraft>) => void }) {
  const mapElementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<CircleMarker | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NominatimPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [mapError, setMapError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function initializeMap() {
      if (!mapElementRef.current || mapRef.current) return;
      try {
        const L = await import('leaflet');
        if (cancelled || !mapElementRef.current) return;
        const map = L.map(mapElementRef.current, { scrollWheelZoom: false }).setView(DEFAULT_CENTER, 12);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map);
        map.on('click', (event) => {
          setMapError('');
          setMarker(L, map, markerRef, event.latlng.lat, event.latlng.lng);
          void reverseGeocode(event.latlng.lat, event.latlng.lng)
            .then((place) => onAddress(addressDraftFromPlace(place)))
            .catch(() => setMapError('Không thể đọc địa chỉ tại điểm này. Bạn vẫn có thể nhập địa chỉ thủ công.'));
        });
        mapRef.current = map;
        window.setTimeout(() => map.invalidateSize(), 0);
      } catch {
        setMapError('Bản đồ chưa tải được. Bạn vẫn có thể nhập địa chỉ thủ công.');
      }
    }
    void initializeMap();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [onAddress]);

  async function searchAddress() {
    const normalized = query.trim();
    if (normalized.length < 3) {
      setMapError('Hãy nhập ít nhất 3 ký tự để tìm địa chỉ.');
      return;
    }
    setLoading(true);
    setMapError('');
    try {
      const parameters = new URLSearchParams({ q: normalized });
      setResults(await geocodingRequest<NominatimPlace[]>(`/api/geocoding/search?${parameters}`));
    } catch {
      setMapError('Không thể tìm địa chỉ lúc này. Hãy thử lại hoặc nhập thủ công.');
    } finally {
      setLoading(false);
    }
  }

  async function choosePlace(place: NominatimPlace) {
    const latitude = Number(place.lat);
    const longitude = Number(place.lon);
    onAddress(addressDraftFromPlace(place));
    setQuery(place.display_name);
    setResults([]);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !mapRef.current) return;
    const L = await import('leaflet');
    mapRef.current.setView([latitude, longitude], 16);
    setMarker(L, mapRef.current, markerRef, latitude, longitude);
  }

  return (
    <section className="rounded-2xl border border-emerald-100 bg-emerald-50/45 p-3.5">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 rounded-lg bg-white p-2 text-[var(--accent)] shadow-sm"><LocateFixed size={17} /></span>
        <div>
          <h3 className="text-sm font-bold">Chọn nhanh trên bản đồ</h3>
          <p className="mt-0.5 text-xs leading-5 text-[var(--muted)]">Tìm kiếm hoặc bấm vào bản đồ để tự điền địa chỉ. Vui lòng kiểm tra lại trước khi lưu.</p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
          <input
            className="h-11 w-full rounded-xl border border-[var(--line)] pl-9 pr-3 text-sm"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              void searchAddress();
            }}
            placeholder="Ví dụ: 1 Võ Văn Ngân, Thủ Đức"
            aria-label="Tìm địa chỉ trên bản đồ"
          />
        </div>
        <button type="button" className="button-soft !min-h-11 !px-3" disabled={loading} onClick={() => void searchAddress()}>{loading ? 'Đang tìm…' : 'Tìm'}</button>
      </div>
      {results.length ? (
        <div className="mt-2 grid max-h-44 gap-1 overflow-y-auto rounded-xl border border-[var(--line)] bg-white p-1.5">
          {results.map((place) => (
            <button key={place.place_id} type="button" className="flex gap-2 rounded-lg px-2.5 py-2 text-left text-xs leading-5 hover:bg-emerald-50" onClick={() => void choosePlace(place)}>
              <MapPin size={15} className="mt-0.5 shrink-0 text-[var(--accent)]" /> {place.display_name}
            </button>
          ))}
        </div>
      ) : null}
      <div ref={mapElementRef} className="mt-3 h-60 overflow-hidden rounded-xl border border-[var(--line)] bg-[#e9eee9]" aria-label="Bản đồ chọn địa chỉ" />
      {mapError ? <p className="mt-2 text-xs text-amber-700">{mapError}</p> : null}
      <p className="mt-2 text-[10px] leading-4 text-[var(--muted)]">Dữ liệu tìm kiếm và bản đồ © OpenStreetMap contributors. Không dùng để xác định vị trí khẩn cấp.</p>
    </section>
  );
}

async function reverseGeocode(latitude: number, longitude: number) {
  const parameters = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
  });
  return geocodingRequest<NominatimPlace>(`/api/geocoding/reverse?${parameters}`);
}

async function geocodingRequest<T>(url: string): Promise<T> {
  if (responseCache.has(url)) return responseCache.get(url) as T;
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Geocoding proxy returned ${response.status}`);
  const payload = await response.json() as T;
  responseCache.set(url, payload);
  return payload;
}

function setMarker(
  L: typeof import('leaflet'),
  map: LeafletMap,
  markerRef: { current: CircleMarker | null },
  latitude: number,
  longitude: number,
) {
  markerRef.current?.remove();
  markerRef.current = L.circleMarker([latitude, longitude], {
    radius: 9,
    color: '#ffffff',
    weight: 3,
    fillColor: '#14705c',
    fillOpacity: 1,
  }).addTo(map);
}
