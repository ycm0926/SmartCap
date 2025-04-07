import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import '../styles/MapPage.css';
import { useAlarmStore } from '../store/alarmStore';
import axios from 'axios';

import AlarmSSE from '../components/AlarmSSE';
import MapHeader from '../components/map/MapHeader';
import GoogleMapView from '../components/map/GoogleMapView';
import IncidentsPanel from '../components/map/IncidentsPanel';
import AlarmDetailModal from '../components/map/AlarmDetailModal';
import { getAlarmTypeText, getRecognizedTypeText, getMarkerIcon, getAlarmColor } from '../utils/mapUtils';

const MapPage = () => {
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
  const alarmProcessedRef = useRef(new Set());

  // 알람의 최신 순 정렬 처리 메모이제이션
  const sortedAlarms = useMemo(() => {
    if (alarms.length === 0) return [];
    return [...alarms].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [alarms]);

  // 백엔드에서 지도 데이터를 가져오는 함수
  const fetchMapData = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // axios 요청 시 withCredentials 옵션 추가
      const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/api/events/map`, {
        params: {
          limit: 50  // 최근 50개 알람만 요청
        },
        withCredentials: true, // 중요: 쿠키 포함
        timeout: 10000  // 10초 타임아웃 설정
      });
      
      console.log('백엔드에서 받아온 지도 데이터:', response.data);
      
      // 데이터 유효성 검사
      if (!response.data) {
        console.error('유효하지 않은 응답 데이터:', response.data);
        setIsLoading(false);
        return;
      }
      
      // 모든 알람을 처리하기 전에 배열로 준비
      const allAlarms = [];
      
      // recentAlarms 처리
      if (response.data.recentAlarms && Array.isArray(response.data.recentAlarms)) {
        response.data.recentAlarms.forEach(alarm => {
          // 생성 날짜 변환 (ISO 문자열 형식 유지)
          if (typeof alarm.created_at === 'string') {
            const dateObj = new Date(alarm.created_at);
            if (!isNaN(dateObj.getTime())) {
              alarm.created_at = dateObj.toISOString();
            }
          } else if (alarm.created_at instanceof Date) {
            alarm.created_at = alarm.created_at.toISOString();
          }
          
          // 알람 ID가 없는 경우 생성
          if (!alarm.alarm_id) {
            const timestamp = new Date().getTime();
            const randomPart = Math.floor(Math.random() * 1000);
            alarm.alarm_id = timestamp * 1000 + randomPart;
          }
          
          allAlarms.push(alarm);
        });
      }
      
      // fallingAccidents 처리
      if (response.data.fallingAccidents && Array.isArray(response.data.fallingAccidents)) {
        response.data.fallingAccidents.forEach(accident => {
          // 생성 날짜 변환 (ISO 문자열 형식 유지)
          if (typeof accident.created_at === 'string') {
            const dateObj = new Date(accident.created_at);
            if (!isNaN(dateObj.getTime())) {
              accident.created_at = dateObj.toISOString();
            }
          } else if (accident.created_at instanceof Date) {
            accident.created_at = accident.created_at.toISOString();
          }
          
          // 알람 ID가 없는 경우 생성
          if (!accident.alarm_id) {
            const timestamp = new Date().getTime();
            const randomPart = Math.floor(Math.random() * 1000);
            accident.alarm_id = timestamp * 1000 + randomPart;
          }
          
          allAlarms.push(accident);
        });
      }
      
      // 알람 데이터 정렬
      allAlarms.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      console.log(`총 ${allAlarms.length}개의 알람 데이터로 상태 업데이트`);
      
      // 상태 업데이트
      requestAnimationFrame(() => {
        // 스토어의 상태를 완전히 새 데이터로 교체
        useAlarmStore.getState().setAlarms(allAlarms);
        setIsLoading(false);
      });
      
    } catch (error) {
      console.error('지도 데이터를 가져오는 중 오류 발생:', error);
      setIsLoading(false);
      
      // 오류 발생 시 로그인 페이지로 리다이렉트
      if (error.response && (error.response.status === 403 || error.response.status === 401)) {
        navigate('/login');
      }
    }
  }, [navigate]);

  // 초기 데이터 로드
  useEffect(() => {
    let isMounted = true;
    
    const loadMapData = async () => {
      await fetchMapData();
      if (isMounted) setIsLoading(false);
    };
    
    loadMapData();
    
    // 안전장치: 최대 3초 후에는 로딩 표시 중단
    const loadTimeout = setTimeout(() => {
      if (isMounted) setIsLoading(false);
    }, 3000);
    
    return () => {
      isMounted = false;
      clearTimeout(loadTimeout);
    };
  }, [fetchMapData]);

  // 알람이 새로 추가되면 알림 효과 활성화 - 최적화
  useEffect(() => {
    if (!sortedAlarms.length) return;

    // 최신 알람 (정렬한 배열의 첫 번째 항목)
    const latestAlarm = sortedAlarms[0];
    
    // 이미 처리한 알람인지 확인
    if (latestAlarm.alarm_id !== newAlarmId && !alarmProcessedRef.current.has(latestAlarm.alarm_id)) {
      // 처리된 알람으로 표시
      alarmProcessedRef.current.add(latestAlarm.alarm_id);
      
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
      
      // 10초 후 새 알람 표시 해제
      const timer = setTimeout(() => {
        setNewAlarmId(null);
      }, 10000);
      
      return () => clearTimeout(timer);
    }
  }, [sortedAlarms, newAlarmId]);

  // 사고 알림으로 인한 라우팅 처리
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      if (location.state?.fromAccident) {
        setIsAlertActive(true);
        playAlertSound();
        
        if (location.state?.alarmId) {
          setNewAlarmId(location.state.alarmId);
          
          const timer = setTimeout(() => {
            setNewAlarmId(null);
          }, 10000);
          
          return () => clearTimeout(timer);
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
        
        const timer = setTimeout(() => {
          setNewAlarmId(null);
        }, 10000);
        
        return () => clearTimeout(timer);
      }
    }
  }, [location]);

  // 알림 효과 이벤트 처리
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
  
  // 알림 소리 재생 - 메모이제이션
  const playAlertSound = useCallback(() => {
    if (!alertAudioRef.current) {
      alertAudioRef.current = new Audio('/alert-siren.mp3');
      alertAudioRef.current.volume = 0.7;
    }
    // catch를 통해 오류 처리
    alertAudioRef.current.play().catch(e => console.error('오디오 재생 실패:', e));
  }, []);
  
  // 알람 상세 정보 열기 - 메모이제이션
  const openAlarmDetails = useCallback(async (alarm) => {
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
  }, []);
  
  // 모달 닫기 - 메모이제이션
  const closeModal = useCallback(() => {
    setShowModal(false);
    setSelectedAlarm(null);
    setAccidentVideo(null);
  }, []);

  // 로그아웃 처리 - 메모이제이션
  const handleLogout = useCallback(() => {
    navigate('/login');
  }, [navigate]);

  return (
    <div className={`map-page ${isAlertActive ? 'alert-active' : ''}`}>
      {/* 알람 SSE 구독 */}
      <AlarmSSE />
      
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