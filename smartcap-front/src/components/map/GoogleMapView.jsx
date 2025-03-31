// src/components/map/GoogleMapView.jsx
import React, { useState, useEffect } from 'react';
import { GoogleMap, Marker, OverlayView } from '@react-google-maps/api';
import { getAlarmColor } from '../../utils/mapUtils';
import CustomInfoWindow from './CustomInfoWindow';

const GoogleMapView = ({ 
  mapRef, 
  alarmHistory, 
  newAlarmId, 
  openAlarmDetails, 
  getAlarmTypeText, 
  getRecognizedTypeText 
}) => {
  // 구글맵 로드 확인
  const isLoaded = window.google && window.google.maps;
  const [map, setMap] = useState(null);
  const [selectedMarker, setSelectedMarker] = useState(null);

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
  
  // 맵 스타일 (다크 모드)
  const mapOptions = {
    disableDefaultUI: false,
    zoomControl: true,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    styles: [
      {
        elementType: "geometry",
        stylers: [{ color: "#242f3e" }]
      },
      {
        elementType: "labels.text.stroke",
        stylers: [{ color: "#242f3e" }]
      },
      {
        elementType: "labels.text.fill",
        stylers: [{ color: "#746855" }]
      },
      {
        featureType: "administrative.locality",
        elementType: "labels.text.fill",
        stylers: [{ color: "#d59563" }]
      },
      {
        featureType: "road",
        elementType: "geometry",
        stylers: [{ color: "#38414e" }]
      },
      {
        featureType: "road",
        elementType: "geometry.stroke",
        stylers: [{ color: "#212a37" }]
      },
      {
        featureType: "road",
        elementType: "labels.text.fill",
        stylers: [{ color: "#9ca5b3" }]
      },
      {
        featureType: "water",
        elementType: "geometry",
        stylers: [{ color: "#17263c" }]
      }
    ]
  };
  
  // 마커 아이콘 설정 (SVG 기반)
  const getMarkerIcon = (alarmType, isNew = false) => {
    const color = getAlarmColor(alarmType, isNew);
    
    // 드롭 핀 모양의 SVG 아이콘
    const svgMarker = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" width="30" height="42">
        <path fill="${color}" d="M172.268 501.67C26.97 291.031 0 269.413 0 192 0 85.961 85.961 0 192 0s192 85.961 192 192c0 77.413-26.97 99.031-172.268 309.67-9.535 13.774-29.93 13.773-39.464 0zM192 272c44.183 0 80-35.817 80-80s-35.817-80-80-80-80 35.817-80 80 35.817 80 80 80z"/>
      </svg>
    `;
    
    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgMarker)}`,
      scaledSize: new window.google.maps.Size(30, 42),
      anchor: new window.google.maps.Point(15, 42), // 핀 하단 중앙이 좌표에 위치하도록
      labelOrigin: new window.google.maps.Point(15, 15) // 라벨 위치
    };
  };

  // 새 알람 생성 시 지도 이동 처리
  useEffect(() => {
    if (newAlarmId && map) {
      const newAlarm = alarmHistory.find(alarm => alarm.alarm_id === newAlarmId);
      if (newAlarm) {
        map.panTo({
          lat: newAlarm.gps.coordinates[0], 
          lng: newAlarm.gps.coordinates[1]
        });
        map.setZoom(16);
      }
    }
  }, [newAlarmId, alarmHistory, map]);

  // 맵 로드 핸들러
  const handleMapLoad = (mapInstance) => {
    console.log("Google Map loaded:", mapInstance);
    mapRef.current = mapInstance;
    setMap(mapInstance);
  };

  // 마커 클릭 핸들러
  const handleMarkerClick = (alarm) => {
    setSelectedMarker(alarm);
  };

  // 인포윈도우 닫기 핸들러
  const handleInfoWindowClose = () => {
    setSelectedMarker(null);
  };

  // 상세 정보 보기 핸들러
  const handleDetailClick = (alarm) => {
    setSelectedMarker(null);
    openAlarmDetails(alarm);
  };

  // 사용자 정의 마커 렌더링
  const renderCustomMarkers = () => {
    return alarmHistory.map(alarm => {
      const isNew = alarm.alarm_id === newAlarmId;
      const position = {
        lat: alarm.gps.coordinates[0],
        lng: alarm.gps.coordinates[1]
      };
      
      return (
        <React.Fragment key={alarm.alarm_id}>
          {/* 기본 마커 */}
          <Marker
            position={position}
            icon={getMarkerIcon(alarm.alarm_type, isNew)}
            onClick={() => handleMarkerClick(alarm)}
            animation={isNew ? window.google.maps.Animation.BOUNCE : null}
            zIndex={isNew ? 1000 : 1}
          />
          
          {/* 새 알람인 경우 펄스 효과 오버레이 추가 */}
          {isNew && (
            <OverlayView
              position={position}
              mapPaneName={OverlayView.OVERLAY_LAYER}
              getPixelPositionOffset={(width, height) => ({
                x: -width / 2,
                y: -height / 2
              })}
            >
              <div className="map-pulse-effect">
                <div className="pulse-circle" style={{
                  backgroundColor: `${getAlarmColor(alarm.alarm_type, true)}40`
                }}></div>
              </div>
            </OverlayView>
          )}
        </React.Fragment>
      );
    });
  };

  return (
    <div className="map-container">
      {isLoaded ? (
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={center}
          zoom={13}
          options={mapOptions}
          onLoad={handleMapLoad}
        >
          {map && renderCustomMarkers()}
          
          {/* 선택된 마커에 대한 커스텀 인포윈도우 */}
          {selectedMarker && (
            <CustomInfoWindow
              position={{
                lat: selectedMarker.gps.coordinates[0],
                lng: selectedMarker.gps.coordinates[1]
              }}
              alarm={selectedMarker}
              onClose={handleInfoWindowClose}
              onDetailClick={handleDetailClick}
              getAlarmTypeText={getAlarmTypeText}
              getRecognizedTypeText={getRecognizedTypeText}
            />
          )}
        </GoogleMap>
      ) : (
        <div className="map-loading">지도 로딩 중...</div>
      )}
    </div>
  );
};

export default GoogleMapView;