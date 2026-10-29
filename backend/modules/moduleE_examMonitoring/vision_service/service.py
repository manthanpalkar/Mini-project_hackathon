"""
UniVerse Module E — Computer Vision Microservice (FastAPI)
Internal microservice running on port 5005 for high-speed multi-person CCTV analysis.
"""

import os
import cv2
import time
import base64
import numpy as np
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any, List

from .pipeline import ExamPipeline, frame_to_base64_thumbnail
from .detector import ExamVisionDetector

app = FastAPI(title="UniVerse Module E Vision Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Persistent singleton detector and pipeline instance to avoid reloading models per request
shared_detector = None
pipeline_instance = None

def get_shared_detector():
    global shared_detector
    if shared_detector is None:
        print("[Module E Vision] Instantiating shared YOLOv8 + pose detector...")
        shared_detector = ExamVisionDetector()
    return shared_detector

def get_pipeline(frame_skip=3, head_turn_thresh=3, phone_conf_thresh=0.35, restricted_zone=None):
    detector = get_shared_detector()
    return ExamPipeline(
        frame_skip=frame_skip,
        conf_thresh=0.40,
        head_turn_thresh=head_turn_thresh,
        phone_conf_thresh=phone_conf_thresh,
        restricted_zone=restricted_zone,
        detector=detector
    )

@app.on_event("startup")
def startup_event():
    global pipeline_instance
    print("[Module E Vision] Initializing YOLO and pose models on startup...")
    detector = get_shared_detector()
    # Warmup inference with dummy frame
    try:
        dummy = np.zeros((480, 640, 3), dtype=np.uint8)
        detector.process_frame(dummy)
        print(f"[Module E Vision] Warmup complete on accelerator: {detector.device}")
    except Exception as e:
        print(f"[Module E Vision] Warmup notice: {e}")
    pipeline_instance = get_pipeline()
    print(f"[Module E Vision] Service ready on port 5005 (device: {detector.device}).")

@app.get("/health")
def health_check():
    detector = get_shared_detector()
    return {
        "service": "UniVerse Module E Vision Service",
        "status": "ready",
        "version": "1.0.0",
        "device": detector.device,
        "models": ["yolov8n.pt", "yolov8n-pose.pt"],
        "capabilities": [
            "multi_student_tracking",
            "repeated_head_turn_detection",
            "phone_device_detection",
            "restricted_zone_monitoring",
            "privacy_preserving_bounding_boxes"
        ]
    }

class AnalyzeVideoRequest(BaseModel):
    video_path: str
    frame_skip: Optional[int] = 3
    head_turn_threshold: Optional[int] = 3
    phone_conf_threshold: Optional[float] = 0.35
    restricted_zone: Optional[Dict[str, Any]] = None
    max_frames: Optional[int] = 500

@app.post("/analyze_video")
def analyze_video(req: AnalyzeVideoRequest):
    if not os.path.exists(req.video_path):
        raise HTTPException(status_code=404, detail=f"Video file not found at: {req.video_path}")

    try:
        pipeline = get_pipeline(
            frame_skip=req.frame_skip,
            head_turn_thresh=req.head_turn_threshold,
            phone_conf_thresh=req.phone_conf_threshold,
            restricted_zone=req.restricted_zone
        )
        frames_meta, incidents, summary = pipeline.process_video_file(req.video_path, max_frames=req.max_frames)
        return {
            "success": True,
            "summary": summary,
            "incidents": incidents,
            "frames": frames_meta
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Video analysis error: {str(e)}")

class LiveFrameRequest(BaseModel):
    image_base64: str
    frame_index: Optional[int] = 0
    timestamp_sec: Optional[float] = 0.0

@app.post("/process_live_frame")
def process_live_frame(req: LiveFrameRequest):
    global pipeline_instance
    if pipeline_instance is None:
        pipeline_instance = get_pipeline()

    try:
        # Decode base64 frame
        data = req.image_base64.split(",")[-1]
        img_bytes = base64.b64decode(data)
        np_arr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if frame is None:
            raise HTTPException(status_code=400, detail="Invalid image payload")

        t_sec = req.timestamp_sec or time.time()
        persons, devices = pipeline_instance.detector.process_frame(frame)
        tracks = pipeline_instance.tracker.update(persons)
        alerts = pipeline_instance.rules.evaluate_frame(tracks, devices, t_sec)

        overlay_tracks = []
        for trk in tracks:
            # Check if this track was flagged
            is_alert = any(a['track_id'] == trk.track_id for a in alerts)
            label = f"REVIEW — Track #{trk.track_id}: {alerts[0]['event_label']}" if is_alert else f"NORMAL — Track #{trk.track_id}"
            overlay_tracks.append({
                'trackId': trk.track_id,
                'bbox': trk.bbox,
                'status': 'REVIEW' if is_alert else 'NORMAL',
                'label': label,
                'conf': round(trk.conf, 2)
            })

        return {
            "success": True,
            "tracks": overlay_tracks,
            "detectedPeople": len(overlay_tracks),
            "alerts": alerts
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Live frame error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.modules.moduleE_examMonitoring.vision_service.service:app", host="127.0.0.1", port=5005, reload=False)
