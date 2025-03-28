// src/pages/Dashboard.jsx

import React from 'react';
import { useAuth } from '../store/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';

import { MonthlyDangerRanking } from '../components/MonthlyDangerRanking';
import { RealtimeAlertBoard } from '../components/RealtimeAlertBoard';
import { WeeklyDangerRanking } from '../components/WeeklyDangerRanking';
import { RealtimeLineChart } from '../components/RealtimeLineChart';

const Dashboard = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#1c232d] text-white">
      {/* 🔹 헤더 */}
      <header className="flex justify-between items-center px-8 py-4 bg-[rgba(20,25,30,0.9)] shadow-md">
        <h1 className="text-xl m-0">Dashboard</h1>
        <button
          onClick={handleLogout}
          className="bg-[#0084ff] text-white border-none rounded px-4 py-2 text-sm cursor-pointer transition-colors duration-200 hover:bg-[#0077e6]"
        >
          Logout
        </button>
      </header>

      {/* 🔹 본문 */}
      <main className="p-6">
        {/* 환영 메시지 박스 */}
        {/* <div className="bg-[rgba(20,25,30,0.8)] rounded-lg p-6 mb-6 max-w-3xl mx-auto text-center shadow-xl">
          <h2 className="text-2xl mb-2 text-[#0084ff]">환영합니다!</h2>
          <p className="text-base text-white/80">
            똑똑캡 대시보드에 성공적으로 로그인하셨습니다.
          </p>
        </div> */}

        {/* 대시보드 위젯 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MonthlyDangerRanking />
          <RealtimeAlertBoard />
          <WeeklyDangerRanking />
          <RealtimeLineChart />
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
