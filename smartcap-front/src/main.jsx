import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import App from './App.jsx';

// 기본 렌더링 코드만 유지
// API 호출 제거 (App.jsx의 useEffect에서 처리)
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);