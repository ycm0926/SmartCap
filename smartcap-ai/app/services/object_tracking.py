from app.services.bytetrack.byte_tracker import init_tracker
import numpy as np

from app.config import VEHICLE_CLASSES
from app.config import MATERIAL_CLASSES
from app.config import FALL_ZONE_CLASSES


# BYTETracker 인스턴스
tracker = init_tracker()


def track_objects_for_risk_detection(yolo_results):
    """
    Ultralytics YOLO 모델의 결과를 ByteTrack에 연결합니다.
    각 객체별 위험을 감지하기 위한 객체 추적을 수행합니다.
    
    Parameters:
        yolo_results: YOLO 모델의 결과
    
    Returns:
        class_groups: 추적된 객체 리스트
        - vehicle: 중장비 차량
        - material: 건설 자재
        - fall_zone: 낙상 감지
    """

    print(yolo_results)
    # 이미지 크기 정보 가져오기
    img_height, img_width = yolo_results.orig_shape
    img_info = (img_height, img_width)
    img_size = (img_height, img_width)
    
    # YOLO 결과에서 바운딩 박스, 신뢰도 값 추출
    if yolo_results.boxes.data.shape[0] == 0:
        # 감지된 객체가 없는 경우
        return []
    
    boxes_data = yolo_results.boxes.data.cpu().numpy()  # [x1, y1, x2, y2, conf, cls]
    
    # ByteTrack 입력 형식에 맞게 변환: [x1, y1, x2, y2, score]
    dets = np.zeros((len(boxes_data), 5))
    dets[:, :4] = boxes_data[:, :4]  # 바운딩 박스
    dets[:, 4] = boxes_data[:, 4]     # 신뢰도 점수
    
    # 클래스 ID 추출
    class_ids = boxes_data[:, 5].astype(int)
    
    # 마스크 추출
    masks = []
    if hasattr(yolo_results, 'masks') and yolo_results.masks is not None:

        for i in range(len(yolo_results.masks)):
            mask_data = yolo_results.masks[i].data.cpu().numpy()
            if len(mask_data.shape) == 3:
                mask_data = mask_data[0]

            binary_mask = (mask_data > 0.5).astype(np.uint8)
            masks.append(binary_mask)
    
    # ByteTracker 업데이트
    online_targets = tracker.update(
        dets,
        img_info,
        img_size,
        masks=masks,
        class_ids=class_ids
    )
    
    # 추적 결과 처리
    class_groups = {
        'vehicle': [],
        'material': [],
        'fall_zone': []
    }

    for track in online_targets:
        if track.is_activated:
            tracked_obj = {
                'track_id': track.track_id,
                'tlwh': track.tlwh,
                'tlbr': track.tlbr,
                'mask': track._mask,
                'score': track.score,
                'class_id': track.class_id if hasattr(track, 'class_id') else None,
                'class_name': yolo_results.names[track.class_id] if hasattr(track, 'class_id') and track.class_id is not None else None
            }
            
            if hasattr(track, '_rotated_box') and track._rotated_box is not None:
                tracked_obj['rotated_box'] = track._rotated_box
            
            # 클래스 ID에 따라 분류
            class_id = tracked_obj['class_id']
            if class_id is not None:
                if class_id in VEHICLE_CLASSES:
                    class_groups['vehicle'].append(tracked_obj)
                    
                elif class_id == MATERIAL_CLASSES:
                    class_groups['material'].append(tracked_obj)

                elif class_id in FALL_ZONE_CLASSES:
                   class_groups['fall_zone'].append(tracked_obj)
    
    return class_groups
