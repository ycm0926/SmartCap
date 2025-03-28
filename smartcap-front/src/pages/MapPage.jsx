// src/pages/MapPage.jsx (리팩토링)
import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import '../styles/MapPage.css';

import MapHeader from '../components/map/MapHeader';
import GoogleMapView from '../components/map/GoogleMapView';
import IncidentsPanel from '../components/map/IncidentsPanel';
import AlarmDetailModal from '../components/map/AlarmDetailModal';
// 수정: Google Maps 관련 import
import { getAlarmTypeText, getRecognizedTypeText, getMarkerIcon, getAlarmColor } from '../utils/mapUtils';



const MapPage = () => {
  const [alarmHistory, setAlarmHistory] = useState([]);
  const [selectedAlarm, setSelectedAlarm] = useState(null);
  const [accidentVideo, setAccidentVideo] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [isAlertActive, setIsAlertActive] = useState(false);
  const [newAlarmId, setNewAlarmId] = useState(null);
  const mapRef = useRef(null);
  const eventSourceRef = useRef(null);
  const alertAudioRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();

  // location state에서 알림 상태 확인
  useEffect(() => {
    if (location.state?.alert) {
      setIsAlertActive(true);
      playAlertSound();
      
      // 새 알람 ID 설정 (애니메이션용)
      if (location.state?.alarmId) {
        setNewAlarmId(location.state.alarmId);
        
        // 10초 후에 새 알람 표시 제거
        setTimeout(() => {
          setNewAlarmId(null);
        }, 10000);
      }
    }
  }, [location]);

  // 사용자 상호작용 감지 및 알림 효과 중지
  useEffect(() => {
    if (!isAlertActive) return;

    const stopAlert = () => {
      setIsAlertActive(false);
      if (alertAudioRef.current) {
        alertAudioRef.current.pause();
        alertAudioRef.current.currentTime = 0;
      }
    };

    // 클릭이나 키보드 입력 감지
    window.addEventListener('click', stopAlert);
    window.addEventListener('keydown', stopAlert);
    window.addEventListener('mousemove', stopAlert);

    return () => {
      window.removeEventListener('click', stopAlert);
      window.removeEventListener('keydown', stopAlert);
      window.removeEventListener('mousemove', stopAlert);
    };
  }, [isAlertActive]);

  // 알람 이력 로드
  useEffect(() => {
    // 샘플 데이터 로드 (실제 구현에서는 API 호출로 대체)
    const sampleAlarms = [
      { 
        alarm_id: 1, 
        construction_sites_id: 1, 
        weather_id: 1, 
        gps: { coordinates: [37.5665, 126.9780] }, // 서울시청
        alarm_type: "FALL", 
        recognized_type: "WORKER",
        created_at: new Date().toISOString()
      },
      { 
        alarm_id: 2, 
        construction_sites_id: 1, 
        weather_id: 1, 
        gps: { coordinates: [37.5632, 126.9900] }, // 용산
        alarm_type: "DANGER_ZONE", 
        recognized_type: "VEHICLE",
        created_at: new Date(Date.now() - 3600000).toISOString() // 1시간 전
      },
      { 
        alarm_id: 3, 
        construction_sites_id: 1, 
        weather_id: 2, 
        gps: { coordinates: [37.5795, 126.9770] }, // 광화문
        alarm_type: "EQUIPMENT", 
        recognized_type: "CRANE",
        created_at: new Date(Date.now() - 7200000).toISOString() // 2시간 전
      }
    ];
    
    setAlarmHistory(sampleAlarms);
  }, []);

  // SSE 연결 설정
  useEffect(() => {
    // 실제 SSE 연결 대신 데모 데이터 사용
    const demoAlarmEvent = () => {
      // 60초마다 새로운 알람 생성
      const intervalId = setInterval(() => {
        const newAlarm = { 
          alarm_id: Date.now(), 
          construction_sites_id: 1, 
          weather_id: 1, 
          gps: { 
            coordinates: [
              37.5665 + (Math.random() - 0.5) * 0.01, 
              126.9780 + (Math.random() - 0.5) * 0.01
            ] 
          }, 
          alarm_type: ["FALL", "DANGER_ZONE", "EQUIPMENT"][Math.floor(Math.random() * 3)], 
          recognized_type: ["WORKER", "VEHICLE", "EQUIPMENT"][Math.floor(Math.random() * 3)],
          created_at: new Date().toISOString()
        };
        
        console.log('새로운 알람 감지:', newAlarm);
        
        // 알람 목록 업데이트
        setAlarmHistory(prev => [newAlarm, ...prev]);
        
        // SSE 이벤트 처리 함수 내 지도 이동 부분 수정

        // 지도 뷰 이동 - 구글맵 방식으로 수정
        if (mapRef.current && window.google) {
          try {
            // 1. 좌표 객체 생성
            const position = {
              lat: newAlarm.gps.coordinates[0],
              lng: newAlarm.gps.coordinates[1]
            };
            
            // 2. 지도 이동 (부드럽게)
            mapRef.current.panTo(position);
            
            // 3. 확대 레벨 설정
            mapRef.current.setZoom(16);
            
            console.log('지도 이동 성공:', position);
          } catch (error) {
            console.error('지도 이동 중 오류:', error);
            
            // 대체 방법 시도
            try {
              mapRef.current.setCenter({
                lat: newAlarm.gps.coordinates[0],
                lng: newAlarm.gps.coordinates[1]
              });
            } catch (fallbackError) {
              console.error('대체 지도 이동 방법도 실패:', fallbackError);
            }
          }
        } else {
          console.warn('지도 객체가 준비되지 않았거나 Google Maps API가 로드되지 않았습니다.');
        }
        
        // 알림 활성화
        setIsAlertActive(true);
        setNewAlarmId(newAlarm.alarm_id);
        playAlertSound();
        
        // 10초 후에 새 알람 표시 제거
        setTimeout(() => {
          setNewAlarmId(null);
        }, 10000);
      }, 60000); // 60초마다 반복 (데모용)
      
      return () => clearInterval(intervalId);
    };
    
    const cleanup = demoAlarmEvent();
    
    // 컴포넌트 언마운트 시 SSE 연결 종료
    return () => {
      cleanup();
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);
  
  // 알림 소리 재생 함수
  const playAlertSound = () => {
    if (!alertAudioRef.current) {
      alertAudioRef.current = new Audio('/alert-siren.mp3');
      alertAudioRef.current.volume = 0.7;
    }
    
    alertAudioRef.current.play().catch(e => console.error('오디오 재생 실패:', e));
  };
  
  // 알람 상세 정보 조회 및 모달 열기
  const openAlarmDetails = async (alarm) => {
    setSelectedAlarm(alarm);
    
    // 관련 사고 비디오 조회 (낙상인 경우)
    if (alarm.alarm_type === 'FALL') {
      // 샘플 데이터
      setAccidentVideo({
        accident_id: 101,
        work_sites_id: alarm.construction_sites_id,
        video_url: "/sample-fall-video.mp4",
        accident_type: "FALL",
        gps: alarm.gps,
        created_at: alarm.created_at
      });
    } else {
      setAccidentVideo(null);
    }
    
    setShowModal(true);
  };
  
  // 모달 닫기
  const closeModal = () => {
    setShowModal(false);
    setSelectedAlarm(null);
    setAccidentVideo(null);
  };

  const handleLogout = () => {
    // logout 함수 호출 (구현 필요)
    // logout();
    navigate('/login');
  };

  return (
    <div className={`map-page ${isAlertActive ? 'alert-active' : ''}`}>
      {/* 알림 효과 오버레이 */}
      {isAlertActive && <div className="alert-overlay"></div>}
      
      {/* 헤더 */}
      <MapHeader handleLogout={handleLogout} />
      
      {/* 지도 컴포넌트 - Leaflet에서 Google Maps로 변경 */}
      <GoogleMapView 
        mapRef={mapRef}
        alarmHistory={alarmHistory}
        newAlarmId={newAlarmId}
        openAlarmDetails={openAlarmDetails}
        getAlarmTypeText={getAlarmTypeText}
        getRecognizedTypeText={getRecognizedTypeText}
      />
      
      {/* 알람 목록 패널 */}
      <IncidentsPanel 
        alarmHistory={alarmHistory}
        newAlarmId={newAlarmId}
        openAlarmDetails={openAlarmDetails}
        getAlarmTypeText={getAlarmTypeText}
        getRecognizedTypeText={getRecognizedTypeText}
      />
      
      {/* 알람 상세 모달 */}
      <AlarmDetailModal 
        showModal={showModal}
        selectedAlarm={selectedAlarm}
        accidentVideo={accidentVideo}
        closeModal={closeModal}
        getAlarmTypeText={getAlarmTypeText}
        getRecognizedTypeText={getRecognizedTypeText}
      />
    </div>
  );
};

export default MapPage;