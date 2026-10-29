"""
UniVerse Module E — Video Ingestion & Processing Pipeline
Orchestrates Video Decoding, Detection, Tracking, and Incident Snapshot Generation.
Supports video files, webcam streams, and RTSP video endpoints.
"""

import cv2
import time
import base64
from .detector import ExamVisionDetector
from .tracker import ExamPersonTracker
from .rules_engine import ExamRulesEngine

def frame_to_base64_thumbnail(frame_bgr, max_width=400):
    """Encodes a downscaled snapshot for privacy-safe evidence storage without bulky raw video retention."""
    h, w = frame_bgr.shape[:2]
    scale = max_width / float(w)
    target_h = int(h * scale)
    thumb = cv2.resize(frame_bgr, (max_width, target_h), interpolation=cv2.INTER_AREA)
    _, buffer = cv2.imencode('.jpg', thumb, [int(cv2.IMWRITE_JPEG_QUALITY), 75])
    encoded = base64.b64encode(buffer).decode('utf-8')
    return f"data:image/jpeg;base64,{encoded}"

class ExamPipeline:
    def __init__(self, 
                 frame_skip=3, 
                 conf_thresh=0.40, 
                 head_turn_thresh=3,
                 phone_conf_thresh=0.35,
                 restricted_zone=None):
        self.frame_skip = max(1, int(frame_skip))
        self.detector = ExamVisionDetector(conf_thresh=conf_thresh)
        self.tracker = ExamPersonTracker(max_lost=15, iou_threshold=0.25)
        self.rules = ExamRulesEngine(
            head_turn_threshold=head_turn_thresh,
            head_turn_window_sec=5.0,
            cooldown_sec=5.0,
            phone_conf_threshold=phone_conf_thresh,
            restricted_zone=restricted_zone
        )

    def process_video_file(self, video_path, max_frames=600):
        """
        Processes an authorized examination video file and extracts frame metadata and incidents.
        Returns:
            frames_meta: list of per-processed-frame metadata for video canvas overlay
            incidents: list of detected incidents with evidence snapshots
            summary: processing statistics (fps, total_frames, active_tracks, alert_tracks)
        """
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Could not open video stream or file at: {video_path}")

        total_file_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        native_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0

        frames_meta = []
        incidents = []
        incident_counter = 1

        processed_count = 0
        current_frame_idx = 0
        start_time = time.time()

        # Active alert cache: track_id -> (expiration_time_sec, label)
        active_track_alerts = {}

        while cap.isOpened() and processed_count < max_frames:
            ret, frame = cap.read()
            if not ret:
                break

            current_frame_idx += 1
            if current_frame_idx % self.frame_skip != 0:
                continue

            t_sec = current_frame_idx / float(native_fps)

            # Clean expired track alerts
            expired_tids = [tid for tid, (exp_t, _) in active_track_alerts.items() if exp_t < t_sec]
            for tid in expired_tids:
                del active_track_alerts[tid]

            # 1. Detection
            t_det_start = time.time()
            persons, devices = self.detector.process_frame(frame)
            
            # 2. Tracking
            tracks = self.tracker.update(persons)

            # 3. Rules & Events
            alerts = self.rules.evaluate_frame(tracks, devices, t_sec)

            # Process any new alerts triggered this frame
            for alert in alerts:
                tid = alert['track_id']
                label = f"REVIEW — Track #{tid}: {alert['event_label']}"
                active_track_alerts[tid] = (t_sec + 4.5, label)

                incidents.append({
                    'incidentId': f"INC-{1000 + incident_counter}",
                    'trackingId': tid,
                    'eventType': alert['event_type'],
                    'eventLabel': alert['event_label'],
                    'videoTimestampSeconds': round(t_sec, 2),
                    'confidence': alert['confidence'],
                    'boundingBox': alert['bbox'],
                    'reviewStatus': 'Pending Review',
                    'evidenceSnapshot': frame_to_base64_thumbnail(frame),
                    'metadata': alert['metadata']
                })
                incident_counter += 1

            # Format per-track overlay data for frontend canvas
            overlay_tracks = []
            for trk in tracks:
                tid = trk.track_id
                is_alert = tid in active_track_alerts
                status_text = active_track_alerts[tid][1] if is_alert else f"NORMAL — Track #{tid}"
                
                overlay_tracks.append({
                    'trackId': tid,
                    'bbox': trk.bbox, # Normalized [x1, y1, x2, y2]
                    'status': 'REVIEW' if is_alert else 'NORMAL',
                    'label': status_text,
                    'conf': round(trk.conf, 2)
                })

            frames_meta.append({
                'frameIdx': current_frame_idx,
                'timestampSec': round(t_sec, 2),
                'tracks': overlay_tracks,
                'detectedPeople': len(overlay_tracks),
                'activeAlerts': len([t for t in overlay_tracks if t['status'] == 'REVIEW'])
            })

            processed_count += 1

        cap.release()
        elapsed_sec = max(0.001, time.time() - start_time)
        measured_fps = round(processed_count / elapsed_sec, 1)

        summary = {
            'totalFrames': total_file_frames,
            'processedFrames': processed_count,
            'durationSeconds': round(total_file_frames / native_fps, 1) if native_fps > 0 else 0,
            'fpsMeasured': measured_fps,
            'elapsedSeconds': round(elapsed_sec, 2),
            'totalIncidents': len(incidents)
        }

        return frames_meta, incidents, summary
