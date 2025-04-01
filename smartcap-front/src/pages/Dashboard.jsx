// src/pages/Dashboard.jsx

import React from 'react';
import { useAuth } from '../store/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';

import { MonthlyDangerRanking } from '../components/dashboard/MonthlyDangerRanking.jsx';
import { RealtimeAlertBoard } from '../components/dashboard/RealtimeAlertBoard.jsx';
import { RealtimeLineChart } from '../components/dashboard/RealtimeLineChart.jsx';
import {AccidentTypeTrendChart} from '../components/dashboard/AccidentTypeTrendChart.jsx'
import { Map as MapIcon } from 'lucide-react'; // ✅ 아이콘 import

const Dashboard = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const goToMapPage = () => {
    navigate('/map');
  };
  

  return (
    <div className="min-h-screen bg-[#1c232d] text-white">
      {/* 🔹 헤더 */}
      <header className="flex justify-between items-center px-8 py-4 bg-[#0d1117] shadow-md">
        <h1 className="text-2xl font-bold m-0">안전 모니터링 대시보드</h1>
        
        <div className="flex items-center gap-4">
          <button
            onClick={goToMapPage}
            className="flex items-center gap-2 bg-[#2c3e50] hover:bg-[#34495e] text-white rounded px-4 py-2 text-sm transition-colors duration-200"
          >
            <MapIcon size={16} />
            안전 지도 보기
          </button>
          <button
            onClick={handleLogout}
            className="bg-[#0084ff] text-white border-none rounded px-4 py-2 text-sm cursor-pointer transition-colors duration-200 hover:bg-[#0077e6]"
          >
            로그아웃
          </button>
        </div>
      </header>

      {/* 🔹 본문 */}
      <main className="p-8">
        {/* 대시보드 위젯 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
          <div className="md:col-span-8">
            <RealtimeLineChart />
          </div>
          <div className="md:col-span-4">
            <AccidentTypeTrendChart />
          </div>
          <div className="md:col-span-5">
            <RealtimeAlertBoard />
          </div>
          <div className="md:col-span-7">
            <MonthlyDangerRanking />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;