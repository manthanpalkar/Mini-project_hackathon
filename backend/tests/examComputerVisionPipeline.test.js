const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// Helper to calculate IoU between two bounding boxes [x1, y1, x2, y2]
function calculateIoU(boxA, boxB) {
  const xA = Math.max(boxA[0], boxB[0]);
  const yA = Math.max(boxA[1], boxB[1]);
  const xB = Math.min(boxA[2], boxB[2]);
  const yB = Math.min(boxA[3], boxB[3]);

  const interWidth = Math.max(0, xB - xA);
  const interHeight = Math.max(0, yB - yA);
  const interArea = interWidth * interHeight;

  const boxAArea = Math.max(1e-6, (boxA[2] - boxA[0]) * (boxA[3] - boxA[1]));
  const boxBArea = Math.max(1e-6, (boxB[2] - boxB[0]) * (boxB[3] - boxB[1]));

  return interArea / (boxAArea + boxBArea - interArea);
}

// Head yaw estimation model
function extractHeadYaw(keypoints) {
  if (!keypoints || keypoints.length < 7) return 0.0;
  const nose = keypoints[0]; // [x, y, conf]
  const lEar = keypoints[3];
  const rEar = keypoints[4];
  const lSh = keypoints[5];
  const rSh = keypoints[6];

  if (lEar[2] > 0.25 && rEar[2] > 0.25 && nose[2] > 0.25) {
    const midEarX = (lEar[0] + rEar[0]) / 2.0;
    const earDist = Math.max(10.0, Math.abs(lEar[0] - rEar[0]));
    const ratio = (nose[0] - midEarX) / earDist;
    return Math.max(-1.0, Math.min(1.0, ratio));
  }

  if (lSh[2] > 0.25 && rSh[2] > 0.25 && nose[2] > 0.25) {
    const midShX = (lSh[0] + rSh[0]) / 2.0;
    const shDist = Math.max(18.0, Math.abs(lSh[0] - rSh[0]));
    const ratio = (nose[0] - midShX) / (shDist * 0.5);
    return Math.max(-1.0, Math.min(1.0, ratio));
  }

  return 0.0;
}

// Direction reversal counter
function countHeadTurns(yawHistory, threshold = 0.18) {
  let turnCount = 0;
  let prevDir = 0;
  for (const { yaw } of yawHistory) {
    const curDir = yaw < -threshold ? -1 : (yaw > threshold ? 1 : 0);
    if (curDir !== 0 && prevDir !== 0 && curDir !== prevDir) {
      turnCount += 1;
    }
    if (curDir !== 0) {
      prevDir = curDir;
    }
  }
  return turnCount;
}

// Phone proximity check
function isPhoneNearTrack(phoneBbox, studentBbox) {
  const [tx1, ty1, tx2, ty2] = studentBbox;
  const [dx1, dy1, dx2, dy2] = phoneBbox;
  const dCx = (dx1 + dx2) / 2.0;
  const dCy = (dy1 + dy2) / 2.0;
  const tW = tx2 - tx1;
  const tH = ty2 - ty1;

  return (
    dCx >= tx1 - 0.25 * tW &&
    dCx <= tx2 + 0.25 * tW &&
    dCy >= ty1 - 0.15 * tH &&
    dCy <= ty2 + 0.35 * tH
  );
}

// Restricted zone check
function isInsideRestrictedZone(point, zone) {
  return (
    point.x >= zone.xMin &&
    point.x <= zone.xMax &&
    point.y >= zone.yMin &&
    point.y <= zone.yMax
  );
}

