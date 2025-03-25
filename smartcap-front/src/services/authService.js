// src/services/authService.js
export const isAuthenticated = () => {
    // 예시로 'isAuthenticated'라는 값을 localStorage에서 가져옴
    // 실제 서비스에서는 서버에서 토큰이나 세션 정보를 확인해야 할 수 있습니다.
    return localStorage.getItem('isAuthenticated') === 'true';
  };
  
  // 인증 상태 설정 함수 예시
  export const login = () => {
    localStorage.setItem('isAuthenticated', 'true');
  };
  
  export const logout = () => {
    localStorage.setItem('isAuthenticated', 'false');
  };
  