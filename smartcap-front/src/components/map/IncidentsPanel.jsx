// src/components/map/IncidentsPanel.jsx
import React from 'react';
import { AlertTriangle } from 'lucide-react';

const IncidentsPanel = ({ alarmHistory, newAlarmId, openAlarmDetails, getAlarmTypeText, getRecognizedTypeText }) => {
  return (
    <div className="incidents-panel">
      <h2>알람 이력</h2>
      {alarmHistory.length === 0 ? (
        <p>감지된 알람이 없습니다.</p>
      ) : (
        <ul>
          {alarmHistory.map(alarm => (
            <li 
              key={alarm.alarm_id} 
              onClick={() => openAlarmDetails(alarm)}
              className={alarm.alarm_id === newAlarmId ? 'new-incident' : ''}
            >
              <div className="incident-icon">
                <AlertTriangle 
                  size={18} 
                  color={alarm.alarm_id === newAlarmId ? "#ff0000" : 
                        alarm.alarm_type === "FALL" ? "#ff0000" :
                        alarm.alarm_type === "DANGER_ZONE" ? "#9c27b0" : "#2196f3"} 
                />
              </div>
              <div className="incident-info">
                <div className="incident-time">
                  {new Date(alarm.created_at).toLocaleString()}
                </div>
                <div className="incident-type">
                  {getAlarmTypeText(alarm.alarm_type)} ({getRecognizedTypeText(alarm.recognized_type)})
                </div>
                <div className="incident-location">
                  위도: {alarm.gps.coordinates[0].toFixed(4)}, 경도: {alarm.gps.coordinates[1].toFixed(4)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default IncidentsPanel;