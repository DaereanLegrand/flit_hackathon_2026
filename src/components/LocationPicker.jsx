import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { leafletLayer } from 'protomaps-leaflet'
import { supabase } from '../supabase'

export default function LocationPicker({ hash, onClose }) {
  const mapRef = useRef(null)
  const [center, setCenter] = useState(null)
  const [saving, setSaving] = useState(false)
  const markerRef = useRef(null)
  const mapInstanceRef = useRef(null)

  useEffect(() => {
    if (mapRef.current && !mapInstanceRef.current) {
      const map = L.map(mapRef.current, {
        center: [-16.3989, -71.5350],
        zoom: 15,
        zoomControl: true,
        attributionControl: false,
      })

      const layer = leafletLayer({
        url: 'https://tiles.qallariy.lat/20260603/{z}/{x}/{y}.mvt',
        flavor: 'dark',
        lang: 'es',
      })
      map.addLayer(layer)

      map.on('click', (e) => {
        const { lat, lng } = e.latlng
        setCenter({ lat, lng })
        if (markerRef.current) map.removeLayer(markerRef.current)
        markerRef.current = L.circleMarker([lat, lng], {
          radius: 10,
          color: '#ff2d78',
          fillColor: '#ff2d78',
          fillOpacity: 0.8,
          weight: 3,
        }).addTo(map)
      })

      mapInstanceRef.current = map
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  async function handleSave() {
    if (!center) return
    setSaving(true)
    try {
      const { error } = await supabase.functions.invoke('set-location', {
        method: 'POST',
        body: { hash, lat: center.lat, lng: center.lng },
      })
      if (error) throw error
      onClose({ lat: center.lat, lng: center.lng })
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="location-overlay">
      <div className="location-header">
        <span className="location-title">Elige la ubicacion</span>
        <button className="location-close" onClick={onClose}>✕</button>
      </div>
      <div ref={mapRef} className="location-map" />
      {center && (
        <div className="location-footer">
          <button className="location-save" onClick={handleSave} disabled={saving}>
            {saving ? 'guardando...' : 'Confirmar ubicacion'}
          </button>
        </div>
      )}
      {!center && (
        <div className="location-hint">Toca el mapa para colocar un pin</div>
      )}
    </div>
  )
}
