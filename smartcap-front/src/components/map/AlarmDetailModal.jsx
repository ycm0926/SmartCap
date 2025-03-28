// src/components/map/AlarmDetailModal.jsx
import React from 'react';

const AlarmDetailModal = ({ showModal, selectedAlarm, accidentVideo, closeModal, getAlarmTypeText, getRecognizedTypeText }) => {
  if (!showModal || !selectedAlarm) return null;

  return (
    <div className="modal-overlay" onClick={closeModal}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={closeModal}>&times;</button>
        
        <h2>{getAlarmTypeText(selectedAlarm.alarm_type)} 상세 정보</h2>
        
        {/* 낙상인 경우 비디오 표시 */}
        {accidentVideo && (
          <div className="incident-video">
            <h3>사고 영상</h3>
            <video controls autoPlay>
              <source src={accidentVideo.video_url} type="video/mp4" />
              브라우저가 비디오 태그를 지원하지 않습니다.
            </video>
          </div>
        )}
        
        <div className="incident-details">
          <h3>상세 정보</h3>
          <table>
            <tbody>
              <tr>
                <td>알람 ID:</td>
                <td>{selectedAlarm.alarm_id}</td>
              </tr>
              <tr>
                <td>알람 유형:</td>
                <td>{getAlarmTypeText(selectedAlarm.alarm_type)}</td>
              </tr>
              <tr>
                <td>감지 대상:</td>
                <td>{getRecognizedTypeText(selectedAlarm.recognized_type)}</td>
              </tr>
              <tr>
                <td>시간:</td>
                <td>{new Date(selectedAlarm.created_at).toLocaleString()}</td>
              </tr>
              <tr>
                <td>위치:</td>
                <td>위도: {selectedAlarm.gps.coordinates[0]}, 경도: {selectedAlarm.gps.coordinates[1]}</td>
              </tr>
              <tr>
                <td>날씨 ID:</td>
                <td>{selectedAlarm.weather_id}</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div className="action-buttons">
          {selectedAlarm.alarm_type === 'FALL' && (
            <button className="btn-primary">긴급 구조 요청</button>
          )}
          <button className="btn-secondary">처리 완료 표시</button>
        </div>
      </div>
    </div>
  );
};

export default AlarmDetailModal;