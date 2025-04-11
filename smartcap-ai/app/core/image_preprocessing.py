import cv2
import numpy as np

def read_binary_image(binary_data):
    """
    바이너리 데이터를 OpenCV 이미지(NumPy 배열)로 변환
    
    Parameter:
    - binary_data: 이미지의 바이너리 데이터
    
    Return:
    - OpenCV 이미지 객체 (NumPy 배열)
    """
    nparr = np.frombuffer(binary_data, np.uint8)
    img_data = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    return img_data


def correct_fisheye_distortion(img_data):
    """
    160° 광각 카메라(YXF-HDF3M-811-V1-166)의 어안렌즈 왜곡 보정 함수
    
    카메라 사양:
    - 화각: 160°
    - 초점 거리(EFL): 1.7mm
    - 왜곡: <-85.32%
    
    Parameter:
    - img_data: NumPy 배열
    
    Return:
    - 왜곡이 보정된 이미지 (BGR 채널이 포함된 HWC 형식의 NumPy 배열)
    """
    h, w = img_data.shape[:2]
    fx = fy = 944  # 픽셀 단위 초점 거리
    cx = w / 2
    cy = h / 2

    K = np.array([
        [fx, 0, cx],
        [0, fy, cy],
        [0, 0, 1]
    ])

    # 왜곡 계수
    k1, k2, k3, k4 = -0.34, -0.05, 0.0, 0.0
    D = np.array([k1, k2, k3, k4])

    balance = 0.0
    new_K = cv2.fisheye.estimateNewCameraMatrixForUndistortRectify(
        K, D, (w, h), np.eye(3), balance=balance
    )

    map1, map2 = cv2.fisheye.initUndistortRectifyMap(
        K, D, np.eye(3), new_K, (w, h), cv2.CV_16SC2
    )

    undistorted_img = cv2.remap(img_data, map1, map2, interpolation=cv2.INTER_LINEAR)
    return undistorted_img


def preprocess_frame(data):
    """
    이미지 데이터를 읽고 어안렌즈 왜곡 보정 및 90도 좌측(반시계방향) 회전하는 함수
    
    Parameter:
    - data: 이미지 데이터 (바이너리 데이터 또는 이미 디코딩된 NumPy 배열)
    
    Return:
    - 보정 및 회전된 이미지 (BGR 채널이 포함된 HWC 형식의 NumPy 배열)
    """
    # 이미 numpy 배열이면 그대로 사용, 아니면 바이너리 데이터로 변환
    img_data = data if isinstance(data, np.ndarray) else read_binary_image(data)
    
    corrected_img = correct_fisheye_distortion(img_data)
    
    # 90도 좌측(반시계방향) 회전
    rotated_img = cv2.rotate(corrected_img, cv2.ROTATE_90_COUNTERCLOCKWISE)
    
    return rotated_img