describe('Module E: Computer Vision Pipeline & Behavioral Detection Logic', () => {
  test('1. IoU calculation correctly identifies overlapping vs separated bounding boxes', () => {
    const box1 = [0.1, 0.1, 0.3, 0.4];
    const box2 = [0.12, 0.11, 0.31, 0.41]; // highly overlapping
    const box3 = [0.6, 0.6, 0.8, 0.9]; // separated

    const iouOverlap = calculateIoU(box1, box2);
    const iouSeparated = calculateIoU(box1, box3);

    assert.ok(iouOverlap > 0.75, `Expected high overlap, got ${iouOverlap}`);
    assert.equal(iouSeparated, 0.0);
  });

  test('2. extractHeadYaw estimates left and right turns accurately', () => {
    // Looking straight: nose centered between ears
    const straightKp = [
      [100, 50, 0.95], // nose
      [90, 45, 0.9], [110, 45, 0.9], // eyes
      [80, 45, 0.9], [120, 45, 0.9], // ears: mid = 100
      [70, 90, 0.9], [130, 90, 0.9]  // shoulders
    ];
    const yawStraight = extractHeadYaw(straightKp);
    assert.ok(Math.abs(yawStraight) < 0.05, `Straight yaw should be near 0, got ${yawStraight}`);

    // Looking left (nose shifted to x=85)
    const turnLeftKp = [
      [85, 50, 0.95],
      [80, 45, 0.9], [95, 45, 0.9],
      [75, 45, 0.9], [120, 45, 0.9], // mid = 97.5, dist = 45 -> (85-97.5)/45 = -0.27
      [70, 90, 0.9], [130, 90, 0.9]
    ];
    const yawLeft = extractHeadYaw(turnLeftKp);
    assert.ok(yawLeft < -0.2, `Turn left yaw should be negative, got ${yawLeft}`);

    // Looking right (nose shifted to x=115)
    const turnRightKp = [
      [115, 50, 0.95],
      [105, 45, 0.9], [120, 45, 0.9],
      [80, 45, 0.9], [125, 45, 0.9], // mid = 102.5, dist = 45 -> (115-102.5)/45 = +0.27
      [70, 90, 0.9], [130, 90, 0.9]
    ];
    const yawRight = extractHeadYaw(turnRightKp);
    assert.ok(yawRight > 0.2, `Turn right yaw should be positive, got ${yawRight}`);
  });

  test('3. Neutral student looking forward does NOT trigger repeated-turn alerts', () => {
    // Continuous readings with minor jitter around zero
    const neutralHistory = [
      { yaw: 0.02 }, { yaw: 0.04 }, { yaw: -0.01 }, { yaw: 0.03 },
      { yaw: -0.02 }, { yaw: 0.01 }, { yaw: 0.02 }, { yaw: -0.01 }
    ];
    const turns = countHeadTurns(neutralHistory, 0.18);
    assert.equal(turns, 0, 'Neutral posture should register zero turns');
  });

  test('4. Repeated direction reversals trigger observable event threshold', () => {
    // Oscillating left-right head movements (looking at adjacent desk and back)
    const turningHistory = [
      { yaw: -0.35 }, // turn left
      { yaw: 0.38 },  // turn right (reversal 1)
      { yaw: -0.32 }, // turn left (reversal 2)
      { yaw: 0.40 }   // turn right (reversal 3)
    ];
    const turns = countHeadTurns(turningHistory, 0.18);
    assert.equal(turns, 3, 'Expected 3 direction reversals');
    assert.ok(turns >= 3, 'Should meet threshold of 3 turns');
  });

  test('5. Phone proximity detection correctly identifies phone on student desk', () => {
    const studentBbox = [0.30, 0.20, 0.60, 0.70]; // student desk area
    const phoneOnDesk = [0.42, 0.60, 0.48, 0.72]; // phone at desk bottom
    const phoneAcrossAisle = [0.85, 0.20, 0.90, 0.30]; // phone on different desk

    assert.equal(isPhoneNearTrack(phoneOnDesk, studentBbox), true);
    assert.equal(isPhoneNearTrack(phoneAcrossAisle, studentBbox), false);
  });

  test('6. Restricted zone entry detects candidate in prohibited area', () => {
    const podiumZone = { xMin: 0.0, yMin: 0.0, xMax: 0.25, yMax: 0.35 };
    const insidePodium = { x: 0.12, y: 0.18 };
    const normalSeat = { x: 0.55, y: 0.45 };

    assert.equal(isInsideRestrictedZone(insidePodium, podiumZone), true);
    assert.equal(isInsideRestrictedZone(normalSeat, podiumZone), false);
  });
});
