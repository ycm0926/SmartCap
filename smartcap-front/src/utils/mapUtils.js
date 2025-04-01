// src/utils/mapUtils.js

// 구글맵용 마커 아이콘 설정 함수
export const getMarkerIcon = (alarmType, isNew = false) => {
  let color = '#ff9800'; // 기본 주황색
  
  if (alarmType === 'Falling' || alarmType === 'FALL') {
    color = '#ff0000'; // 낙상은 빨간색
  } else if (alarmType === 'Warning') {
    color = '#FFC107'; // 경고는 노란색
  } else if (alarmType === 'Danger') {
    color = '#9c27b0'; // 위험은 보라색
  } else if (alarmType === 'Accident') {
    color = '#ff0000'; // 사고는 빨간색
  }

  // 구글맵 마커 아이콘 객체 반환
  return {
    path: window.google?.maps?.SymbolPath?.CIRCLE || 0,
    fillColor: color,
    fillOpacity: 0.8,
    strokeColor: color,
    strokeWeight: 2,
    scale: isNew ? 12 : 8 // 새 알람이면 더 크게
  };
};

// 알람 타입에 따른 한글 표시
export const getAlarmTypeText = (type) => {
  switch(type) {
    case 'Falling': 
      return '낙상 감지';
    case 'Danger': 
      return '2차알림 위험';
    case 'Material': 
      return '자재';
    case 'Warning':
      return '1차알림 경고';
    case 'Accident':
      return '사고';
    case 'Vehicle':
      return '차량';
    case 'Unknown Cause':
      return '원인 불명';
    default: 
      return type;
  }
};

// 인식 타입에 따른 한글 표시
export const getRecognizedTypeText = (type) => {
  switch(type) {
    case 'WORKER': return '작업자';
    case 'Vehicle': return '차량';
    case 'CRANE': return '크레인';
    case 'Material': return '자재';
    case 'Falling': return '낙상';
    case 'Unknown Cause': return '원인 불명';
    default: return type;
  }
};

// 색상을 반환하는 유틸리티 함수
export const getAlarmColor = (alarmType, isNew = false) => {
  if (isNew) return '#ff0000'; // 새 알람은 항상 빨간색
  
  switch(alarmType) {
    case 'Accident': 
      return '#ff0000'; // 낙상/사고는 빨간색
    case 'Danger': 
      return '#9c27b0'; // 1차 알림 위험은 보라색
    case 'Warning':
      return '#FFC107'; // 경고는 노란색
    default: 
      return '#ff9800'; // 기본 주황색
  }
};