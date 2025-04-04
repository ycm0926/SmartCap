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

  // 알람 타입 및 인식 타입 안전하게 렌더링
  const renderAlarmType = () => {
    try {
      if (typeof getAlarmTypeText === 'function') {
        return getAlarmTypeText(alarm.alarm_type);
      }
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
        `}</style>
      </div>
    </OverlayView>
  );
};

export default CustomInfoWindow;