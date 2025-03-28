// src/utils/mapUtils.js

// 구글맵용 마커 아이콘 설정 함수
export const getMarkerIcon = (alarmType, isNew = false) => {
  let color = '#ff9800'; // 기본 주황색
  
  if (alarmType === 'FALL') {
    color = '#ff0000'; // 낙상은 빨간색
  } else if (alarmType === 'DANGER_ZONE') {
    color = '#9c27b0'; // 위험 구역은 보라색
  } else if (alarmType === 'EQUIPMENT') {
    color = '#2196f3'; // 장비 관련은 파란색
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

// 알람 타입에 따른 한글 표시 (이 부분은 유지)
export const getAlarmTypeText = (type) => {
  switch(type) {
    case 'FALL': return '낙상 감지';
    case 'DANGER_ZONE': return '위험구역 침범';
    case 'EQUIPMENT': return '장비 위험';
    default: return type;
  }
};

// 인식 타입에 따른 한글 표시 (이 부분은 유지)
export const getRecognizedTypeText = (type) => {
  switch(type) {
    case 'WORKER': return '작업자';
    case 'VEHICLE': return '차량';
    case 'CRANE': return '크레인';
    case 'EQUIPMENT': return '장비';
    default: return type;
  }
};

// 색상을 반환하는 유틸리티 함수 (다른 곳에서도 사용 가능)
export const getAlarmColor = (alarmType, isNew = false) => {
  if (isNew) return '#ff0000'; // 새 알람은 항상 빨간색
  
  switch(alarmType) {
    case 'FALL': return '#ff0000'; // 낙상은 빨간색
    case 'DANGER_ZONE': return '#9c27b0'; // 위험 구역은 보라색
    case 'EQUIPMENT': return '#2196f3'; // 장비 관련은 파란색
    default: return '#ff9800'; // 기본 주황색
  }
};