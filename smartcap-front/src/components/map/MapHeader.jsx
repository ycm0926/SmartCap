// src/components/map/MapHeader.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';

const MapHeader = ({ handleLogout }) => {
  const navigate = useNavigate();

  const goToDashboard = () => {
    navigate('/dashboard');
  };

  return (
    <header className="map-header">
      <h1>안전 모니터링 지도</h1>
      <div className="flex items-center gap-4">
        <button
          className="flex items-center gap-2 bg-[#2c3e50] hover:bg-[#34495e] text-white rounded px-4 py-2 text-sm transition-colors duration-200"
          onClick={goToDashboard}
        >
          대시보드로 돌아가기
        </button>
        <button
          onClick={handleLogout}
          className="bg-[#0084ff] text-white border-none rounded px-4 py-2 text-sm cursor-pointer transition-colors duration-200 hover:bg-[#0077e6]"
        >
          로그아웃
        </button>
      </div>
    </header>
  );
};

export default MapHeader;