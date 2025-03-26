
// src/pages/Dashboard.jsx
import { useAuth } from '../store/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import '../styles/Dashboard.css';

const Dashboard = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>Dashboard</h1>
        <button onClick={handleLogout} className="logout-button">
          Logout
        </button>
      </header>
      <main className="dashboard-content">
        <div className="welcome-message">
          <h2>환영합니다!</h2>
          <p>똑똑캡 대시보드에 성공적으로 로그인하셨습니다.</p>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;

