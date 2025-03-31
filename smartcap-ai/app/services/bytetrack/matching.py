import cv2
import numpy as np
import scipy
import lap

from scipy.spatial.distance import cdist

from cython_bbox import bbox_overlaps as bbox_ious
from app.services.bytetrack import kalman_filter
from app.config import SPECIFIC_CLASSES
from app.config import POSITION_WEIGHT
from app.config import MAX_CENTER_DIST
    
def merge_matches(m1, m2, shape):
    O,P,Q = shape
    m1 = np.asarray(m1)
    m2 = np.asarray(m2)

    M1 = scipy.sparse.coo_matrix((np.ones(len(m1)), (m1[:, 0], m1[:, 1])), shape=(O, P))
    M2 = scipy.sparse.coo_matrix((np.ones(len(m2)), (m2[:, 0], m2[:, 1])), shape=(P, Q))

    mask = M1*M2
    match = mask.nonzero()
    match = list(zip(match[0], match[1]))
    unmatched_O = tuple(set(range(O)) - set([i for i, j in match]))
    unmatched_Q = tuple(set(range(Q)) - set([j for i, j in match]))

    return match, unmatched_O, unmatched_Q


def linear_assignment(cost_matrix, thresh):
    """
    헝가리안 알고리즘을 사용하여 비용 행렬을 기반으로 최적 매칭 계산
    """
    
    # 비용 행렬이 비어있는 경우 처리
    if cost_matrix.size == 0:
        return np.empty((0, 2), dtype=int), tuple(range(cost_matrix.shape[0])), tuple(range(cost_matrix.shape[1]))
    
    # 헝가리안 알고리즘 실행 (lap.lapjv 사용) thresh보다 큰 값의 매칭 제외
    matches, unmatched_a, unmatched_b = [], [], []
    cost, x, y = lap.lapjv(cost_matrix, extend_cost=True, cost_limit=thresh)

    # 매칭 결과 처리
    for ix, mx in enumerate(x):
        if mx >= 0:
            matches.append([ix, mx])
    unmatched_a = np.where(x < 0)[0]
    unmatched_b = np.where(y < 0)[0]
    matches = np.asarray(matches)
    return matches, unmatched_a, unmatched_b


def ious(atlbrs, btlbrs):
    """
    바운딩 박스(AABB) 간의 IoU를 계산하는 함수입니다.
    IoU (Intersection over Union): 여러 개의 바운딩 박스의 교집합을 합집합으로 나눈 값

    Parameter:
    - type atlbrs: list[tlbr] | np.ndarray
    - type btlbrs: list[tlbr] | np.ndarray
    
    Return:
    - IoU 계산 값
    """
    ious = np.zeros((len(atlbrs), len(btlbrs)), dtype=np.float64)
    if ious.size == 0:
        return ious

    ious = bbox_ious(
        np.ascontiguousarray(atlbrs, dtype=np.float64),
        np.ascontiguousarray(btlbrs, dtype=np.float64)
    )

    return ious


