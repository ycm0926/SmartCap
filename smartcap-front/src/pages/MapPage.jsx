// src/pages/MapPage.jsx (DB 구조에 맞게 수정됨)
import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import '../styles/MapPage.css';
import { useAlarmStore } from '../store/alarmStore';

import MapHeader from '../components/map/MapHeader';
import GoogleMapView from '../components/map/GoogleMapView';
import IncidentsPanel from '../components/map/IncidentsPanel';
import AlarmDetailModal from '../components/map/AlarmDetailModal';
import { getAlarmTypeText, getRecognizedTypeText, getMarkerIcon, getAlarmColor } from '../utils/mapUtils';

const MapPage = () => {
  // Use the shared alarm store instead of local state
  const alarms = useAlarmStore((state) => state.alarms);
  
  const [selectedAlarm, setSelectedAlarm] = useState(null);
  const [accidentVideo, setAccidentVideo] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [isAlertActive, setIsAlertActive] = useState(false);
  const [newAlarmId, setNewAlarmId] = useState(null);
  const mapRef = useRef(null);
  const alertAudioRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();

  // Monitor alarms for new entries
  useEffect(() => {
    if (alarms.length > 0) {
      // Get the most recent alarm (at index 0)
      const latestAlarm = alarms[0];
      
      // Check if this is a new alarm we haven't alerted for yet
      if (latestAlarm.alarm_id !== newAlarmId) {
        // New alarm detected - trigger alert
        setIsAlertActive(true);
        setNewAlarmId(latestAlarm.alarm_id);
        playAlertSound();
        
        // Move map to new alarm location
        if (mapRef.current && window.google) {
          try {
            const position = {
              lat: latestAlarm.gps.coordinates[1], // 위도
              lng: latestAlarm.gps.coordinates[0]  // 경도
            };
            
            mapRef.current.panTo(position);
            mapRef.current.setZoom(16);
          } catch (error) {
            console.error('지도 이동 오류:', error);
          }
        }
        
        // Clear new alarm highlight after 10 seconds
        setTimeout(() => {
          setNewAlarmId(null);
        }, 10000);
      }
    }
  }, [alarms]);

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
    
    // accident_id가 있거나, Falling 또는 Accident 타입인 경우 비디오 정보 설정
    if (alarm.accident_id || 
        alarm.alarm_type === 'Accident' || 
        alarm.recognized_type === 'Falling') {
      
      // 백엔드에서 받아올 사고 영상 정보를 시뮬레이션
      // 실제로는 accident_id로 Spring Boot에서 조회할 것
      setAccidentVideo({
        accident_video_id: (alarm.accident_id || 9000) + 500,
        accident_id: alarm.accident_id || 9000,
        video_url: "/sample-fall-video.mp4"
      });
      
      console.log('사고 비디오 정보 설정됨:', alarm.accident_id);
    } else {
      setAccidentVideo(null);
      console.log('사고 비디오 없음 - 일반 알람', alarm.alarm_type, alarm.recognized_type);
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
      
      {/* 지도 컴포넌트 */}
      <GoogleMapView 
        mapRef={mapRef}
        alarmHistory={alarms}
        newAlarmId={newAlarmId}
        openAlarmDetails={openAlarmDetails}
        getAlarmTypeText={getAlarmTypeText}
        getRecognizedTypeText={getRecognizedTypeText}
      />
      
      {/* 알람 목록 패널 */}
      <IncidentsPanel 
        alarmHistory={alarms}
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