// src/pages/Dashboard.jsx

import {React, useEffect} from 'react';
import { useAuth } from '../store/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import { useStatsStore } from '../store/statsStore';

import { MonthlyDangerRanking } from '../components/dashboard/MonthlyDangerRanking.jsx';
import { RealtimeAlertBoard } from '../components/dashboard/RealtimeAlertBoard.jsx';
import { RealtimeLineChart } from '../components/dashboard/RealtimeLineChart.jsx';
import {AccidentTypeTrendChart} from '../components/dashboard/AccidentTypeTrendChart.jsx'
import { Map as MapIcon } from 'lucide-react'; // ✅ 아이콘 import

const Dashboard = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const setAllStats = useStatsStore((state) => state.setAllStats);
  const updateStat = useStatsStore((state) => state.updateStat);


  useEffect(() => {
    const fetchStats = async () => {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/events/dashboard`);
      const data = await res.json();
      console.log("data: ",data);
      setAllStats(data);
    };

    fetchStats();
  }, []);

  useEffect(() => {
    const eventSource = new EventSource(`${import.meta.env.VITE_API_BASE_URL}/api/sse`);
  
    const updateStat = useStatsStore.getState().updateStat;
  
    eventSource.onopen = () => {
      console.log("✅ SSE 연결 성공");
    };
  
    eventSource.addEventListener('stat_update', (event) => {
      console.log("📦 stat_update 이벤트 수신:", event.data);
      try {
        const update = JSON.parse(event.data);
        updateStat(update); // ✅ 안전하게 호출됨
  
        const newState = useStatsStore.getState(); // 🧠 전체 상태 가져오기
        console.log("🆕 업데이트된 상태:", newState);
      } catch (err) {
        console.error("❌ JSON 파싱 실패", err);
      }
    });
  
    eventSource.onerror = (err) => {
      console.error("🚨 SSE 오류 발생:", err);
    };
  
    return () => {
      console.log("👋 SSE 연결 종료");
      eventSource.close();
    };
  }, []);
  
  
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