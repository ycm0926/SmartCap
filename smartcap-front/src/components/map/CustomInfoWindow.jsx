// CustomInfoWindow.jsx
import React from 'react';
import { OverlayView } from '@react-google-maps/api';

const CustomInfoWindow = ({ 
  position, 
  alarm, 
  onClose, 
  onDetailClick, 
  getAlarmTypeText, 
  getRecognizedTypeText 
}) => {
  // 데이터 유효성 검사
  if (!alarm || !position || !position.lat || !position.lng) {
    console.warn("CustomInfoWindow: 유효하지 않은 데이터", { alarm, position });
    return null;
  }
  
  // 헬퍼 함수: 안전하게 문자열 변환
  const safeString = (value) => {
    if (value === undefined || value === null) return "";
    return String(value);
  };

  // 알람 타입 및 인식 타입 안전하게 렌더링
  const renderAlarmType = () => {
    try {
      if (typeof getAlarmTypeText === 'function') {
        return getAlarmTypeText(alarm.alarm_type);
      }
      // getAlarmTypeText 함수가 없는 경우 기본 변환
      const typeStr = String(alarm.alarm_type).trim();
      if (typeStr === '1' || typeStr === '1차') return '경고';
      if (typeStr === '2' || typeStr === '2차') return '위험';
      if (typeStr === '3' || typeStr === '3차') return '사고';
      if (typeStr === 'Warning') return '경고';
      if (typeStr === 'Danger') return '위험';
      if (typeStr === 'Accident') return '사고';
      return alarm.alarm_type || "알 수 없음";
    } catch (error) {
      console.error("알람 타입 렌더링 오류:", error);
      return "알 수 없음";
    }
  };

  const renderRecognizedType = () => {
    try {
      if (typeof getRecognizedTypeText === 'function') {
        return getRecognizedTypeText(alarm.recognized_type);
      }
      // getRecognizedTypeText 함수가 없는 경우 기본 변환
      const typeStr = safeString(alarm.recognized_type);
      if (typeStr === 'Material') return '자재';
      if (typeStr === 'Vehicle') return '차량';
      if (typeStr === 'Falling') return '낙상';
      if (typeStr === 'Worker') return '작업자';
      if (typeStr === 'Equipment') return '장비';
      return alarm.recognized_type || "알 수 없음";
    } catch (error) {
      console.error("인식 타입 렌더링 오류:", error);
      return "알 수 없음";
    }
  };

  // 날짜 포맷팅 함수 - 오류 처리
  const formatDate = (dateStr) => {
    try {
      return new Date(dateStr).toLocaleString();
    } catch (error) {
      console.error("날짜 포맷팅 오류:", error);
      return dateStr || "알 수 없음";
    }
  };

  // 비디오 여부 확인 함수
  const hasVideo = () => {
    return alarm.accident_id || 
           alarm.video_url ||
           alarm.recognized_type === 'Falling' || 
           safeString(alarm.alarm_type) === '3' ||
           alarm.alarm_type === 'Accident';
  };

  // 이벤트 처리 함수 - 오류 방지
  const handleClose = (e) => {
    if (e) e.preventDefault();
    if (typeof onClose === 'function') {
      onClose();
    }
  };

  const handleDetailClick = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (typeof onDetailClick === 'function') {
      onDetailClick(alarm);
    }
  };

  return (
    <OverlayView
      position={position}
      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
      getPixelPositionOffset={(width, height) => ({
        x: -width / 2,
        y: -height - 40 // 마커 위에 위치하도록 조정
      })}
    >
      <div className="custom-overlay-window">
        <button className="close-btn" onClick={handleClose}>&times;</button>
        <h3>{renderAlarmType()}</h3>
        <p><strong>대상:</strong> {renderRecognizedType()}</p>
        <p><strong>시간:</strong> {formatDate(alarm.created_at)}</p>
        {alarm.device_id && <p><strong>장치 ID:</strong> {alarm.device_id}</p>}
        {alarm.site_name && <p><strong>현장:</strong> {alarm.site_name}</p>}
        {alarm.weather && <p><strong>날씨:</strong> {alarm.weather}</p>}
        {hasVideo() && <p className="video-badge">비디오 있음</p>}
        <button 
          onClick={handleDetailClick}
          className="detail-btn"
        >
          상세 정보 보기
        </button>
        
        <style jsx>{`
          .custom-overlay-window {
            background-color: #242f3e;
            color: white;
            border-radius: 4px;
            padding: 10px;
            box-shadow: 0 2px 7px rgba(0, 0, 0, 0.5);
            position: relative;
            min-width: 200px;
            max-width: 300px;
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
          
          .detail-btn {
            background-color: #0084ff;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 5px 10px;
            margin-top: 8px;
            cursor: pointer;
            width: 100%;
          }
          
          h3 {
            margin-top: 0;
            margin-bottom: 8px;
          }
          
          p {
            margin: 5px 0;
          }
          
          .video-badge {
            background-color: #f44336;
            color: white;
            font-size: 0.8rem;
            padding: 2px 6px;
            border-radius: 4px;
            display: inline-block;
            margin-top: 5px;
          }
        `}</style>
      </div>
    </OverlayView>
  );
};

export default CustomInfoWindow;