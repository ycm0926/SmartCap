// AccidentSSE.jsx
import { useEffect } from "react";
import { useAlarmStore } from "../store/alarmStore"; // 혹은 사고 전용 스토어 사용

export default function AccidentSSE() {
  // 사고 데이터를 추가하는 함수를 사용합니다.
  const addAlarm = useAlarmStore((state) => state.addAlarm);

  useEffect(() => {
    console.log("🔄 Accident SSE 연결 시도...");
    const es = new EventSource("http://localhost:8080/api/accident/subscribe");

    es.onopen = () => {
      console.log("✅ Accident SSE 연결 성공!");
    };

    // 백엔드에서 전송하는 'accident' 이벤트 수신
    // 사고 이벤트 처리 부분
    es.addEventListener("accident", (event) => {
        console.log("🚨 사고 이벤트 수신:", event.data);
        try {
        const data = JSON.parse(event.data);
        console.log("📦 파싱된 사고 데이터:", data);
        // 고유 식별자 생성: accident_id와 현재 시각을 결합하거나, crypto.randomUUID() 사용
        if (!data.alarm_id) {
            // 예: accident_id와 타임스탬프를 결합하여 고유 ID 생성
            data.alarm_id = `accident-${data.accident_id}-${Date.now()}`;
            // 또는 modern 브라우저라면
            // data.alarm_id = crypto.randomUUID();
        }
        addAlarm(data);
        } catch (err) {
        console.error("❌ 사고 데이터 파싱 실패:", err);
        }
    });
  

    es.onerror = (err) => {
      console.error("❌ Accident SSE 연결 에러:", err);
    };

    return () => {
      console.log("❌ Accident SSE 연결 종료");
      es.close();
    };
  }, [addAlarm]);

  return null;
}
