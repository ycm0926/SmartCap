import cv2
import numpy as np
import scipy
import lap
from scipy.spatial.distance import cdist

from cython_bbox import bbox_overlaps as bbox_ious
from app.services.bytetrack import kalman_filter
    
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
    if cost_matrix.size == 0:
        return np.empty((0, 2), dtype=int), tuple(range(cost_matrix.shape[0])), tuple(range(cost_matrix.shape[1]))
    matches, unmatched_a, unmatched_b = [], [], []
    cost, x, y = lap.lapjv(cost_matrix, extend_cost=True, cost_limit=thresh)
    for ix, mx in enumerate(x):
        if mx >= 0:
            matches.append([ix, mx])
    unmatched_a = np.where(x < 0)[0]
    unmatched_b = np.where(y < 0)[0]
    matches = np.asarray(matches)
    return matches, unmatched_a, unmatched_b


def ious(atlbrs, btlbrs):
    """
    Compute cost based on IoU
    :type atlbrs: list[tlbr] | np.ndarray
    :type atlbrs: list[tlbr] | np.ndarray

    :rtype ious np.ndarray
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
    Compute cost based on IoU
    :type atracks: list[STrack]
    :type btracks: list[STrack]

    :rtype cost_matrix np.ndarray
    """

    if (len(atracks)>0 and isinstance(atracks[0], np.ndarray)) or (len(btracks) > 0 and isinstance(btracks[0], np.ndarray)):
        atlbrs = atracks
        btlbrs = btracks
    else:
        atlbrs = [track.tlbr for track in atracks]
        btlbrs = [track.tlbr for track in btracks]
    _ious = ious(atlbrs, btlbrs)
    cost_matrix = 1 - _ious

    return cost_matrix

def v_iou_distance(atracks, btracks):
    """
    IoU를 기반으로 비용 행렬을 계산
    
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

def embedding_distance(tracks, detections, metric='cosine'):
    """
    특징 임베딩(embedding)을 기반으로 트랙과 디텍션 간의 비용 행렬을 계산
    
    Parameter:
        - tracks : list[STrack]
            비교할 기준이 되는 트랙 리스트
        - detections : list[BaseTrack]
            현재 프레임에서 감지된 객체 리스트
        - metric : str
             거리 계산에 사용할 거리 함수 (예: 'cosine', 'euclidean' 등)
    
    Return:
        - cost_matrix : np.ndarray
            트랙과 디텍션 간의 임베딩 거리로 계산된 비용 행렬
    """

    cost_matrix = np.zeros((len(tracks), len(detections)), dtype=np.float64)
    if cost_matrix.size == 0:
        return cost_matrix
    det_features = np.asarray([track.curr_feat for track in detections], dtype=np.float64)
    #for i, track in enumerate(tracks):
        #cost_matrix[i, :] = np.maximum(0.0, cdist(track.smooth_feat.reshape(1,-1), det_features, metric))
    track_features = np.asarray([track.smooth_feat for track in tracks], dtype=np.float64)
    cost_matrix = np.maximum(0.0, cdist(track_features, det_features, metric))  # Nomalized features
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


def fuse_iou(cost_matrix, tracks, detections):
    """
    IoU 유사도와 appearance 기반 유사도를 결합하여 최종 비용 행렬 생성

    Parameter:
        - cost_matrix : np.ndarray
            기존 appearance 기반 비용 행렬
        - tracks : list[STrack]
            기존 추적 중인 트랙 리스트
        - detections : list[BaseTrack]
            현재 프레임에서 감지된 객체 리스트

    Return:
        - fuse_cost : np.ndarray
            IoU와 appearance 정보를 융합하여 계산된 비용 행렬
    """

    if cost_matrix.size == 0:
        return cost_matrix
    reid_sim = 1 - cost_matrix
    iou_dist = iou_distance(tracks, detections)
    iou_sim = 1 - iou_dist
    fuse_sim = reid_sim * (1 + iou_sim) / 2
    det_scores = np.array([det.score for det in detections])
    det_scores = np.expand_dims(det_scores, axis=0).repeat(cost_matrix.shape[0], axis=0)
    #fuse_sim = fuse_sim * (1 + det_scores) / 2
    fuse_cost = 1 - fuse_sim
    return fuse_cost


def fuse_score(cost_matrix, detections):
    """
    디텍션 신뢰도(score)와 IoU 유사도를 결합하여 비용 행렬 생성

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
    iou_sim = 1 - cost_matrix
    det_scores = np.array([det.score for det in detections])
    det_scores = np.expand_dims(det_scores, axis=0).repeat(cost_matrix.shape[0], axis=0)
    fuse_sim = iou_sim * det_scores
    fuse_cost = 1 - fuse_sim
    return fuse_cost