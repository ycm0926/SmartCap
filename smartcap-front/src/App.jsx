import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard'; // 대시보드 페이지 (인증 필요)
import ProtectedRoute from './components/ProtectedRoute';
import { isAuthenticated } from './services/authService';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 공개 라우트 */}
        <Route 
          path="/login" 
          element={
            isAuthenticated() ? <Navigate to="/dashboard" replace /> : <Login />
          } 
        />

        {/* 보호된 라우트 */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          {/* 다른 보호된 페이지를 여기에 추가 */}
        </Route>

        {/* 기본 리다이렉트 */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;