// src/components/map/CustomInfoWindow.jsx
import React from 'react';
import { InfoWindow } from '@react-google-maps/api';

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
    <InfoWindow
      position={position}
      onCloseClick={onClose}
      options={{
        pixelOffset: new window.google.maps.Size(0, -40),
        maxWidth: 300,
        disableAutoPan: false
      }}
    >
      <div className="custom-info-window">
        <h3>{getAlarmTypeText(alarm.alarm_type)}</h3>
        <p><strong>대상:</strong> {getRecognizedTypeText(alarm.recognized_type)}</p>
        <p><strong>시간:</strong> {new Date(alarm.created_at).toLocaleString()}</p>
        <button onClick={(e) => {
          e.stopPropagation();
          onDetailClick(alarm);
        }}>
          상세 정보 보기
        </button>
      </div>
    </InfoWindow>
  );
};

export default CustomInfoWindow;