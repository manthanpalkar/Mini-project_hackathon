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

class ExamTrack:
    def __init__(self, track_id, bbox, bbox_px, conf, keypoints=None):
        self.track_id = track_id
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
    def __init__(self, max_lost=15, iou_threshold=0.25):
        self.next_id = 1
        self.tracks = {} # track_id -> ExamTrack
        self.max_lost = max_lost
        self.iou_threshold = iou_threshold

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

        # Build Cost / IoU Matrix
        matched_pairs = []
        if len(track_ids) > 0 and len(detections) > 0:
            iou_matrix = np.zeros((len(track_ids), len(detections)), dtype=np.float32)
            for i, tid in enumerate(track_ids):
                for j, det in enumerate(detections):
                    iou_matrix[i, j] = calculate_iou(self.tracks[tid].bbox, det['bbox'])

            # Greedy matching by maximum IoU
            used_tracks = set()
            used_dets = set()

            # Flatten and sort pairs by IoU descending
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
                matched_pairs.append((tid, d_idx))

            # Mark unmatched tracks as lost
            for i, tid in enumerate(track_ids):
                if i not in used_tracks:
                    self.tracks[tid].lost_frames += 1

            # Register unmatched detections as new tracks
            for j, det in enumerate(detections):
                if j not in used_dets:
                    new_track = ExamTrack(self.next_id, det['bbox'], det['bbox_px'], det['conf'], det.get('keypoints'))
                    self.tracks[self.next_id] = new_track
                    self.next_id += 1
        else:
            # No detections in frame, increment lost on all tracks
            for tid in track_ids:
                self.tracks[tid].lost_frames += 1

        # Purge tracks exceeding max_lost
        dead_ids = [tid for tid, track in self.tracks.items() if track.lost_frames > self.max_lost]
        for tid in dead_ids:
            del self.tracks[tid]

        # Return only visible tracks (lost_frames == 0)
        return [track for track in self.tracks.values() if track.lost_frames == 0]
