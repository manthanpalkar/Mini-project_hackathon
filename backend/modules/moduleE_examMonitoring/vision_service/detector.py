"""
UniVerse Module E — Computer Vision Detection Engine
Implements multi-person detection, 17-keypoint pose estimation, and prohibited device detection.
Architecturally adapted and hardened from ShashankJangid/ai-exam-surveillance and sumitra-sumi/smart_exam_proctoring.
"""

import cv2
import numpy as np
from ultralytics import YOLO

class ExamVisionDetector:
    def __init__(self, model_name="yolov8n.pt", pose_model_name="yolov8n-pose.pt", conf_thresh=0.40):
        self.conf_thresh = conf_thresh
        # Load lightweight nano models
        self.det_model = YOLO(model_name)
        self.pose_model = YOLO(pose_model_name)
        
        # COCO class IDs of interest: 0 = person, 67 = cell phone, 73 = book, 63 = laptop
        self.person_class = 0
        self.phone_class = 67
        self.book_class = 73

    def process_frame(self, frame_bgr):
        """
        Runs object detection and pose estimation on the provided BGR image frame.
        Returns:
            persons: list of dicts: {'bbox': [x1, y1, x2, y2], 'conf': float, 'keypoints': np.ndarray or None}
            devices: list of dicts: {'bbox': [x1, y1, x2, y2], 'conf': float, 'class': str}
        """
        h, w = frame_bgr.shape[:2]

        # 1. Detect Persons with Pose estimation
        pose_results = self.pose_model(frame_bgr, conf=self.conf_thresh, verbose=False)[0]
        
        persons = []
        if pose_results.boxes is not None and len(pose_results.boxes) > 0:
            boxes = pose_results.boxes.xyxy.cpu().numpy()
            confs = pose_results.boxes.conf.cpu().numpy()
            
            kps_data = None
            if pose_results.keypoints is not None and pose_results.keypoints.data is not None:
                kps_data = pose_results.keypoints.data.cpu().numpy()

            for i, box in enumerate(boxes):
                x1, y1, x2, y2 = box
                kps = kps_data[i] if kps_data is not None and i < len(kps_data) else None
                
                # Normalize coordinates to 0.0 - 1.0 for player overlay scaling
                norm_bbox = [
                    max(0.0, min(1.0, float(x1) / w)),
                    max(0.0, min(1.0, float(y1) / h)),
                    max(0.0, min(1.0, float(x2) / w)),
                    max(0.0, min(1.0, float(y2) / h))
                ]
                
                persons.append({
                    'bbox_px': [int(x1), int(y1), int(x2), int(y2)],
                    'bbox': norm_bbox,
                    'conf': float(confs[i]),
                    'keypoints': kps
                })

        # 2. Detect cell phones and unauthorized objects
        det_results = self.det_model(frame_bgr, conf=0.30, verbose=False)[0]
        devices = []
        if det_results.boxes is not None and len(det_results.boxes) > 0:
            det_boxes = det_results.boxes.xyxy.cpu().numpy()
            det_confs = det_results.boxes.conf.cpu().numpy()
            det_classes = det_results.boxes.cls.cpu().numpy()

            for i, c in enumerate(det_classes):
                cls_id = int(c)
                if cls_id in [self.phone_class, self.book_class]:
                    x1, y1, x2, y2 = det_boxes[i]
                    cls_name = "cell phone" if cls_id == self.phone_class else "book"
                    norm_bbox = [
                        max(0.0, min(1.0, float(x1) / w)),
                        max(0.0, min(1.0, float(y1) / h)),
                        max(0.0, min(1.0, float(x2) / w)),
                        max(0.0, min(1.0, float(y2) / h))
                    ]
                    devices.append({
                        'bbox_px': [int(x1), int(y1), int(x2), int(y2)],
                        'bbox': norm_bbox,
                        'conf': float(det_confs[i]),
                        'class': cls_name
                    })

        return persons, devices
