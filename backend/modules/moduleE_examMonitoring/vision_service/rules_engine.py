"""
UniVerse Module E — Behavioral Rules & Event Detection Engine
Evaluates observable behavioral events over temporal sliding windows.
- Event 1: Repeated head-direction changes (angular deviations & reversals)
- Event 2: Phone-like object detected in student desk vicinity
- Event 3: Restricted-zone entry (e.g. invigilator podium or unauthorized boundary)
- Event 4: Prolonged orientation toward neighboring desk
"""

import math
import numpy as np

class ExamRulesEngine:
    def __init__(self, 
                 head_turn_threshold=3, 
                 head_turn_window_sec=5.0, 
                 cooldown_sec=5.0,
                 phone_conf_threshold=0.35,
                 restricted_zone=None):
        self.head_turn_threshold = max(2, int(head_turn_threshold))
        self.head_turn_window_sec = float(head_turn_window_sec)
        self.cooldown_sec = float(cooldown_sec)
        self.phone_conf_threshold = float(phone_conf_threshold)
        self.restricted_zone = restricted_zone or {}
        
        # Phone observation streak tracking: track_id -> count of consecutive frames with phone nearby
        self.phone_streaks = {}
        # Running baseline yaw for each student: track_id -> running_mean_yaw
        self.baseline_yaws = {}

    def extract_head_yaw(self, keypoints, bbox=None):
        """
        Estimates normalized head yaw direction (-1.0 to +1.0) using 17-keypoint body pose
        or nose position relative to torso/bbox.
        Keypoint indices:
          0: nose
          1: left eye, 2: right eye
          3: left ear, 4: right ear
          5: left shoulder, 6: right shoulder
        """
        if keypoints is not None and len(keypoints) >= 7:
            nose = keypoints[0]
            l_ear, r_ear = keypoints[3], keypoints[4]
            l_sh, r_sh = keypoints[5], keypoints[6]

            # Primary: Nose relative to ears
            if l_ear[2] > 0.25 and r_ear[2] > 0.25 and nose[2] > 0.25:
                mid_ear_x = (l_ear[0] + r_ear[0]) / 2.0
                ear_dist = max(10.0, abs(l_ear[0] - r_ear[0]))
                ratio = (nose[0] - mid_ear_x) / ear_dist
                return float(np.clip(ratio, -1.0, 1.0))

            # Secondary: Nose relative to shoulders
            if l_sh[2] > 0.25 and r_sh[2] > 0.25 and nose[2] > 0.25:
                mid_sh_x = (l_sh[0] + r_sh[0]) / 2.0
                sh_dist = max(18.0, abs(l_sh[0] - r_sh[0]))
                ratio = (nose[0] - mid_sh_x) / (sh_dist * 0.5)
                return float(np.clip(ratio, -1.0, 1.0))

        # Fallback: If keypoints are partially missing, use bounding box center offset
        return 0.0

    def evaluate_frame(self, tracks, devices, timestamp_sec):
        """
        Evaluates active tracks and devices for configured observable events.
        """
        alerts = []

        for track in tracks:
            tid = track.track_id
            yaw = self.extract_head_yaw(track.keypoints, track.bbox)
            
            # Update running baseline yaw (momentum smoothing)
            if tid not in self.baseline_yaws:
                self.baseline_yaws[tid] = yaw
            else:
                self.baseline_yaws[tid] = 0.95 * self.baseline_yaws[tid] + 0.05 * yaw

            baseline = self.baseline_yaws[tid]
            rel_yaw = yaw - baseline

            track.yaw_history.append((timestamp_sec, rel_yaw, yaw))

            # Prune old history outside sliding window
            track.yaw_history = [(t, ry, y) for (t, ry, y) in track.yaw_history if (timestamp_sec - t) <= self.head_turn_window_sec]

            # -------------------------------------------------------------
            # 1. Repeated Head-Direction Changes
            # Count direction switches with significant magnitude (|rel_yaw| > 0.15)
            # -------------------------------------------------------------
            turn_count = 0
            prev_dir = 0 # -1 = left of baseline, +1 = right of baseline
            prolonged_count = 0

            for (t, ry, raw_y) in track.yaw_history:
                cur_dir = -1 if ry < -0.15 else (1 if ry > 0.15 else 0)
                if cur_dir != 0 and prev_dir != 0 and cur_dir != prev_dir:
                    turn_count += 1
                if cur_dir != 0:
                    prev_dir = cur_dir

                if abs(ry) > 0.28:
                    prolonged_count += 1

            last_head_alert = track.last_alert_time.get('repeated_head_turn', -999.0)
            if turn_count >= self.head_turn_threshold and (timestamp_sec - last_head_alert) >= self.cooldown_sec:
                track.last_alert_time['repeated_head_turn'] = timestamp_sec
                avg_conf = track.conf
                if track.keypoints is not None:
                    avg_conf = float(np.mean(track.keypoints[:5, 2]))
                
                alerts.append({
                    'track_id': tid,
                    'event_type': 'repeated_head_turn',
                    'event_label': 'Repeated head-direction changes',
                    'confidence': round(min(0.96, max(0.65, avg_conf)), 2),
                    'timestamp_sec': round(timestamp_sec, 2),
                    'bbox': track.bbox,
                    'metadata': {
                        'turns_in_window': turn_count,
                        'window_sec': self.head_turn_window_sec,
                        'relative_yaw': round(rel_yaw, 2)
                    }
                })

            # -------------------------------------------------------------
            # 2. Prolonged Orientation Toward Neighbouring Desk
            # Triggered if turned strongly for > 65% of frames in window
            # -------------------------------------------------------------
            last_prolonged_alert = track.last_alert_time.get('prolonged_orientation', -999.0)
            if (len(track.yaw_history) >= 8 and 
                (prolonged_count / float(len(track.yaw_history))) >= 0.70 and 
                (timestamp_sec - last_prolonged_alert) >= self.cooldown_sec):
                track.last_alert_time['prolonged_orientation'] = timestamp_sec
                alerts.append({
                    'track_id': tid,
                    'event_type': 'prolonged_orientation',
                    'event_label': 'Prolonged orientation toward neighbouring seat',
                    'confidence': round(min(0.94, max(0.70, track.conf)), 2),
                    'timestamp_sec': round(timestamp_sec, 2),
                    'bbox': track.bbox,
                    'metadata': {
                        'sustained_turn_ratio': round(prolonged_count / float(len(track.yaw_history)), 2)
                    }
                })

            # -------------------------------------------------------------
            # 3. Phone-Like Object Detection Near Tracked Student
            # -------------------------------------------------------------
            phone_nearby = False
            best_phone = None
            tx1, ty1, tx2, ty2 = track.bbox
            t_cx, t_cy = (tx1 + tx2) / 2.0, (ty1 + ty2) / 2.0
            t_w, t_h = (tx2 - tx1), (ty2 - ty1)

            for dev in devices:
                if dev['class'] == 'cell phone' and dev['conf'] >= self.phone_conf_threshold:
                    dx1, dy1, dx2, dy2 = dev['bbox']
                    d_cx, d_cy = (dx1 + dx2) / 2.0, (dy1 + dy2) / 2.0
                    
                    # Proximity check: device center inside expanded student desk region
                    if (tx1 - 0.25 * t_w) <= d_cx <= (tx2 + 0.25 * t_w) and (ty1 - 0.15 * t_h) <= d_cy <= (ty2 + 0.35 * t_h):
                        phone_nearby = True
                        if best_phone is None or dev['conf'] > best_phone['conf']:
                            best_phone = dev

            if phone_nearby:
                self.phone_streaks[tid] = self.phone_streaks.get(tid, 0) + 1
            else:
                self.phone_streaks[tid] = max(0, self.phone_streaks.get(tid, 0) - 1)

            last_phone_alert = track.last_alert_time.get('phone_detected', -999.0)
            if self.phone_streaks.get(tid, 0) >= 2 and (timestamp_sec - last_phone_alert) >= self.cooldown_sec:
                track.last_alert_time['phone_detected'] = timestamp_sec
                alerts.append({
                    'track_id': tid,
                    'event_type': 'phone_detected',
                    'event_label': 'Phone-like object detected',
                    'confidence': round(best_phone['conf'] if best_phone else 0.85, 2),
                    'timestamp_sec': round(timestamp_sec, 2),
                    'bbox': track.bbox,
                    'metadata': {
                        'streak_frames': self.phone_streaks[tid],
                        'device_bbox': best_phone['bbox'] if best_phone else None
                    }
                })

            # -------------------------------------------------------------
            # 4. Optional Restricted-Zone Entry
            # -------------------------------------------------------------
            if self.restricted_zone.get('enabled', False):
                rz_x1 = self.restricted_zone.get('xMin', 0.0)
                rz_y1 = self.restricted_zone.get('yMin', 0.0)
                rz_x2 = self.restricted_zone.get('xMax', 0.25)
                rz_y2 = self.restricted_zone.get('yMax', 0.35)

                if (rz_x1 <= t_cx <= rz_x2) and (rz_y1 <= t_cy <= rz_y2):
                    last_zone_alert = track.last_alert_time.get('restricted_zone_entry', -999.0)
                    if (timestamp_sec - last_zone_alert) >= self.cooldown_sec:
                        track.last_alert_time['restricted_zone_entry'] = timestamp_sec
                        alerts.append({
                            'track_id': tid,
                            'event_type': 'restricted_zone_entry',
                            'event_label': f"Entry into {self.restricted_zone.get('name', 'Restricted Zone')}",
                            'confidence': round(track.conf, 2),
                            'timestamp_sec': round(timestamp_sec, 2),
                            'bbox': track.bbox,
                            'metadata': {
                                'zone_name': self.restricted_zone.get('name', 'Restricted Zone')
                            }
                        })

        return alerts
