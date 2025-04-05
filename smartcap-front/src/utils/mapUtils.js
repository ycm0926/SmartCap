// src/utils/mapUtils.js

/**
 * 알람 타입에 따른 텍스트 반환
 * @param {string} type 알람 타입
 * @returns {string} 사용자에게 표시할 텍스트
 */
export const getAlarmTypeText = (type) => {
  switch (type) {
    case 'Warning':
    case '1차':
    case '1': 
      return '경고';
    case 'Danger':
    case '2차':
    case '2': 
      return '위험';
    case 'Accident':
      return '사고';
    default:
      return type || '알 수 없음';
  }
};

/**
 * 인식 대상 타입에 따른 텍스트 반환
 * @param {string} type 인식 대상 타입
 * @returns {string} 사용자에게 표시할 텍스트
 */
export const getRecognizedTypeText = (type) => {
  switch (type) {
    case 'Material':
      return '자재';
    case 'Vehicle':
      return '차량';
    case 'Falling':
      return '낙상';
    case 'Worker':
      return '작업자';
    case 'Equipment':
      return '장비';
    default:
      return type || '알 수 없음';
  }
};

/**
 * 알람/사고 타입에 따른 색상 코드 반환
 * @param {string} type 알람/인식 타입
 * @param {boolean} isNew 새 알람 여부
 * @returns {string} 색상 코드
 */
export const getAlarmColor = (type, isNew = false) => {
  // 새 알람이면 강조 색상 사용
  if (isNew) {
    switch (type) {
      case 'Warning':
        return '#ffdd00';
      case 'Danger':
        return '#ff9500';
      case 'Accident':
        return '#ff0000';
      default:
        return '#ff0000';
    }
  }

  // 일반 알람 색상
  switch (type) {
    case 'Warning':
      return '#FFC107';
    case 'Danger':
      return '#E76A1F';
    case 'Accident':
      return '#ff0000';
    default:
      return '#ff0000';
  }
};

/**
 * 알람/사고 타입에 따른 마커 아이콘 URL 반환
 * @param {string} type 알람/인식 타입
 * @param {boolean} isNew 새 알람 여부
 * @returns {string} 아이콘 URL
 */
export const getMarkerIcon = (type, isNew = false) => {
  // 실제로는 Google Map API와 함께 사용할 마커 아이콘 형식을 반환
  const color = getAlarmColor(type, isNew);
  
  // SVG 마커 아이콘 생성 (색상에 따라 다른 아이콘)
  const svgMarker = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" width="30" height="42">
      <path fill="${color}" d="M172.268 501.67C26.97 291.031 0 269.413 0 192 0 85.961 85.961 0 192 0s192 85.961 192 192c0 77.413-26.97 99.031-172.268 309.67-9.535 13.774-29.93 13.773-39.464 0zM192 272c44.183 0 80-35.817 80-80s-35.817-80-80-80-80 35.817-80 80 35.817 80 80 80z"/>
    </svg>
  `;
  

  
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgMarker)}`,
    scaledSize: new window.google.maps.Size(30, 42),
    anchor: new window.google.maps.Point(15, 42), // 핀 하단 중앙이 좌표에 위치하도록
    labelOrigin: new window.google.maps.Point(15, 15) // 라벨 위치
  };
};