// src/components/map/GoogleMapView.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  const [currentZoom, setCurrentZoom] = useState(20);
  
  // 관리자 마커를 위한 상태 추가
  const [selectedAdminMarker, setSelectedAdminMarker] = useState(null);
  
  // 초기 중심 좌표 (역삼역)
  const initialCenter = {
    lat: 37.501263, 
    lng: 127.039615
  };
  
  // 관리자 위치 하드코딩
  const adminLocation = {
    lat: 37.501263,
    lng: 127.039615
  };
  
  // 맵 위치와 줌 레벨 상태 관리 추가
  const [mapCenter, setMapCenter] = useState(initialCenter);
  const [mapZoom, setMapZoom] = useState(20);

  // 구글맵 컨테이너 스타일
  const containerStyle = {
    width: '100%',
    height: '100%'
  };
  
  // 줌 레벨에 따른 원형 마커 크기 계산 함수
  const calculateCircleSize = useCallback((zoom) => {
    // 기준 줌 레벨과 크기 설정
    const baseZoom = 12; // 더 낮은 줌 레벨을 기준으로 설정
    const baseSize = 20; // 기본 크기를 작게 설정
    
    // 줌 레벨에 따른 크기 조정 (줌 레벨이 커질수록 원도 커짐)
    // 2^(zoom - baseZoom)은 지도가 확대될 때 마커도 같이 확대되는 비율
    const scaleFactor = Math.pow(2, (zoom - baseZoom) * 0.3); // 0.3은 확대 비율을 조절하는 계수
    
    // 기본 사이즈에 스케일 팩터를 곱하여 조정된 크기 반환
    return baseSize * scaleFactor;
  }, []);
  
  // 맵 스타일 (다크 모드) - 최적화
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
  
  // 데이터 유효성 검사 헬퍼 함수
  const isValidAlarm = (alarm) => {
    return (
      alarm && 
      typeof alarm === 'object' && 
      alarm.gps && 
      alarm.gps.coordinates && 
      Array.isArray(alarm.gps.coordinates) && 
      alarm.gps.coordinates.length >= 2
    );
  };
  
  // 안전한 좌표 가져오기
  const getAlarmPosition = (alarm) => {
    if (!isValidAlarm(alarm)) {
      console.warn('유효하지 않은 알람 좌표:', alarm);
      return initialCenter; // 기본 위치로 폴백
    }
    
    try {
      return {
        lat: alarm.gps.coordinates[1], // 위도
        lng: alarm.gps.coordinates[0]  // 경도
      };
    } catch (error) {
      console.error('좌표 처리 오류:', error);
      return initialCenter; // 기본 위치로 폴백
    }
  };
  
  // 마커 아이콘 설정 (SVG 기반) - 오류 처리 추가
  const getMarkerIcon = (alarmType, isNew = false) => {
    try {
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
    } catch (error) {
      console.error('마커 아이콘 생성 오류:', error);
      // 기본 아이콘으로 폴백
      return {
        path: window.google.maps.SymbolPath.CIRCLE,
        fillColor: '#ff0000',
        fillOpacity: 1,
        scale: 8,
        strokeWeight: 2,
        strokeColor: '#ffffff'
      };
    }
  };

  // 관리자 마커 아이콘 설정 (파란색)
  const getAdminMarkerIcon = () => {
    try {
      // 파란색 마커 SVG
      const svgMarker = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" width="30" height="42">
          <path fill="#0084ff" d="M172.268 501.67C26.97 291.031 0 269.413 0 192 0 85.961 85.961 0 192 0s192 85.961 192 192c0 77.413-26.97 99.031-172.268 309.67-9.535 13.774-29.93 13.773-39.464 0zM192 272c44.183 0 80-35.817 80-80s-35.817-80-80-80-80 35.817-80 80 35.817 80 80 80z"/>
        </svg>
      `;
      
      return {
        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgMarker)}`,
        scaledSize: new window.google.maps.Size(30, 42),
        anchor: new window.google.maps.Point(15, 42),
        labelOrigin: new window.google.maps.Point(15, 15)
      };
    } catch (error) {
      console.error('관리자 마커 아이콘 생성 오류:', error);
      // 기본 파란색 아이콘으로 폴백
      return {
        path: window.google.maps.SymbolPath.CIRCLE,
        fillColor: '#0084ff',
        fillOpacity: 1,
        scale: 8,
        strokeWeight: 2,
        strokeColor: '#ffffff'
      };
    }
  };

  // 새 알람 생성 시 지도 이동 처리 - 안전하게 처리하고 상태 업데이트
  useEffect(() => {
    if (newAlarmId && map) {
      const newAlarm = alarmHistory.find(alarm => alarm && alarm.alarm_id === newAlarmId);
      if (newAlarm && isValidAlarm(newAlarm)) {
        try {
          const position = getAlarmPosition(newAlarm);
          map.panTo(position);
          map.setZoom(20);
          
          // 맵 상태 업데이트
          setMapCenter(position);
          setMapZoom(20);
        } catch (error) {
          console.error('새 알람으로 이동 중 오류:', error);
        }
      }
    }
  }, [newAlarmId, alarmHistory, map]);

  // 맵 로드 핸들러 - 이벤트 리스너 추가
  const handleMapLoad = (mapInstance) => {
    console.log("Google Map loaded:", mapInstance);
    if (mapRef && typeof mapRef === 'object') {
      mapRef.current = mapInstance;
    }
    setMap(mapInstance);
    setCurrentZoom(mapInstance.getZoom() || 20);
    
    // 맵 이동 이벤트 리스너 추가
    mapInstance.addListener('dragend', () => {
      const newCenter = mapInstance.getCenter();
      if (newCenter) {
        setMapCenter(newCenter.toJSON());
      }
    });
    
    // 줌 변경 이벤트 리스너 추가
    mapInstance.addListener('zoom_changed', () => {
      const newZoom = mapInstance.getZoom();
      if (newZoom) {
        setMapZoom(newZoom);
        setCurrentZoom(newZoom);
      }
    });
  };

  // 마커 클릭 핸들러
  const handleMarkerClick = (alarm) => {
    setSelectedMarker(alarm);
    setSelectedAdminMarker(null); // 관리자 마커 선택 해제
    
    // 현재 맵 위치와 줌 상태 저장 (유지하기 위해)
    if (map) {
      const currentCenter = map.getCenter();
      const currentZoom = map.getZoom();
      
      if (currentCenter) {
        setMapCenter(currentCenter.toJSON());
      }
      
      if (currentZoom) {
        setMapZoom(currentZoom);
      }
    }
  };

  // 관리자 마커 클릭 핸들러
  const handleAdminMarkerClick = () => {
    setSelectedAdminMarker(adminLocation);
    setSelectedMarker(null); // 알람 마커 선택 해제
    
    // 현재 맵 위치와 줌 상태 저장
    if (map) {
      const currentCenter = map.getCenter();
      const currentZoom = map.getZoom();
      
      if (currentCenter) {
        setMapCenter(currentCenter.toJSON());
      }
      
      if (currentZoom) {
        setMapZoom(currentZoom);
      }
    }
  };

  // 인포윈도우 닫기 핸들러
  const handleInfoWindowClose = () => {
    setSelectedMarker(null);
    setSelectedAdminMarker(null);
    
    // 현재 맵 위치와 줌 상태 저장 (유지하기 위해)
    if (map) {
      const currentCenter = map.getCenter();
      const currentZoom = map.getZoom();
      
      if (currentCenter) {
        setMapCenter(currentCenter.toJSON());
      }
      
      if (currentZoom) {
        setMapZoom(currentZoom);
      }
    }
  };

  // 상세 정보 보기 핸들러
  const handleDetailClick = (alarm) => {
    setSelectedMarker(null);
    
    // 현재 맵 위치와 줌 상태 저장 (유지하기 위해)
    if (map) {
      const currentCenter = map.getCenter();
      const currentZoom = map.getZoom();
      
      if (currentCenter) {
        setMapCenter(currentCenter.toJSON());
      }
      
      if (currentZoom) {
        setMapZoom(currentZoom);
      }
    }
    
    if (openAlarmDetails && typeof openAlarmDetails === 'function') {
      openAlarmDetails(alarm);
    }
  };

  // 알람 타입 숫자 변환 헬퍼 함수 추가
  const normalizeAlarmType = (typeValue) => {
    if (typeValue === undefined || typeValue === null) return "Warning";
    
    const typeStr = String(typeValue).trim();
    if (typeStr === "1" || typeStr === "1차") return "Warning";
    if (typeStr === "2" || typeStr === "2차") return "Danger";
    if (typeStr === "3" || typeStr === "3차") return "Accident";
    
    return typeValue; // 이미 문자열 타입이면 그대로 반환
  };

  // 마커 렌더링 로직 (customMarkers useMemo 내부)
  const customMarkers = useMemo(() => {
    if (!alarmHistory || !Array.isArray(alarmHistory) || !window.google) {
      return [];
    }
    
    // 현재 줌 레벨에 따른 원형 마커 크기 계산
    const circleSize = calculateCircleSize(currentZoom);
    
    return alarmHistory
      .filter(alarm => isValidAlarm(alarm))
      .map((alarm, index) => {
        const isNew = alarm.alarm_id === newAlarmId;
        const position = getAlarmPosition(alarm);
        const uniqueKey = `alarm-${alarm.alarm_id || Date.now()}-${index}`;
        
        // 알람 타입 정규화
        const normalizedAlarmType = normalizeAlarmType(alarm.alarm_type);
        
        // Warning, Danger 알림은 원형으로 표시
        if (normalizedAlarmType === 'Warning' || normalizedAlarmType === 'Danger') {
          return (
            <OverlayView
              key={uniqueKey}
              position={position}
              mapPaneName={OverlayView.OVERLAY_LAYER}
              getPixelPositionOffset={(width, height) => ({
                x: -circleSize / 2, // 원 너비의 절반
                y: -circleSize / 2  // 원 높이의 절반
              })}
            >
              <div 
                className="alarm-circle" 
                onClick={() => handleMarkerClick(alarm)}  
                style={{
                  width: `${circleSize}px`,
                  height: `${circleSize}px`,
                  borderRadius: '50%',
                  backgroundColor: normalizedAlarmType === 'Warning' 
                    ? 'rgba(255, 193, 7, 0.4)' 
                    : 'rgba(255, 87, 34, 0.4)', 
                  border: 'none',
                  position: 'relative',
                  cursor: 'pointer'
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
                    backgroundColor: normalizedAlarmType === 'Warning' 
                      ? 'rgba(255, 193, 7, 0.2)' 
                      : 'rgba(255, 152, 0, 0.2)',
                  }}></div>
                )}
              </div>
            </OverlayView>
          );
        } else {
          // 그 외 타입 (Accident, Falling 등)은 마커로 표시
          return (
            <React.Fragment key={uniqueKey}>
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
                    x: -50, // 펄스 원의 너비(100px)의 절반
                    y: -50  // 펄스 원의 높이(100px)의 절반
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
        }
      });
  }, [alarmHistory, newAlarmId, window.google, currentZoom, calculateCircleSize]);
  
  // 선택된 마커에 대한 인포윈도우 처리 - selectedMarker 유효성 확인
  const renderInfoWindow = () => {
    if (!selectedMarker || !isValidAlarm(selectedMarker)) {
      return null;
    }
    
    try {
      return (
        <CustomInfoWindow
          position={getAlarmPosition(selectedMarker)}
          alarm={selectedMarker}
          onClose={handleInfoWindowClose}
          onDetailClick={handleDetailClick}
          getAlarmTypeText={getAlarmTypeText || (type => type)}
          getRecognizedTypeText={getRecognizedTypeText || (type => type)}
        />
      );
    } catch (error) {
      console.error('인포윈도우 렌더링 오류:', error);
      return null;
    }
  };

  // 관리자 마커의 인포윈도우 렌더링
  const renderAdminInfoWindow = () => {
    if (!selectedAdminMarker) return null;
    
    return (
      <OverlayView
        position={adminLocation}
        mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
        getPixelPositionOffset={(width, height) => ({
          x: -width / 2,
          y: -height - 40 // 마커 위에 위치하도록 조정
        })}
      >
        <div className="custom-overlay-window admin-info-window">
          <button className="close-btn" onClick={handleInfoWindowClose}>&times;</button>
          <h3>관리자 위치</h3>
          <p><strong>좌표:</strong> {adminLocation.lat.toFixed(6)}, {adminLocation.lng.toFixed(6)}</p>

          <style jsx>{`
            .custom-overlay-window {
              background-color: #242f3e;
              color: white;
              border-radius: 4px;
              padding: 10px;
              box-shadow: 0 2px 7px rgba(0, 0, 0, 0.5);
              position: relative;
              min-width: 220px;
              max-width: 300px;
            }
            
            .admin-info-window {
              border-left: 3px solid #0084ff;
            }
            
            .close-btn {
              position: absolute;
              top: 5px;
              right: 5px;
              background: none;
              border: none;
              color: white;
              font-size: 16px;
              cursor: pointer;
            }
            
            h3 {
              margin-top: 0;
              margin-bottom: 8px;
              color: #0084ff;
            }
            
            p {
              margin: 5px 0;
            }
          `}</style>
        </div>
      </OverlayView>
    );
  };

  return (
    <div className="map-container">
      {isLoaded ? (
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={mapCenter}
          zoom={mapZoom}
          options={mapOptions}
          onLoad={handleMapLoad}
        >
          {/* 관리자 위치 마커 */}
          <Marker
            position={adminLocation}
            icon={getAdminMarkerIcon()}
            onClick={handleAdminMarkerClick}
            zIndex={1000}
          />
          
          {map && customMarkers}
          
          {/* 선택된 마커에 대한 커스텀 인포윈도우 */}
          {selectedMarker && renderInfoWindow()}
          
          {/* 관리자 마커 인포윈도우 */}
          {selectedAdminMarker && renderAdminInfoWindow()}
        </GoogleMap>
      ) : (
        <div className="map-loading">지도 로딩 중...</div>
      )}
    </div>
  );
};

export default GoogleMapView;