def iou_distance(atracks, btracks):
    """
    IoU를 기반으로 비용 행렬을 계산합니다.
    특정 클래스의 경우 회전된 바운딩 박스 기반으로 IoU를 계산합니다.

    Parameter:
    - type atracks: list[STrack]
    - type btracks: list[STrack]

    Return:
    - rtype cost_matrix np.ndarray
    """

    if (len(atracks)>0 and isinstance(atracks[0], np.ndarray)) or (len(btracks) > 0 and isinstance(btracks[0], np.ndarray)):
        atlbrs = atracks
        btlbrs = btracks
        _ious = ious(atlbrs, btlbrs)
    else:
        # 트랙 객체인 경우 (확장 로직)
        _ious = np.zeros((len(atracks), len(btracks)), dtype=np.float64)

        for i, atrack in enumerate(atracks):
            for j, btrack in enumerate(btracks):
                # 특정 클래스에 대해 회전된 바운딩 박스 사용
                if (hasattr(atrack, 'class_id') and hasattr(btrack, 'class_id') and
                    atrack.class_id in SPECIFIC_CLASSES and btrack.class_id in SPECIFIC_CLASSES and
                    hasattr(atrack, '_rotated_box') and hasattr(btrack, '_rotated_box') and
                    atrack._rotated_box is not None and btrack._rotated_box is not None):

                    # OBB IoU 계산
                    iou_val = rotated_iou(atrack._rotated_box, btrack._rotated_box)

                    # 중심점 거리 계산
                    center_a = atrack._rotated_box[0]
                    center_b = btrack._rotated_box[0]
                    dist = np.sqrt(np.sum((np.array(center_a) - np.array(center_b))**2))

                    # 정규화된 거리
                    norm_dist = min(1.0, dist / MAX_CENTER_DIST)
                    
                    # 융합: IoU와 거리를 가중합
                    _ious[i, j] = (1 - POSITION_WEIGHT) * iou_val + POSITION_WEIGHT * (1 - norm_dist)
                
                else:
                    # 기존 AABB 바운딩 박스 IoU 계산
                    _ious[i, j] = ious([atrack.tlbr], [btrack.tlbr])[0, 0]

    cost_matrix = 1 - _ious

    return cost_matrix


def v_iou_distance(atracks, btracks):
    """
    예측된 바운딩 박스(pred_bbox)를 사용한 IoU 거리 계산
    
    Parameter:
        - atracks: list[STrack]
            첫 번째 트랙 목록
        - btracks: list[STrack]
            두 번째 트랙 목록
    Return:
        - cost_matrix : np.ndarray
            각 트랙 쌍 간의 IoU 거리로 계산된 비용 행렬
            값이 작을수록 유사한(겹치는) 트랙임을 의미
    """

    if (len(atracks)>0 and isinstance(atracks[0], np.ndarray)) or (len(btracks) > 0 and isinstance(btracks[0], np.ndarray)):
        atlbrs = atracks
        btlbrs = btracks
    else:
        atlbrs = [track.tlwh_to_tlbr(track.pred_bbox) for track in atracks]
        btlbrs = [track.tlwh_to_tlbr(track.pred_bbox) for track in btracks]
    _ious = ious(atlbrs, btlbrs)
    cost_matrix = 1 - _ious

    return cost_matrix


def gate_cost_matrix(kf, cost_matrix, tracks, detections, only_position=False):
    """
    칼만 필터 기반 게이팅 거리 계산을 통해 비용 행렬을 필터링

    Parameter:
        - kf : KalmanFilter
            게이팅 거리 계산에 사용될 칼만 필터 객체
        - cost_matrix : np.ndarray
            초기 비용 행렬
        - tracks : list[STrack]
            기존 추적 중인 트랙 리스트
        - detections : list[BaseTrack]
            현재 프레임에서 감지된 객체 리스트
        - only_position : bool, optional
            True일 경우 (x, y) 위치 정보만 고려하여 거리 계산

    Return:
        - cost_matrix : np.ndarray
            게이팅 거리 임계값을 초과한 항목이 무한대로 설정된 수정된 비용 행렬
    """

    if cost_matrix.size == 0:
        return cost_matrix
    gating_dim = 2 if only_position else 4
    gating_threshold = kalman_filter.chi2inv95[gating_dim]
    measurements = np.asarray([det.to_xyah() for det in detections])

    for row, track in enumerate(tracks):
        gating_distance = kf.gating_distance(
            track.mean, track.covariance, measurements, only_position)
        cost_matrix[row, gating_distance > gating_threshold] = np.inf
    return cost_matrix


