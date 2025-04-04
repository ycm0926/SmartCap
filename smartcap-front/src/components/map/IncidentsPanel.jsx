// src/components/map/IncidentsPanel.jsx
import React from 'react';
import { AlertTriangle, MapPin, Clock, HardHat } from 'lucide-react';

const IncidentsPanel = ({ alarmHistory, newAlarmId, openAlarmDetails, getAlarmTypeText, getRecognizedTypeText }) => {
  // Get color based on alarm type
  const getAlarmIconColor = (alarmType, isNew) => {
    if (isNew) return "#ff0000";
    
    switch(alarmType) {
      case 'Accident':
      case 'Falling': 
        return "#ff0000";
      case 'Danger': 
        return "#E76A1F";
      case 'Warning': 
        return "#FFC107";
      default: 
        return "#2196f3";
    }
  };

  // 날씨에 따른 아이콘 클래스 반환
  const getWeatherClass = (weather) => {
    switch(weather) {
      case '맑음': return "weather-clear";
      case '흐림': return "weather-cloudy";
      case '비': return "weather-rain";
      case '눈': return "weather-snow";
      case '안개': return "weather-fog";
      default: return "weather-default";
    }
  };

  // 위치 정보 포맷팅 - 에러 처리 추가
  const formatLocation = (alarm) => {
    // 사이트 이름이 있으면 그것을 반환
    if (alarm.site_name) {
      return alarm.site_name;
    }

    // gps 데이터 유효성 검사
    if (!alarm.gps || !alarm.gps.coordinates || !Array.isArray(alarm.gps.coordinates) || alarm.gps.coordinates.length < 2) {
      return "위치 정보 없음";
    }
    
    // 위도/경도를 간결하게 포맷팅
    try {
      const lat = alarm.gps.coordinates[1].toFixed(4);
      const lng = alarm.gps.coordinates[0].toFixed(4);
      return `${lat}, ${lng}`;
    } catch (error) {
      console.warn("좌표 포맷팅 실패:", error, alarm);
      return "좌표 오류";
    }
  };

  // 알람 데이터 유효성 검사
  const isValidAlarm = (alarm) => {
    return alarm && typeof alarm === 'object';
  };

  return (
    <div className="incidents-panel">
      <h2>알람 이력</h2>
      {!alarmHistory || alarmHistory.length === 0 ? (
        <p>감지된 알람이 없습니다.</p>
      ) : (
        <ul>
          {alarmHistory
            .filter(alarm => isValidAlarm(alarm)) // 유효한 알람만 필터링
            .map(alarm => {
              const isNew = alarm.alarm_id === newAlarmId;
              const hasVideo = alarm.accident_id || 
                              alarm.recognized_type === 'Falling' || 
                              alarm.alarm_type === 'Accident';
              
              return (
                <li 
                  key={alarm.alarm_id || `alarm-${Math.random()}`} // alarm_id 없을 경우 대비
                  onClick={() => openAlarmDetails(alarm)}
                  className={`${isNew ? 'new-incident' : ''} ${hasVideo ? 'has-video' : ''}`}
                >
                  <div className="incident-icon">
                    <AlertTriangle 
                      size={18} 
                      color={getAlarmIconColor(alarm.alarm_type, isNew)} 
                    />
                  </div>

                  <div className="incident-info">
                    <div className="incident-header">
                      <div className="incident-type">
                        {getAlarmTypeText(alarm.alarm_type)} - {getRecognizedTypeText(alarm.recognized_type)}
                        {alarm.weather && (
                          <span className={`weather-badge ${getWeatherClass(alarm.weather)}`} 
                                title={alarm.weather}>
                            {/* 날씨 아이콘 */}
                          </span>
                        )}
                      </div>
                      <div className="incident-time">
                        <Clock size={14} />
                        {new Date(alarm.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </div>
                    </div>

                    <div className="incident-meta">
                      <div className="incident-device">
                        <HardHat size={14} />
                        안전모 #{alarm.device_id || 'N/A'}
                      </div>
                      
                      <div className="incident-location">
                        <MapPin size={14} />
                        {formatLocation(alarm)}
                      </div>
                      
                      {hasVideo && (
                        <div className="incident-video-tag">
                          <span className="video-badge">비디오</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {isNew && <div className="new-indicator">NEW!</div>}
                </li>
              );
            })}
        </ul>
      )}
      
      {/* 정렬 및 필터 옵션 추가 */}
      <div className="incidents-controls">
        <button className="incidents-control-btn active">모든 알람</button>
        <button className="incidents-control-btn">사고만</button>
        <button className="incidents-control-btn">오늘</button>
      </div>
      
      {/* 스타일 추가 */}
      <style jsx>{`
        .incidents-panel {
          width: 350px;
          max-height: 100%;
          overflow-y: auto;
        }
        
        .incidents-panel ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        
        .incidents-panel li {
          padding: 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          cursor: pointer;
          position: relative;
          transition: background-color 0.2s;
          display: flex;
          align-items: flex-start;
        }
        
        .incidents-panel li:hover {
          background-color: rgba(255, 255, 255, 0.05);
        }
        
        .incident-icon {
          margin-right: 12px;
          padding-top: 2px;
        }
        
        .incident-info {
          flex: 1;
        }
        
        .incident-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 4px;
        }
        
        .incident-type {
          font-weight: 500;
          display: flex;
          align-items: center;
        }
        
        .incident-time {
          font-size: 0.8rem;
          color: #aaa;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        
        .incident-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          font-size: 0.85rem;
          color: #bbb;
        }
        
        .incident-device, .incident-location {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        
        .weather-badge {
          display: inline-block;
          width: 16px;
          height: 16px;
          margin-left: 6px;
          background-size: contain;
          background-repeat: no-repeat;
          vertical-align: middle;
        }
        
        .video-badge {
          background-color: #f44336;
          color: white;
          font-size: 0.7rem;
          padding: 1px 4px;
          border-radius: 4px;
        }
        
        .has-video {
          border-left: 3px solid #f44336;
        }
        
        .new-indicator {
          position: absolute;
          top: 2px;
          right: 2px;
          background-color: #ff0000;
          color: white;
          font-size: 0.6rem;
          padding: 1px 4px;
          border-radius: 4px;
          animation: pulse 1.5s infinite;
        }
        
        @keyframes pulse {
          0% { opacity: 0.6; }
          50% { opacity: 1; }
          100% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
};

export default IncidentsPanel;