// CustomInfoWindow.jsx 파일을 아래와 같이 수정
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
  if (!alarm) return null;

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
        <button className="close-btn" onClick={onClose}>&times;</button>
        <h3>{getAlarmTypeText(alarm.alarm_type)}</h3>
        <p><strong>대상:</strong> {getRecognizedTypeText(alarm.recognized_type)}</p>
        <p><strong>시간:</strong> {new Date(alarm.created_at).toLocaleString()}</p>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onDetailClick(alarm);
          }}
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