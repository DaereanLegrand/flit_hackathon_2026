import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { leafletLayer } from 'protomaps-leaflet'

export default function MiniMap({ lat, lng, interactive = false }) {
  const mapRef = useRef(null)
  const instanceRef = useRef(null)

  useEffect(() => {
    if (mapRef.current && !instanceRef.current) {
      const map = L.map(mapRef.current, {
        center: [lat, lng],
        zoom: 15,
        zoomControl: interactive,
        attributionControl: false,
        dragging: interactive,
        scrollWheelZoom: interactive,
        doubleClickZoom: interactive,
        touchZoom: interactive,
        keyboard: interactive,
      })

      const layer = leafletLayer({
        url: 'https://tiles.qallariy.lat/20260603/{z}/{x}/{y}.mvt',
        flavor: 'dark',
        lang: 'es',
      })
      map.addLayer(layer)

      L.circleMarker([lat, lng], {
        radius: 10,
        color: '#ff2d78',
        fillColor: '#ff2d78',
        fillOpacity: 0.8,
        weight: 3,
      }).addTo(map)

      instanceRef.current = map
    }

    return () => {
      if (instanceRef.current) {
        instanceRef.current.remove()
        instanceRef.current = null
      }
    }
  }, [lat, lng, interactive])

  return <div ref={mapRef} className="mini-map" />
}
