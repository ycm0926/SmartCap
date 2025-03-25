import { Navigate, Outlet } from 'react-router-dom';
import { isAuthenticated } from '../services/authService';

// 인증된 사용자만 접근할 수 있는 라우트를 위한 컴포넌트
const ProtectedRoute = () => {
  // 인증 여부 확인
  if (!isAuthenticated()) {
    // 인증되지 않은 경우 로그인 페이지로 리다이렉트
    return <Navigate to="/login" replace />;
  }

  // 인증된 경우 자식 라우트 렌더링
  return <Outlet />;
};

export default ProtectedRoute;