// src/components/map/AlarmDetailModal.jsx
import React, {useEffect, useState} from 'react';
import { HardHat, MapPin, Calendar, Cloud, Info, Building, Sun, CloudRain, CloudSnow, CloudFog, CloudLightning, CloudHail, Wind } from 'lucide-react';
import axios from 'axios'; 

const AlarmDetailModal = ({ showModal, selectedAlarm, closeModal, getAlarmTypeText, getRecognizedTypeText }) => {
  const [accidentVideo, setAccidentVideo] = useState(null);
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);

  // 비디오 데이터 요청 로직을 여기로 이동
  useEffect(() => {
    if (!showModal || !selectedAlarm) return;
    
    const fetchVideoData = async () => {
      if (selectedAlarm.accident_id || 
          selectedAlarm.alarm_type === 'Accident' || 
          selectedAlarm.recognized_type === 'Falling') {
        
        setIsLoadingVideo(true);
        
        try {
          // 영상 정보를 별도 API 요청으로 가져오기
          const videoResponse = await axios.get(
            `${import.meta.env.VITE_API_BASE_URL}/api/events/video/${selectedAlarm.alarm_id || selectedAlarm.accident_id}`,
            { withCredentials: true }
          );
          
          if (videoResponse.data && videoResponse.data.video_url) {
            setAccidentVideo({
              accident_video_id: videoResponse.data.accident_video_id || (selectedAlarm.accident_id + 500),
              accident_id: selectedAlarm.accident_id,
              video_url: videoResponse.data.video_url
            });
          } else {
            // 영상이 없는 경우 샘플 영상 사용
            setAccidentVideo({
              accident_video_id: (selectedAlarm.accident_id || 9000) + 500,
              accident_id: selectedAlarm.accident_id || 9000,
              video_url: "https://smartcap102.s3.ap-northeast-2.amazonaws.com/accident_video/device_23_1744609514210.mp4"
            });
          }
          
        } catch (error) {
          console.error('영상 데이터를 가져오는 중 오류 발생:', error);
          // 오류 발생 시 샘플 영상으로 대체
          setAccidentVideo({
            accident_video_id: (selectedAlarm.accident_id || 9000) + 500,
            accident_id: selectedAlarm.accident_id || 9000,
            video_url: "https://smartcap102.s3.ap-northeast-2.amazonaws.com/accident_video/device_23_1744609514210.mp4"
          });
        } finally {
          setIsLoadingVideo(false);
        }
      } else {
        setAccidentVideo(null);
      }
    };
    
    fetchVideoData();
    
    // 모달이 닫힐 때 비디오 데이터 초기화
    return () => {
      setAccidentVideo(null);
    };
  }, [showModal, selectedAlarm]);

  // 모달이 열리지 않거나 선택된 알람이 없으면 렌더링하지 않음
  if (!showModal || !selectedAlarm) return null;

  // 문자열 변환을 위한 헬퍼 함수
  const safeString = (value) => {
    if (value === undefined || value === null) return "";
    return String(value);
  };

  // 날씨에 따른 아이콘 렌더링 함수 - 오류 처리 추가
  const getWeatherIcon = (weather) => {
    if (!weather) return <Cloud size={20} color="#CCCCCC" />;
    
    try {
      switch(weather) {
        case '맑음': return <Sun size={20} color="#FFD700" />;
        case '흐림': return <Cloud size={20} color="#CCCCCC" />;
        case '비': return <CloudRain size={20} color="#0099FF" />;
        case '눈': return <CloudSnow size={20} color="#FFFFFF" />;
        case '안개': return <CloudFog size={20} color="#AAAAAA" />;
        case '폭우': return <CloudRain size={20} color="#0066CC" />;
        case '폭설': return <CloudSnow size={20} color="#EEEEEE" />;
        case '천둥번개': return <CloudLightning size={20} color="#FFD700" />;
        case '우박': return <CloudHail size={20} color="#AADDFF" />;
        case '황사': return <Wind size={20} color="#D2B48C" />;
        default: return <Cloud size={20} />;
      }
    } catch (error) {
      console.error("날씨 아이콘 렌더링 오류:", error);
      return <Cloud size={20} />;
    }
  };

  // 알람 타입 정규화 함수
  const normalizeAlarmType = (alarmType) => {
    if (alarmType === undefined || alarmType === null) return "Warning";
    
    const typeStr = safeString(alarmType).trim();
    if (typeStr === "1" || typeStr === "1차") return "Warning";
    if (typeStr === "2" || typeStr === "2차") return "Danger";
    if (typeStr === "3" || typeStr === "3차") return "Accident";
    
    return alarmType; // 이미 변환된 값이면 그대로 반환
  };

  // 알람 타입에 따른 배지 색상 반환 - 안전한 처리
  const getAlarmBadgeColor = (alarmType) => {
    if (!alarmType) return '#808080'; // 기본값
    
    try {
      // 알람 타입 정규화
      const normalizedType = normalizeAlarmType(alarmType);
      
      switch(normalizedType) {
        case '1':
        case '1차':
        case 'Warning': 
          return '#FFC107'; // 노란색
        case '2':
        case '2차':
        case 'Danger': 
          return '#E76A1F'; // 다홍색
        case '3':
        case '3차':
        case 'Accident':
        case 'Falling': 
          return '#ff0000'; // 빨간색
        default: 
          return '#808080'; // 기본 회색
      }
    } catch (error) {
      console.error("알람 배지 색상 처리 오류:", error);
      return '#808080';
    }
  };

  // 좌표 표시 안전 함수
  const safeCoordinates = () => {
    try {
      if (selectedAlarm && selectedAlarm.gps && 
          selectedAlarm.gps.coordinates && 
          Array.isArray(selectedAlarm.gps.coordinates) && 
          selectedAlarm.gps.coordinates.length >= 2) {
        return (
          <>
            위도: {selectedAlarm.gps.coordinates[1].toFixed(6)}, 
            경도: {selectedAlarm.gps.coordinates[0].toFixed(6)}
          </>
        );
      }
      return '좌표 정보 없음';
    } catch (error) {
      console.error("좌표 표시 오류:", error);
      return '좌표 표시 오류';
    }
  };

  // 날짜 포맷팅 - 오류 처리
  const formatDate = (dateStr) => {
    try {
      return new Date(dateStr).toLocaleString();
    } catch (error) {
      console.error("날짜 포맷팅 오류:", error);
      return dateStr || "알 수 없음";
    }
  };

  // 안전한 콜백 처리
  const handleCloseModal = (e) => {
    if (e) e.preventDefault();
    if (typeof closeModal === 'function') {
      closeModal();
    }
  };

  // 비디오 표시 여부 확인
  const shouldShowEmergencyButton = () => {
    const alarmType = safeString(selectedAlarm.alarm_type);
    return alarmType === 'Accident' || 
           alarmType === '3' || 
           alarmType === '3차' ||
           selectedAlarm.recognized_type === 'Falling' || 
           selectedAlarm.accident_id;
  };

  // 비디오 로딩 상태 표시
  const renderVideo = () => {
    if (!accidentVideo) return null;
    
    return (
      <div className="incident-video">
        <h3>사고 영상</h3>
        {isLoadingVideo ? (
          <div className="video-loading">영상을 불러오는 중...</div>
        ) : (
          <video controls autoPlay>
            <source src={accidentVideo.video_url} type="video/mp4" />
            브라우저가 비디오 태그를 지원하지 않습니다.
          </video>
        )}
        {selectedAlarm.accident_id && (
          <p className="accident-id">사고 ID: {selectedAlarm.accident_id}</p>
        )}
      </div>
    );
  };


  // 배지에 표시할 알람 타입 텍스트
  const getBadgeText = () => {
    try {
      const rawType = selectedAlarm.alarm_type;
      const typeStr = safeString(rawType);
      
      if (typeStr === '1' || typeStr === '1차') return 'Warning';
      if (typeStr === '2' || typeStr === '2차') return 'Danger';
      if (typeStr === '3' || typeStr === '3차') return 'Accident';
      
      return rawType || '알 수 없음';
    } catch (error) {
      console.error("배지 텍스트 처리 오류:", error);
      return '알 수 없음';
    }
  };

  return (
    <div className="modal-overlay" onClick={handleCloseModal}>
      
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={handleCloseModal}>&times;</button>

        <div className="modal-header">
          <h2>{getAlarmTypeText ? getAlarmTypeText(selectedAlarm.alarm_type) : selectedAlarm.alarm_type} 상세 정보</h2>
          <span className="alarm-type-badge" style={{ backgroundColor: getAlarmBadgeColor(selectedAlarm.alarm_type) }}>
            {getBadgeText()}
          </span>
        </div>
        
        {/* 비디오가 있는 경우 표시 */}
        {renderVideo()}
        {/* {accidentVideo && (
          <div className="incident-video">
            <h3>사고 영상</h3>
            <video controls autoPlay>
              <source src={accidentVideo.video_url} type="video/mp4" />
              브라우저가 비디오 태그를 지원하지 않습니다.
            </video>
            {selectedAlarm.accident_id && (
              <p className="accident-id">사고 ID: {selectedAlarm.accident_id}</p>
            )}
          </div>
        )} */}
        
        <div className="incident-details">
          <h3>알람 정보</h3>
          
          <div className="detail-section">
            <div className="detail-item">
              <span className="detail-icon"><Info size={16} /></span>
              <span className="detail-label">알람 유형:</span>
              <span className="detail-value">{getAlarmTypeText ? getAlarmTypeText(selectedAlarm.alarm_type) : selectedAlarm.alarm_type || '알 수 없음'}</span>
            </div>
            
            <div className="detail-item">
              <span className="detail-icon"><Info size={16} /></span>
              <span className="detail-label">감지 대상:</span>
              <span className="detail-value">{getRecognizedTypeText ? getRecognizedTypeText(selectedAlarm.recognized_type) : selectedAlarm.recognized_type || '알 수 없음'}</span>
            </div>
            
            
            <div className="detail-item">
              <span className="detail-icon"><Calendar size={16} /></span>
              <span className="detail-label">발생 시간:</span>
              <span className="detail-value">{formatDate(selectedAlarm.created_at)}</span>
            </div>
          </div>
          
          <h3>위치 정보</h3>
          
          <div className="detail-section">
            <div className="detail-item">
              <span className="detail-icon"><MapPin size={16} /></span>
              <span className="detail-label">좌표:</span>
              <span className="detail-value">
                {safeCoordinates()}
              </span>
            </div>
            
            <div className="detail-item">
              <span className="detail-icon"><Building size={16} /></span>
              <span className="detail-label">현장 이름:</span>
              <span className="detail-value">{selectedAlarm.site_name || 'N/A'}</span>
            </div>
            
            <div className="detail-item">
              <span className="detail-icon"><Building size={16} /></span>
              <span className="detail-label">현장 상태:</span>
              <span className="detail-value">{selectedAlarm.construction_status || 'N/A'}</span>
            </div>
            
            <div className="detail-item">
              <span className="detail-icon"><Cloud size={16} /></span>
              <span className="detail-label">날씨:</span>
              <span className="detail-value">
                {getWeatherIcon(selectedAlarm.weather)}
                <span style={{ marginLeft: '8px' }}>{selectedAlarm.weather || 'N/A'}</span>
              </span>
            </div>
          </div>
        </div>
        
        <div className="action-buttons">
          {/* 사고나 낙상인 경우에만 긴급 구조 요청 버튼 표시 */}
          {shouldShowEmergencyButton() && (
            <button className="btn-primary">긴급 구조 요청</button>
          )}
        </div>

        {/* 스타일 추가 */}
        <style jsx>{`
          .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.7);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
          }
          
          .modal-content {
            background-color: #1c1c1c;
            color: #fff;
            padding: 20px;
            border-radius: 10px;
            width: 90%;
            max-width: 600px;
            max-height: 90vh;
            overflow-y: auto;
            position: relative;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
          }
          
          .modal-close {
            position: absolute;
            top: 10px;
            right: 10px;
            background: none;
            border: none;
            color: #fff;
            font-size: 24px;
            cursor: pointer;
            z-index: 2;
            margin-right: 10px; /* 버튼과 배지 간격 추가 */
          }
          
          .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          }
          
          
          .alarm-type-badge {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 14px;
            font-weight: bold;
            margin-right: 30px; /* 오른쪽 여백 추가 */
          }
          
          .incident-video {
            margin-bottom: 20px;
            background-color: #000;
            border-radius: 6px;
            overflow: hidden;
          }
          
          .incident-video video {
            width: 100%;
            max-height: 300px;
          }
          
          .accident-id {
            padding: 8px;
            font-size: 14px;
            color: #aaa;
          }
          
          .incident-details h3 {
            margin: 20px 0 10px 0;
            font-size: 18px;
            color: #ddd;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            padding-bottom: 5px;
          }
          
          .detail-section {
            background-color: rgba(255, 255, 255, 0.05);
            border-radius: 6px;
            padding: 10px;
            margin-bottom: 15px;
          }
          
          .detail-item {
            display: flex;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          }
          
          .detail-item:last-child {
            border-bottom: none;
          }
          
          .detail-icon {
            width: 24px;
            color: #bbb;
            margin-right: 8px;
            display: flex;
            align-items: center;
          }
          
          .detail-label {
            width: 100px;
            color: #999;
          }
          
          .detail-value {
            flex: 1;
            display: flex;
            align-items: center;
          }
          
          .weather-icon {
            display: inline-block;
            width: 20px;
            height: 20px;
            margin-right: 8px;
            background-size: contain;
            background-repeat: no-repeat;
            vertical-align: middle;
          }
          
          .action-buttons {
            display: flex;
            gap: 10px;
            margin-top: 20px;
            justify-content: flex-end;
          }
          
          .btn-primary {
            background-color: #f44336;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
          }
          
          .btn-secondary {
            background-color: #444;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
          }
          
          .btn-primary:hover {
            background-color: #d32f2f;
          }
          
          .btn-secondary:hover {
            background-color: #555;
          }
        `}</style>
      </div>
    </div>
  );
};

export default AlarmDetailModal;