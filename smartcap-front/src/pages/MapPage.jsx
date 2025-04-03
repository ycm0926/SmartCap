// MapPage.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import '../styles/MapPage.css';
import { useAlarmStore } from '../store/alarmStore';
import axios from 'axios';

import AlarmSSE from '../components/AlarmSSE'; // 추가: SSE 컴포넌트 임포트
import MapHeader from '../components/map/MapHeader';
import GoogleMapView from '../components/map/GoogleMapView';
import IncidentsPanel from '../components/map/IncidentsPanel';
import AlarmDetailModal from '../components/map/AlarmDetailModal';
import { getAlarmTypeText, getRecognizedTypeText, getMarkerIcon, getAlarmColor } from '../utils/mapUtils';
import AccidentSSE from '../components/AccidentSSE';


const MapPage = () => {
  // 알람 스토어에서 알람 목록 가져오기
  const alarms = useAlarmStore((state) => state.alarms);
  const addAlarm = useAlarmStore((state) => state.addAlarm);
  
  const [selectedAlarm, setSelectedAlarm] = useState(null);
  const [accidentVideo, setAccidentVideo] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [isAlertActive, setIsAlertActive] = useState(false);
  const [newAlarmId, setNewAlarmId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const mapRef = useRef(null);
  const alertAudioRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const isInitialMount = useRef(true);

  // (선택 사항) 알람의 최신 순 정렬 처리: store가 새로운 배열을 반환하지 않는다면
  const sortedAlarms = useMemo(() => {
    return [...alarms].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [alarms]);

  // 백엔드에서 지도 데이터를 가져오는 함수
  const fetchMapData = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get('http://localhost:8080/api/events/map');
      
      console.log('백엔드에서 받아온 지도 데이터:', response.data);
      
      if (response.data.recentAlarms && Array.isArray(response.data.recentAlarms)) {
        response.data.recentAlarms.forEach(alarm => {
          if (typeof alarm.created_at === 'string') {
            alarm.created_at = new Date(alarm.created_at);
          }
          addAlarm(alarm);
        });
      }
      
      if (response.data.fallingAccidents && Array.isArray(response.data.fallingAccidents)) {
        response.data.fallingAccidents.forEach(accident => {
          if (typeof accident.created_at === 'string') {
            accident.created_at = new Date(accident.created_at);
          }
          addAlarm(accident);
        });
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('지도 데이터를 가져오는 중 오류 발생:', error);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMapData();
  }, []);

  // 알람이 새로 추가되면 알림 효과 활성화
  useEffect(() => {
    if (sortedAlarms.length > 0) {
      // 최신 알람 (정렬한 배열의 첫 번째 항목)
      const latestAlarm = sortedAlarms[0];
      
      if (latestAlarm.alarm_id !== newAlarmId) {
        setIsAlertActive(true);
        setNewAlarmId(latestAlarm.alarm_id);
        playAlertSound();
        
        if (mapRef.current && window.google) {
          try {
            const position = {
              lat: latestAlarm.gps.coordinates[1],
              lng: latestAlarm.gps.coordinates[0]
            };
            mapRef.current.panTo(position);
            mapRef.current.setZoom(16);
          } catch (error) {
            console.error('지도 이동 오류:', error);
          }
        }
        
        setTimeout(() => {
          setNewAlarmId(null);
        }, 10000);
      }
    }
  }, [sortedAlarms]);

  // 사고 알림으로 인한 라우팅 처리
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      if (location.state?.fromAccident) {
        setIsAlertActive(true);
        playAlertSound();
        
        if (location.state?.alarmId) {
          setNewAlarmId(location.state.alarmId);
          setTimeout(() => {
            setNewAlarmId(null);
          }, 10000);
        }
      }
      return;
    }
    
    const isNormalNavigation = !location.state || (location.state && !location.state.alert && !location.state.fromAccident);
    
    if (isNormalNavigation) {
      setIsAlertActive(false);
      return;
    }
    
    if (location.state?.alert || location.state?.fromAccident) {
      setIsAlertActive(true);
      playAlertSound();
      
      if (location.state?.alarmId) {
        setNewAlarmId(location.state.alarmId);
        setTimeout(() => {
          setNewAlarmId(null);
        }, 10000);
      }
    }
  }, [location]);

  useEffect(() => {
    if (!isAlertActive) return;

    const stopAlert = () => {
      setIsAlertActive(false);
      if (alertAudioRef.current) {
        alertAudioRef.current.pause();
        alertAudioRef.current.currentTime = 0;
      }
    };

    window.addEventListener('click', stopAlert);
    window.addEventListener('keydown', stopAlert);
    window.addEventListener('mousemove', stopAlert);

    return () => {
      window.removeEventListener('click', stopAlert);
      window.removeEventListener('keydown', stopAlert);
      window.removeEventListener('mousemove', stopAlert);
    };
  }, [isAlertActive]);
  
  const playAlertSound = () => {
    if (!alertAudioRef.current) {
      alertAudioRef.current = new Audio('/alert-siren.mp3');
      alertAudioRef.current.volume = 0.7;
    }
    alertAudioRef.current.play().catch(e => console.error('오디오 재생 실패:', e));
  };
  
  const openAlarmDetails = async (alarm) => {
    setSelectedAlarm(alarm);
    
    if (alarm.accident_id || 
        alarm.alarm_type === 'Accident' || 
        alarm.recognized_type === 'Falling') {
      
      if (alarm.video_url) {
        setAccidentVideo({
          accident_video_id: alarm.accident_video_id || (alarm.accident_id + 500),
          accident_id: alarm.accident_id,
          video_url: alarm.video_url
        });
      } else {
        setAccidentVideo({
          accident_video_id: (alarm.accident_id || 9000) + 500,
          accident_id: alarm.accident_id || 9000,
          video_url: "/sample-fall-video.mp4"
        });
      }
      console.log('사고 비디오 정보 설정됨:', alarm.accident_id);
    } else {
      setAccidentVideo(null);
      console.log('사고 비디오 없음 - 일반 알람', alarm.alarm_type, alarm.recognized_type);
    }
    
    setShowModal(true);
  };
  
  const closeModal = () => {
    setShowModal(false);
    setSelectedAlarm(null);
    setAccidentVideo(null);
  };

  const handleLogout = () => {
    navigate('/login');
  };

  return (
    <div className={`map-page ${isAlertActive ? 'alert-active' : ''}`}>
      {/* AlarmSSE 컴포넌트를 추가하여 실시간 알람 구독 */}
      {/* 알람 SSE 구독 */}
      <AlarmSSE />
      {/* 사고 SSE 구독 추가 */}
      <AccidentSSE />
      
      {isAlertActive && <div className="alert-overlay"></div>}
      
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <p>지도 데이터를 불러오는 중...</p>
        </div>
      )}
      
      <MapHeader handleLogout={handleLogout} />
      
      <GoogleMapView 
        mapRef={mapRef}
        alarmHistory={sortedAlarms}
        newAlarmId={newAlarmId}
        openAlarmDetails={openAlarmDetails}
        getAlarmTypeText={getAlarmTypeText}
        getRecognizedTypeText={getRecognizedTypeText}
      />
      
      <IncidentsPanel 
        alarmHistory={sortedAlarms}
        newAlarmId={newAlarmId}
        openAlarmDetails={openAlarmDetails}
        getAlarmTypeText={getAlarmTypeText}
        getRecognizedTypeText={getRecognizedTypeText}
      />
      
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
