import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard'; // 대시보드 페이지 (인증 필요)
import ProtectedRoute from './components/ProtectedRoute';
import { isAuthenticated } from './services/authService';

function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}

export default App;
