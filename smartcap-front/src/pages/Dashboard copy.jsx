import { useAuth } from '../store/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#1c232d] text-white">
      <header className="flex justify-between items-center px-8 py-4 bg-[rgba(20,25,30,0.9)] shadow-md">
        <h1 className="text-xl m-0">Dashboard</h1>
        <button
          onClick={handleLogout}
          className="bg-[#0084ff] text-white border-none rounded px-4 py-2 text-sm cursor-pointer transition-colors duration-200 hover:bg-[#0077e6]"
        >
          Logout
        </button>
      </header>

      <main className="p-8">
        <div className="bg-[rgba(20,25,30,0.8)] rounded-lg p-8 max-w-3xl mx-auto text-center shadow-xl">
          <h2 className="text-2xl mb-4 text-[#0084ff]">환영합니다!</h2>
          <p className="text-base text-white/80">
            똑똑캡 대시보드에 성공적으로 로그인하셨습니다.
          </p>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