def fuse_motion(kf, cost_matrix, tracks, detections, only_position=False, lambda_=0.98):
    """
    appearance 기반 비용과 칼만 필터 기반 마할라노비스 거리의 가중 평균으로
    새로운 비용 행렬 생성

    Parameter:
        - kf : KalmanFilter
            칼만 필터 객체
        - cost_matrix : np.ndarray
            기존 appearance 기반 비용 행렬
        - tracks : list[STrack]
            기존 추적 중인 트랙 리스트
        - detections : list[BaseTrack]
            현재 프레임에서 감지된 객체 리스트
        - only_position : bool, optional
            True일 경우 위치만 고려한 마할라노비스 거리 계산
        - lambda_ : float
            appearance와 motion 간의 가중치 비율 (0.0 ~ 1.0)

    Return:
        - cost_matrix : np.ndarray
            motion 정보가 반영된 최종 비용 행렬
    """

    if cost_matrix.size == 0:
        return cost_matrix
    gating_dim = 2 if only_position else 4
    gating_threshold = kalman_filter.chi2inv95[gating_dim]

    measurements = np.asarray([det.to_xyah() for det in detections])

    for row, track in enumerate(tracks):
        gating_distance = kf.gating_distance(
            track.mean, track.covariance, measurements, only_position, metric='maha')
        cost_matrix[row, gating_distance > gating_threshold] = np.inf
        cost_matrix[row] = lambda_ * cost_matrix[row] + (1 - lambda_) * gating_distance

    return cost_matrix


def fuse_score(cost_matrix, detections):
    """
    디텍션 신뢰도(score)와 IoU 유사도를 결합하여 비용 행렬 생성합니다.
    고신뢰도 객체에 더 높은 우선순위를 부여합니다.

    Parameter:
        - cost_matrix : np.ndarray
            IoU 기반 비용 행렬
        - detections : list[BaseTrack]
            현재 프레임에서 감지된 객체 리스트

    Return:
        - fuse_cost : np.ndarray
            디텍션 점수를 반영한 최종 비용 행렬
    """
    if cost_matrix.size == 0:
        return cost_matrix
    iou_sim = 1 - cost_matrix # IoU 유사도
    det_scores = np.array([det.score for det in detections]) # 디텍션 점수
    det_scores = np.expand_dims(det_scores, axis=0).repeat(cost_matrix.shape[0], axis=0)
    fuse_sim = iou_sim * det_scores
    fuse_cost = 1 - fuse_sim
    return fuse_cost


def rotated_iou(box1, box2):
    """
    회전된 바운딩 박스 간의 IoU 계산 (Shapely가 아닌 OpenCV를 활용하여 최적화)
    
    Parameters:
        - box1, box2: OpenCV minAreaRect 형태의 회전된 바운딩 박스
            ((cx, cy), (w, h), angle)
    
    Returns:
        - float: IoU 값 (0~1)
    """

    # 회전된 사각형 간의 교집합 계산
    retval, intersection_points = cv2.rotatedRectangleIntersection(box1, box2)

    # 교집합이 없으면 IoU = 0
    if retval == cv2.INTERSECT_NONE:
        return 0.0
    
    # 교집합 면적 계산
    intersection_area = cv2.contourArea(intersection_points)
    
    # 각 사각형 면적 계산
    area1 = box1[1][0] * box1[1][1]
    area2 = box2[1][0] * box2[1][1]
    
    # 합집합 면적 계산
    union_area = area1 + area2 - intersection_area
    if union_area <= 0:
        return 0.0
    
    # IoU값 계산
    return intersection_area / union_area


def mask_iou(mask1, mask2):
    """
    두 세그멘테이션 마스크 간의 IoU 계산
    
    Parameters:
        - mask1, mask2: 이진 마스크 (np.ndarray, 0 또는 1 값)
    
    Returns:
        - float: IoU 값 (0~1)
    """
    # 두 마스크가 모두 0인 경우 처리
    if np.sum(mask1) == 0 or np.sum(mask2) == 0:
        return 0.0
        
    # 교집합과 합집합 계산
    intersection = np.logical_and(mask1, mask2).sum()
    union = np.logical_or(mask1, mask2).sum()
    
    # 분모가 0이면 IoU = 0
    if union == 0:
        return 0.0
        
    return intersection / union
