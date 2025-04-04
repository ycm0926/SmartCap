// AlarmSSE.tsx - 사고 및 알람 SSE 채널 통합
import { useEffect, useRef } from "react";
import { useAlarmStore, Alarm } from "../store/alarmStore"; // Alarm 타입 직접 임포트
import { useNavigate, useLocation } from "react-router-dom";

// 서버에서 받는 알람 데이터 인터페이스 정의 (Alarm과 호환되도록)
interface AlarmData {
  alarm_id: number | string;
  construction_sites_id: number; // 필수 필드 추가
  weather_id?: number;
  gps: any;
  alarm_type: string;
  recognized_type: string;
  created_at: string | Date;
  accident_id?: number | null;
  site_name?: string;
  construction_status?: string;
  weather?: string;
  device_id?: string | number;
  [key: string]: any; // 추가 속성을 위한 인덱스 시그니처
}

// 연결 상태 인터페이스 정의
interface ConnectionState {
  eventSource: EventSource | null;
  retryCount: number;
  maxRetries: number;
  retryInterval: number;
  isConnecting: boolean;
  lastEventTime: number;
}

export default function AlarmSSE() {
  const addAlarm = useAlarmStore((state) => state.addAlarm);
  const alarms = useAlarmStore((state) => state.alarms);
  const navigate = useNavigate();
  const location = useLocation();
  
  // 최근 수신한 알람 ID를 저장하는 Set (중복 방지용)
  const processedAlarmsRef = useRef<Set<string | number>>(new Set());
  
  // 일반 알람과 사고 알람을 위한 두 개의 연결 상태 관리
  const alarmConnectionRef = useRef<ConnectionState>({
    eventSource: null,
    retryCount: 0,
    maxRetries: 5,
    retryInterval: 2000, // 초기 재연결 간격 (ms)
    isConnecting: false,
    lastEventTime: Date.now()
  });
  
  const accidentConnectionRef = useRef<ConnectionState>({
    eventSource: null,
    retryCount: 0,
    maxRetries: 5,
    retryInterval: 2000, // 초기 재연결 간격 (ms)
    isConnecting: false,
    lastEventTime: Date.now()
  });
  
  // 하트비트 체크를 위한 타이머 참조
  const alarmHeartbeatTimerRef = useRef<number | null>(null);
  const accidentHeartbeatTimerRef = useRef<number | null>(null);
  
  // 중복 알람 체크 함수
  const isDuplicateAlarm = (alarmId: string | number): boolean => {
    // 이미 처리된 알람인지 확인
    if (processedAlarmsRef.current.has(alarmId)) {
      console.log(`📝 중복 알람 무시 (ID: ${alarmId})`);
      return true;
    }
    
    // 현재 스토어에 이미 있는지 확인
    const exists = alarms.some(a => a.alarm_id === alarmId);
    if (exists) {
      console.log(`📝 이미 스토어에 존재하는 알람 무시 (ID: ${alarmId})`);
      return true;
    }
    
    // 중복이 아니면 처리된 알람 목록에 추가
    processedAlarmsRef.current.add(alarmId);
    
    // 목록이 너무 커지면 오래된 항목 정리
    if (processedAlarmsRef.current.size > 100) {
      const entries = Array.from(processedAlarmsRef.current);
      processedAlarmsRef.current = new Set(entries.slice(-50)); // 최근 50개만 유지
    }
    
    return false;
  };
  
  // 알람 데이터를 Alarm 타입으로 변환하고 필수 필드를 확인/보완하는 함수
  const normalizeAlarmData = (data: any): Alarm => {
    // 알람 타입 정규화
    let normalizedType = data.alarm_type;
    if (data.alarm_type === '1차' || data.alarm_type === '1') {
      normalizedType = 'Warning';
    } else if (data.alarm_type === '2차' || data.alarm_type === '2') {
      normalizedType = 'Danger';
    } else if (!normalizedType && data.accident_id) {
      normalizedType = 'Accident';
    }
    
    // alarm_id가 전혀 없다면, 프론트에서 고유한 ID 생성
    if (!data.alarm_id) {
      if (data.accident_id) {
        data.alarm_id = `accident-${data.accident_id}-${Date.now()}`;
      } else {
        data.alarm_id = `alarm-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      }
    }
    
    // construction_sites_id가 없으면 기본값 설정
    if (data.construction_sites_id === undefined) {
      data.construction_sites_id = data.site_id || 1; // 기본값 1 또는 site_id가 있으면 그 값 사용
    }
    
    // created_at이 문자열이면 Date 객체로 변환하고 ISO 문자열로 저장
    if (typeof data.created_at === 'string') {
      const dateObj = new Date(data.created_at);
      data.created_at = isNaN(dateObj.getTime()) ? new Date().toISOString() : dateObj.toISOString();
    } else if (data.created_at instanceof Date) {
      data.created_at = data.created_at.toISOString();
    } else if (!data.created_at) {
      data.created_at = new Date().toISOString();
    }
    
    // GPS 데이터가 없거나 유효하지 않은 경우 처리
    if (!data.gps || !data.gps.coordinates || !Array.isArray(data.gps.coordinates)) {
      if (data.latitude && data.longitude) {
        data.gps = {
          type: "Point",
          coordinates: [data.longitude, data.latitude]
        };
      } else {
        console.warn("⚠️ 알람 데이터에 유효한 위치 정보가 없습니다:", data);
        // 기본 좌표 설정 (역삼역)
        data.gps = {
          type: "Point",
          coordinates: [127.039615, 37.501263]
        };
      }
    }
    
    // 필수 필드 확인 (alarmStore.ts의 Alarm 타입과 일치하도록)
    const normalizedData: Alarm = {
      alarm_id: data.alarm_id,
      construction_sites_id: data.construction_sites_id,
      weather_id: data.weather_id,
      gps: data.gps,
      alarm_type: normalizedType,
      recognized_type: data.recognized_type || "Unknown",
      created_at: data.created_at,
      accident_id: data.accident_id || null,
      site_name: data.site_name,
      construction_status: data.construction_status,
      weather: data.weather
    };
    
    return normalizedData;
  };
  
  // === 일반 알람 SSE 관련 함수 ===
  
  // 알람 SSE 연결 복구 함수
  const reconnectAlarmSSE = () => {
    const conn = alarmConnectionRef.current;
    
    // 이미 연결 시도 중이거나, 최대 재시도 횟수를 초과한 경우 중단
    if (conn.isConnecting || conn.retryCount >= conn.maxRetries) {
      console.log(`🔄 알람 SSE 연결 재시도 건너뜀: ${conn.isConnecting ? '이미 연결 중' : '최대 재시도 횟수 초과'}`);
      return;
    }
    
    conn.isConnecting = true;
    
    // 지수 백오프 방식의 재연결 간격 계산
    const retryDelay = Math.min(conn.retryInterval * Math.pow(1.5, conn.retryCount), 30000); // 최대 30초
    conn.retryCount++;
    
    console.log(`🔄 알람 SSE 연결 재시도 ${conn.retryCount}/${conn.maxRetries} (${retryDelay}ms 후)...`);
    
    setTimeout(() => {
      try {
        // 기존 연결 정리
        if (conn.eventSource) {
          conn.eventSource.close();
          conn.eventSource = null;
        }
        
        // 새 연결 설정
        setupAlarmSSEConnection();
        
        conn.isConnecting = false;
      } catch (error) {
        console.error("❌ 알람 SSE 재연결 시도 중 오류:", error);
        conn.isConnecting = false;
        
        // 재시도 실패 시 다시 시도
        if (conn.retryCount < conn.maxRetries) {
          reconnectAlarmSSE();
        }
      }
    }, retryDelay);
  };
  
  // 알람 하트비트 체크
  const startAlarmHeartbeatCheck = () => {
    if (alarmHeartbeatTimerRef.current) {
      clearInterval(alarmHeartbeatTimerRef.current);
      alarmHeartbeatTimerRef.current = null;
    }
    
    alarmHeartbeatTimerRef.current = setInterval(() => {
      const timeSinceLastEvent = Date.now() - alarmConnectionRef.current.lastEventTime;
      console.log(`💓 알람: 마지막 이벤트 이후 경과 시간: ${timeSinceLastEvent / 1000}초`);
      
      if (timeSinceLastEvent > 30000) {
        console.log("⚠️ 알람: 장시간 이벤트 없음, 연결 복구 시도...");
        reconnectAlarmSSE();
      }
    }, 10000);
  };
  
  // 알람 SSE 연결 설정
  const setupAlarmSSEConnection = () => {
    try {
      console.log("🔄 알람 SSE 연결 시도...");
      
      const es = new EventSource(`${import.meta.env.VITE_API_BASE_URL}/api/sse/alarms`);
      alarmConnectionRef.current.eventSource = es;
      
      // 알람 버퍼링
      let alarmBuffer: any[] = [];
      let bufferTimer: number | null = null;
      
      // 버퍼 처리 함수
      const processAlarmBuffer = () => {
        if (alarmBuffer.length > 0) {
          console.log(`📦 ${alarmBuffer.length}개의 알람 일괄 처리`);
          
          alarmBuffer.forEach(data => {
            try {
              // 중복 확인
              if (data.alarm_id && isDuplicateAlarm(data.alarm_id)) {
                return;
              }
              
              // 데이터 정규화
              const normalizedAlarm = normalizeAlarmData(data);
              
              // 알람 추가
              addAlarm(normalizedAlarm);
              
              // Accident 타입 알람 처리
              if (normalizedAlarm.alarm_type === 'Accident' && location.pathname !== '/map') {
                navigate('/map', {
                  state: {
                    alert: true,
                    alarmId: normalizedAlarm.alarm_id,
                    fromAccident: true
                  }
                });
              }
            } catch (err) {
              console.error("❌ 알람 처리 실패:", err);
            }
          });
          
          alarmBuffer = [];
        }
      };
      
      es.onopen = () => {
        console.log("✅ 알람 SSE 연결 성공!");
        alarmConnectionRef.current.retryCount = 0;
        alarmConnectionRef.current.lastEventTime = Date.now();
        startAlarmHeartbeatCheck();
      };
      
      es.addEventListener('alarm', (event) => {
        console.log("🚨 알람 이벤트 수신:", event.data);
        alarmConnectionRef.current.lastEventTime = Date.now();
        
        try {
          const data = JSON.parse(event.data);
          console.log("📦 파싱된 알람 데이터:", data);
          
          // 채널 식별을 위한 속성 추가
          data._channel = "alarm";
          alarmBuffer.push(data);
          
          if (bufferTimer) {
            clearTimeout(bufferTimer);
          }
          bufferTimer = setTimeout(processAlarmBuffer, 100);
          
        } catch (err) {
          console.error("❌ 알람 데이터 파싱 실패:", err);
        }
      });
      
      es.addEventListener('connect', (event) => {
        console.log("🔌 연결 이벤트 수신:", event.data);
        alarmConnectionRef.current.lastEventTime = Date.now();
      });
      
      es.onmessage = (event) => {
        console.log("📨 일반 메시지 수신:", event.data);
        alarmConnectionRef.current.lastEventTime = Date.now();
      };
      
      es.onerror = (err) => {
        console.error("❌ 알람 SSE 연결 에러:", err);
        console.log("🔄 연결 상태:", es.readyState === 0 ? "연결 중" : es.readyState === 1 ? "열림" : "닫힘");
        
        if (es.readyState === 2) {
          reconnectAlarmSSE();
        }
      };
      
      return es;
    } catch (error) {
      console.error("❌ 알람 SSE 연결 설정 중 예외 발생:", error);
      reconnectAlarmSSE();
      return null;
    }
  };
  
  // === 사고 알람 SSE 관련 함수 ===
  
  // 사고 SSE 연결 복구 함수
  const reconnectAccidentSSE = () => {
    const conn = accidentConnectionRef.current;
    
    if (conn.isConnecting || conn.retryCount >= conn.maxRetries) {
      console.log(`🔄 사고 SSE 연결 재시도 건너뜀: ${conn.isConnecting ? '이미 연결 중' : '최대 재시도 횟수 초과'}`);
      return;
    }
    
    conn.isConnecting = true;
    
    const retryDelay = Math.min(conn.retryInterval * Math.pow(1.5, conn.retryCount), 30000);
    conn.retryCount++;
    
    console.log(`🔄 사고 SSE 연결 재시도 ${conn.retryCount}/${conn.maxRetries} (${retryDelay}ms 후)...`);
    
    setTimeout(() => {
      try {
        if (conn.eventSource) {
          conn.eventSource.close();
          conn.eventSource = null;
        }
        
        setupAccidentSSEConnection();
        
        conn.isConnecting = false;
      } catch (error) {
        console.error("❌ 사고 SSE 재연결 시도 중 오류:", error);
        conn.isConnecting = false;
        
        if (conn.retryCount < conn.maxRetries) {
          reconnectAccidentSSE();
        }
      }
    }, retryDelay);
  };
  
  // 사고 하트비트 체크
  const startAccidentHeartbeatCheck = () => {
    if (accidentHeartbeatTimerRef.current) {
      clearInterval(accidentHeartbeatTimerRef.current);
      accidentHeartbeatTimerRef.current = null;
    }
    
    accidentHeartbeatTimerRef.current = setInterval(() => {
      const timeSinceLastEvent = Date.now() - accidentConnectionRef.current.lastEventTime;
      console.log(`💓 사고: 마지막 이벤트 이후 경과 시간: ${timeSinceLastEvent / 1000}초`);
      
      if (timeSinceLastEvent > 30000) {
        console.log("⚠️ 사고: 장시간 이벤트 없음, 연결 복구 시도...");
        reconnectAccidentSSE();
      }
    }, 10000);
  };
  
  // 사고 SSE 연결 설정
  const setupAccidentSSEConnection = () => {
    try {
      console.log("🔄 사고 SSE 연결 시도...");
      
      const es = new EventSource(`${import.meta.env.VITE_API_BASE_URL}/api/accident/subscribe`);
      accidentConnectionRef.current.eventSource = es;
      
      // 사고 버퍼링
      let accidentBuffer: any[] = [];
      let bufferTimer: number | null = null;
      
      // 버퍼 처리 함수
      const processAccidentBuffer = () => {
        if (accidentBuffer.length > 0) {
          console.log(`📦 ${accidentBuffer.length}개의 사고 일괄 처리`);
          
          accidentBuffer.forEach(data => {
            try {
              // 알람 타입 설정 (사고는 항상 Accident 타입)
              data.alarm_type = 'Accident';
              
              // 알람 ID 또는 사고 ID로 중복 체크
              let duplicateKey = data.alarm_id;
              if (!duplicateKey && data.accident_id) {
                duplicateKey = `accident-${data.accident_id}`;
              }
              
              if (duplicateKey && isDuplicateAlarm(duplicateKey)) {
                return; // 중복인 경우 처리 건너뜀
              }
              
              // ID 생성 (없는 경우)
              if (!data.alarm_id) {
                data.alarm_id = `accident-${data.accident_id || ''}-${Date.now()}`;
              }
              
              // 데이터 정규화 및 처리
              const normalizedData = normalizeAlarmData(data);
              
              // 구분을 위해 뚜렷한 색상 차이가 나도록 인식 타입 설정
              if (!normalizedData.recognized_type || normalizedData.recognized_type === "Unknown") {
                normalizedData.recognized_type = "Falling";
              }
              
              // 알람 추가
              addAlarm(normalizedData);
              
              // 사고 알람인 경우 지도 페이지로 라우팅
              if (location.pathname !== '/map') {
                navigate('/map', {
                  state: {
                    alert: true,
                    alarmId: normalizedData.alarm_id,
                    fromAccident: true
                  }
                });
              }
            } catch (err) {
              console.error("❌ 사고 데이터 처리 실패:", err);
            }
          });
          
          accidentBuffer = [];
        }
      };
      
      es.onopen = () => {
        console.log("✅ 사고 SSE 연결 성공!");
        accidentConnectionRef.current.retryCount = 0;
        accidentConnectionRef.current.lastEventTime = Date.now();
        startAccidentHeartbeatCheck();
      };
      
      // 사고 이벤트 리스너 - 특정 이벤트 유형으로 캡처
      es.addEventListener("accident", (event) => {
        console.log("🚨 사고 이벤트 수신:", event.data);
        accidentConnectionRef.current.lastEventTime = Date.now();
        
        try {
          // 데이터 파싱
          const data = JSON.parse(event.data);
          console.log("📦 파싱된 사고 데이터:", data);
          
          // 버퍼에 추가 (채널 식별 정보 추가)
          data._channel = "accident";
          accidentBuffer.push(data);
          
          // 100ms 내에 추가 사고가 없으면 처리
          if (bufferTimer) {
            clearTimeout(bufferTimer);
          }
          bufferTimer = setTimeout(processAccidentBuffer, 100);
          
        } catch (err) {
          console.error("❌ 사고 데이터 파싱 실패:", err);
          console.error("📄 원본 데이터:", event.data);
        }
      });
      
      // 모든 이벤트를 캡처하기 위한 추가 리스너
      es.addEventListener("message", (event) => {
        console.log("🚨 사고 일반 메시지 수신:", event.data);
        accidentConnectionRef.current.lastEventTime = Date.now();
        
        try {
          // 데이터 파싱
          const data = JSON.parse(event.data);
          console.log("📦 파싱된 사고 일반 데이터:", data);
          
          // 버퍼에 추가 (채널 식별 정보 추가)
          data._channel = "accident";
          accidentBuffer.push(data);
          
          // 100ms 내에 추가 사고가 없으면 처리
          if (bufferTimer) {
            clearTimeout(bufferTimer);
          }
          bufferTimer = setTimeout(processAccidentBuffer, 100);
          
        } catch (err) {
          // JSON이 아닌 경우 무시
        }
      });
      
      es.onmessage = (event) => {
        console.log("📨 사고 일반 메시지 기본 리스너:", event.data);
        accidentConnectionRef.current.lastEventTime = Date.now();
      };
      
      es.onerror = (err) => {
        console.error("❌ 사고 SSE 연결 에러:", err);
        console.log("🔄 연결 상태:", es.readyState === 0 ? "연결 중" : es.readyState === 1 ? "열림" : "닫힘");
        
        if (es.readyState === 2) {
          reconnectAccidentSSE();
        }
      };
      
      return es;
    } catch (error) {
      console.error("❌ 사고 SSE 연결 설정 중 예외 발생:", error);
      reconnectAccidentSSE();
      return null;
    }
  };
  
  // 초기화 시 기존에 처리된 알람 ID 저장
  useEffect(() => {
    // 현재 스토어에 있는 알람 ID와 사고 ID를 처리된 알람으로 등록
    const processedIds = new Set<string | number>();
    
    alarms.forEach(alarm => {
      if (alarm.alarm_id) {
        processedIds.add(alarm.alarm_id);
      }
      
      if (alarm.accident_id) {
        processedIds.add(`accident-${alarm.accident_id}`);
      }
    });
    
    processedAlarmsRef.current = processedIds;
    console.log(`🔄 기존 알람/사고 ${processedAlarmsRef.current.size}개 로드됨`);
  }, []);
  
  useEffect(() => {
    // 초기 SSE 연결 설정 - 두 채널 모두 연결
    const alarmES = setupAlarmSSEConnection();
    const accidentES = setupAccidentSSEConnection();
    
    // 컴포넌트 언마운트 시 정리
    return () => {
      console.log("❌ SSE 연결 종료 및 정리");
      
      // 알람 SSE 정리
      if (alarmHeartbeatTimerRef.current) {
        clearInterval(alarmHeartbeatTimerRef.current);
        alarmHeartbeatTimerRef.current = null;
      }
      
      if (alarmES) {
        alarmES.close();
      }
      
      if (alarmConnectionRef.current.eventSource) {
        alarmConnectionRef.current.eventSource.close();
        alarmConnectionRef.current.eventSource = null;
      }
      
      // 사고 SSE 정리
      if (accidentHeartbeatTimerRef.current) {
        clearInterval(accidentHeartbeatTimerRef.current);
        accidentHeartbeatTimerRef.current = null;
      }
      
      if (accidentES) {
        accidentES.close();
      }
      
      if (accidentConnectionRef.current.eventSource) {
        accidentConnectionRef.current.eventSource.close();
        accidentConnectionRef.current.eventSource = null;
      }
    };
  }, [addAlarm, navigate, location.pathname]);
  
  return null;
}