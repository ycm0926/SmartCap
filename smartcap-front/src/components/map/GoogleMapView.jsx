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

  // 초기 중심 좌표 (역삼역)
  const center = {
    lat: 37.501263, 
    lng: 127.039615
  };
  
  // 맵 스타일 (다크 모드)
 // 맵 스타일 (다크 모드 + POI 제거)
  // 변경된 코드:
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
        featureType: "water",
        elementType: "geometry",
        stylers: [{ color: "#17263c" }]
      },
      // POI 제거 - 하나의 통합 규칙으로 처리
      {
        featureType: "poi",
        stylers: [{ visibility: "off" }]
      },
      // 대중교통 정보 제거
      {
        featureType: "transit",
        stylers: [{ visibility: "off" }]
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
            lat: newAlarm.gps.coordinates[1], // Note the order: [longitude, latitude]
            lng: newAlarm.gps.coordinates[0]
          });
          map.setZoom(20);
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
      
      // GPS 좌표 형식 확인 및 처리
      // Node.js 서버는 [longitude, latitude] 형식으로 보냄
      const position = {
        lat: alarm.gps.coordinates[1], // 위도
        lng: alarm.gps.coordinates[0]  // 경도
      };
      
      // Warning, Danger 알림은 원형으로 표시
      if (alarm.alarm_type === 'Warning' || alarm.alarm_type === 'Danger') {
        return (
          <OverlayView
            key={alarm.alarm_id}
            position={position}
            mapPaneName={OverlayView.OVERLAY_LAYER}
            getPixelPositionOffset={(width, height) => ({
              x: -width / 2,
              y: -height / 2
            })}
          >
            <div 
              className="alarm-circle" 
              onClick={() => handleMarkerClick(alarm)}  // 클릭 핸들러 추가
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                backgroundColor: alarm.alarm_type === 'Warning' 
                  ? 'rgba(255, 193, 7, 0.4)' // 노란색 Warning(1차 알림)
                  : 'rgba(255, 87, 34, 0.4)', // 다홍색 Danger(2차 알림)
                border: 'none', // 테두리 제거
                position: 'relative',
                cursor: 'pointer' // 클릭 가능함을 나타내는 커서
              }}
            >
              {isNew && (
                <div className="pulse-effect" style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  borderRadius: '50%',
                  animation: 'pulse 1.5s infinite',
                  backgroundColor: alarm.alarm_type === 'Warning' 
                    ? 'rgba(255, 193, 7, 0.2)' 
                    : 'rgba(255, 152, 0, 0.2)', // 보라색에서 주황색으로 변경
                }}></div>
              )}
            </div>
          </OverlayView>
        );
      }
    
      // 일반 마커는 인식 타입에 따라 색상 변경
      return (
        <React.Fragment key={alarm.alarm_id}>
          {/* 기본 마커 */}
          <Marker
            position={position}
            icon={getMarkerIcon(alarm.recognized_type, isNew)}
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
                  backgroundColor: `${getAlarmColor(alarm.recognized_type, true)}40`
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
          zoom={20}
          options={mapOptions}
          onLoad={handleMapLoad}
        >
          {map && renderCustomMarkers()}
          
          {/* 선택된 마커에 대한 커스텀 인포윈도우 */}
          {selectedMarker && (
            <CustomInfoWindow
              position={{
                lat: selectedMarker.gps.coordinates[1], // 위도
                lng: selectedMarker.gps.coordinates[0]  // 경도
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