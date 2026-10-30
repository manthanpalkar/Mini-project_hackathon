"""
UniVerse Module E — Multi-Person Spatial Object Tracker
Maintains consistent temporary Track IDs across CCTV video frames using IoU & centroid association.
Zero facial biometrics or persistent student identification.
"""

import numpy as np

def calculate_iou(boxA, boxB):
    """Calculates Intersection over Union between two normalized or pixel bounding boxes [x1, y1, x2, y2]."""
    xA = max(boxA[0], boxB[0])
    yA = max(boxA[1], boxB[1])
    xB = min(boxA[2], boxB[2])
    yB = min(boxA[3], boxB[3])

    interWidth = max(0.0, xB - xA)
    interHeight = max(0.0, yB - yA)
    interArea = interWidth * interHeight

    boxAArea = max(1e-6, (boxA[2] - boxA[0]) * (boxA[3] - boxA[1]))
    boxBArea = max(1e-6, (boxB[2] - boxB[0]) * (boxB[3] - boxB[1]))

    return interArea / float(boxAArea + boxBArea - interArea)

def calculate_centroid_distance(boxA, boxB):
    """Calculates normalized Euclidean distance between the centers of two bounding boxes."""
    cA_x = (boxA[0] + boxA[2]) / 2.0
    cA_y = (boxA[1] + boxA[3]) / 2.0
    cB_x = (boxB[0] + boxB[2]) / 2.0
    cB_y = (boxB[1] + boxB[3]) / 2.0
    return float(np.sqrt((cA_x - cB_x)**2 + (cA_y - cB_y)**2))

class ExamTrack:
    def __init__(self, track_id, bbox, bbox_px, conf, keypoints=None):
        self.track_id = track_id
        self.candidate_name = f"Candidate #{track_id:02d}"
        self.bbox = bbox # [x1, y1, x2, y2] normalized
        self.bbox_px = bbox_px
        self.conf = conf
        self.keypoints = keypoints
        self.lost_frames = 0
        self.hits = 1
        self.history = [bbox]
        self.yaw_history = [] # History of head yaw ratios
        self.last_alert_time = {} # Cooldown tracker per event type

    def update(self, bbox, bbox_px, conf, keypoints=None):
        self.bbox = bbox
        self.bbox_px = bbox_px
        self.conf = conf
        if keypoints is not None:
            self.keypoints = keypoints
        self.lost_frames = 0
        self.hits += 1
        self.history.append(bbox)
        if len(self.history) > 60:
            self.history.pop(0)

class ExamPersonTracker:
    def __init__(self, max_lost=18, iou_threshold=0.20, max_centroid_dist=0.14):
        self.next_id = 1
        self.tracks = {} # track_id -> ExamTrack
        self.max_lost = max_lost
        self.iou_threshold = iou_threshold
        self.max_centroid_dist = max_centroid_dist

    def update(self, detections):
        """
        Takes list of person detections:
        [{'bbox': [...], 'bbox_px': [...], 'conf': float, 'keypoints': ...}]
        Returns active matched tracks.
        """
        # If no tracks exist yet, initialize all detections as new tracks
        if len(self.tracks) == 0:
            for det in detections:
                t = ExamTrack(self.next_id, det['bbox'], det['bbox_px'], det['conf'], det.get('keypoints'))
                self.tracks[self.next_id] = t
                self.next_id += 1
            return list(self.tracks.values())

        track_ids = list(self.tracks.keys())
        det_indices = list(range(len(detections)))

        used_tracks = set()
        used_dets = set()

        # Phase 1: High-confidence matching via Bounding Box IoU
        if len(track_ids) > 0 and len(detections) > 0:
            iou_matrix = np.zeros((len(track_ids), len(detections)), dtype=np.float32)
            for i, tid in enumerate(track_ids):
                for j, det in enumerate(detections):
                    iou_matrix[i, j] = calculate_iou(self.tracks[tid].bbox, det['bbox'])

            flat_indices = np.argsort(iou_matrix.ravel())[::-1]
            for idx in flat_indices:
                t_idx = idx // len(detections)
                d_idx = idx % len(detections)
                iou_val = iou_matrix[t_idx, d_idx]

                if iou_val < self.iou_threshold:
                    break

                if t_idx in used_tracks or d_idx in used_dets:
                    continue

                tid = track_ids[t_idx]
                det = detections[d_idx]
                self.tracks[tid].update(det['bbox'], det['bbox_px'], det['conf'], det.get('keypoints'))
                used_tracks.add(t_idx)
                used_dets.add(d_idx)

            # Phase 2: Centroid Proximity Matching for Seated Exam Occlusion Recovery
            # Students stay at desk; if IoU dropped due to leaning/writing, match by nearest desk centroid
            for t_idx, tid in enumerate(track_ids):
                if t_idx in used_tracks:
                    continue
                best_d_idx = None
                best_dist = float('inf')
                for d_idx in det_indices:
                    if d_idx in used_dets:
                        continue
                    dist = calculate_centroid_distance(self.tracks[tid].bbox, detections[d_idx]['bbox'])
                    if dist < self.max_centroid_dist and dist < best_dist:
                        best_dist = dist
                        best_d_idx = d_idx

                if best_d_idx is not None:
                    det = detections[best_d_idx]
                    self.tracks[tid].update(det['bbox'], det['bbox_px'], det['conf'], det.get('keypoints'))
                    used_tracks.add(t_idx)
                    used_dets.add(best_d_idx)

            # Mark unmatched tracks as lost
            for i, tid in enumerate(track_ids):
                if i not in used_tracks:
                    self.tracks[tid].lost_frames += 1

            # Register unmatched detections as new candidate tracks
            for j, det in enumerate(detections):
                if j not in used_dets:
                    new_track = ExamTrack(self.next_id, det['bbox'], det['bbox_px'], det['conf'], det.get('keypoints'))
                    self.tracks[self.next_id] = new_track
                    self.next_id += 1
        else:
            for tid in track_ids:
                self.tracks[tid].lost_frames += 1

        # Purge tracks exceeding max_lost
        dead_ids = [tid for tid, track in self.tracks.items() if track.lost_frames > self.max_lost]
        for tid in dead_ids:
            del self.tracks[tid]

        # Return only currently visible tracks (lost_frames == 0)
        return [track for track in self.tracks.values() if track.lost_frames == 0]
