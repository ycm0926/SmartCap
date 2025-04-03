// src/components/map/AlarmDetailModal.jsx
import React from 'react';
import { HardHat, MapPin, Calendar, Cloud, Info, Building, Sun, CloudRain, CloudSnow, CloudFog, CloudLightning, CloudHail, Wind } from 'lucide-react';

const AlarmDetailModal = ({ showModal, selectedAlarm, accidentVideo, closeModal, getAlarmTypeText, getRecognizedTypeText }) => {
  if (!showModal || !selectedAlarm) return null;

  // 날씨에 따른 아이콘 클래스 반환
  const getWeatherIcon = (weather) => {
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
  };

  // 알람 타입에 따른 배지 색상 반환
  const getAlarmBadgeColor = (alarmType) => {
    switch(alarmType) {
      case 'Danger': return '#E76A1F'; // 다홍색
      case 'Warning': return '#FFC107'; // 노란색
      case 'Accident':
      case 'Falling': return '#ff0000'; // 빨간색
      default: return '#ff0000'; // 기본 주황색
    }
  };

  return (
    <div className="modal-overlay" onClick={closeModal}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={closeModal}>&times;</button>

        <div className="modal-header">
          <h2>{getAlarmTypeText(selectedAlarm.alarm_type)} 상세 정보</h2>
          <span className="alarm-type-badge" style={{ backgroundColor: getAlarmBadgeColor(selectedAlarm.alarm_type) }}>
            {selectedAlarm.alarm_type}
          </span>
        </div>
        
        {/* 비디오가 있는 경우 표시 */}
        {accidentVideo && (
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
        )}
        
        <div className="incident-details">
          <h3>알람 정보</h3>
          
          <div className="detail-section">
            {/* 
            <div className="detail-item">
              <span className="detail-icon"><Info size={16} /></span>
              <span className="detail-label">알람 ID:</span>
              <span className="detail-value">{selectedAlarm.alarm_id}</span>
            </div>
            */}
            
             <div className="detail-item">
              <span className="detail-icon"><Info size={16} /></span>
              <span className="detail-label">알람 유형:</span>
              <span className="detail-value">{getAlarmTypeText(selectedAlarm.alarm_type)}</span>
            </div>
            
            <div className="detail-item">
              <span className="detail-icon"><Info size={16} /></span>
              <span className="detail-label">감지 대상:</span>
              <span className="detail-value">{getRecognizedTypeText(selectedAlarm.recognized_type)}</span>
            </div>
            
            <div className="detail-item">
              <span className="detail-icon"><HardHat size={16} /></span>
              <span className="detail-label">안전모 번호:</span>
              <span className="detail-value">{selectedAlarm.device_id || 'N/A'}</span>
            </div>
            
            <div className="detail-item">
              <span className="detail-icon"><Calendar size={16} /></span>
              <span className="detail-label">발생 시간:</span>
              <span className="detail-value">{new Date(selectedAlarm.created_at).toLocaleString()}</span>
            </div>
          </div>
          
          <h3>위치 정보</h3>
          
          <div className="detail-section">
            <div className="detail-item">
              <span className="detail-icon"><MapPin size={16} /></span>
              <span className="detail-label">좌표:</span>
              <span className="detail-value">
                위도: {selectedAlarm.gps.coordinates[1].toFixed(6)}, 
                경도: {selectedAlarm.gps.coordinates[0].toFixed(6)}
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
          {(selectedAlarm.alarm_type === 'Accident' || 
            selectedAlarm.recognized_type === 'Falling' || 
            selectedAlarm.accident_id) && (
            <button className="btn-primary">긴급 구조 요청</button>
          )}
          {/* <button className="btn-secondary">처리 완료 표시</button> */}
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