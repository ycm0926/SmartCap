// src/components/map/GoogleMapView.jsx
import React, { useEffect } from 'react';
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';
import { getAlarmColor } from '../../utils/mapUtils';

const GoogleMapView = ({ 
  mapRef, 
  alarmHistory, 
  newAlarmId, 
  openAlarmDetails, 
  getAlarmTypeText, 
  getRecognizedTypeText 
}) => {
  // 구글맵 컨테이너 스타일
  const containerStyle = {
    width: '100%',
    height: '100%'
  };

  // 초기 중심 좌표 (서울 시청)
  const center = {
    lat: 37.5665, 
    lng: 126.9780
  };
  
  // 마커 아이콘 설정
  const getMarkerIcon = (alarmType, isNew = false) => {
    const color = getAlarmColor(alarmType, isNew);
    
    return {
      path: window.google?.maps?.SymbolPath?.CIRCLE || 0,
      fillColor: color,
      fillOpacity: 0.8,
      strokeColor: color,
      strokeWeight: 2,
      scale: isNew ? 12 : 8 // 새 알람이면 더 크게
    };
  };

  return (
    <div className="map-container">
      <LoadScript googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "AIzaSyCot_dk88YZ0AjmkLy9Oufrffz-84kPEr0"}>
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={center}
          zoom={13}
          onLoad={map => {
            console.log("Google Map loaded:", map);
            mapRef.current = map;
          }}
        >
          {alarmHistory.map(alarm => {
            const isNew = alarm.alarm_id === newAlarmId;
            
            return (
              <Marker
                key={alarm.alarm_id}
                position={{
                  lat: alarm.gps.coordinates[0],
                  lng: alarm.gps.coordinates[1]
                }}
                icon={getMarkerIcon(alarm.alarm_type, isNew)}
                onClick={() => openAlarmDetails(alarm)}
                animation={isNew && window.google?.maps?.Animation?.BOUNCE}
              />
            );
          })}
        </GoogleMap>
      </LoadScript>
    </div>
  );
};

export default GoogleMapView;