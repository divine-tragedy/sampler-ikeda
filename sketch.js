let video;
let handPose;
let hands = [];
let audioReady = false;
let audioStarting = false;
let melodyOn = false;
let leftThumbWasUp = false;
let melodyStep = 0;
let worldIndex = 0;

let melodySynth;
let leadSynth;
let glitchSynth;
let kickSynth;
let padOscA;
let padOscB;
let padGain;
let noise;
let noiseGain;
let filter;
let echo;
let pan;
let masterGain;
let melodyLoop;

let previousMiddleTip = null;
let previousMiddleAngle = null;
let circleAmount = 0;
let rightIndexWasPinched = false;
let rightMiddleWasPinched = false;

const canvasW = 640;
const canvasH = 480;
const pinchDistance = 34;

const worlds = [
  {
    name: "Data Pulse",
    bpm: 132,
    notes: [880, 1760, 1320, 990, 2200, 660, 1760, 1100, 0, 2640, 880, 0],
  },
  {
    name: "Glass Grid",
    bpm: 108,
    notes: [523, 784, 1046, 1568, 2093, 1568, 1046, 784, 0, 1175, 1760, 0],
  },
  {
    name: "Low Signal",
    bpm: 96,
    notes: [55, 110, 220, 0, 165, 330, 0, 440, 82, 165, 247, 0],
  },
];

const leftState = {
  thumb: false,
  index: false,
  middle: false,
  ring: false,
  pinky: false,
  pitch: 0,
  echo: 0,
  brightness: 0,
  sparkle: 0,
};

const rightState = {
  index: false,
  indexPinch: false,
  pitch: 0,
  pan: 0,
  middle: false,
  middleSpeed: 0,
  middleCircle: 0,
  middlePinch: false,
  ring: false,
  pad: 0,
  shimmer: 0,
  pinky: false,
  chaos: 0,
  modifier: "none",
};

const connections = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17],
];

function preload() {
  handPose = ml5.handPose({
    flipped: true,
    maxHands: 2,
  });
}

function setup() {
  createCanvas(canvasW, canvasH);

  video = createCapture(VIDEO);
  video.size(canvasW, canvasH);
  video.hide();

  handPose.detectStart(video, (results) => {
    hands = results.slice(0, 2);
  });

  setupAudio();
}

function draw() {
  background(8);

  push();
  translate(width, 0);
  scale(-1, 1);
  image(video, 0, 0, width, height);
  pop();

  updateHandControls();
  drawHands();
  drawPanels();
}

function setupAudio() {
  masterGain = new Tone.Gain(0.7).toDestination();
  filter = new Tone.Filter(1400, "lowpass").connect(masterGain);
  echo = new Tone.FeedbackDelay("16n", 0.18).connect(filter);
  pan = new Tone.Panner(0).connect(echo);

  melodySynth = new Tone.Synth({
    oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: 0.04, sustain: 0.02, release: 0.06 },
  }).connect(pan);

  leadSynth = new Tone.Synth({
    oscillator: { type: "square" },
    envelope: { attack: 0.001, decay: 0.05, sustain: 0.01, release: 0.08 },
  }).connect(pan);

  glitchSynth = new Tone.Synth({
    oscillator: { type: "triangle" },
    envelope: { attack: 0.001, decay: 0.025, sustain: 0, release: 0.03 },
  }).connect(filter);

  kickSynth = new Tone.MembraneSynth({
    pitchDecay: 0.008,
    octaves: 4,
    envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.02 },
  }).connect(filter);

  padGain = new Tone.Gain(0).connect(filter);
  padOscA = new Tone.Oscillator(110, "sine").connect(padGain);
  padOscB = new Tone.Oscillator(165, "sine").connect(padGain);

  noiseGain = new Tone.Gain(0).connect(filter);
  noise = new Tone.Noise("white").connect(noiseGain);

  echo.wet.value = 0;
  filter.Q.value = 1;

  melodyLoop = new Tone.Loop((time) => {
    if (!melodyOn) return;

    const world = worlds[worldIndex];
    const base = world.notes[melodyStep % world.notes.length];
    melodyStep++;

    if (base > 0) {
      const shifted = base * pow(2, map(leftState.pitch, 0, 1, -12, 12) / 12);
      melodySynth.triggerAttackRelease(shifted, "32n", time, 0.5);
    }

    if (leftState.pinky && random() < 0.1 + leftState.sparkle * 0.35) {
      glitchSynth.triggerAttackRelease(random([880, 1760, 2640, 3520]), "64n", time, 0.25);
    }
  }, "8n");
}

async function startAudio() {
  if (audioReady || audioStarting) return;

  audioStarting = true;

  try {
    await Tone.start();
    padOscA.start();
    padOscB.start();
    noise.start();
    melodyLoop.start(0);
    Tone.Transport.bpm.value = worlds[worldIndex].bpm;
    Tone.Transport.start();
    audioReady = true;
  } catch (error) {
    console.log("Audio start failed:", error);
  }

  audioStarting = false;
}

function mousePressed() {
  startAudio();
}

function touchStarted() {
  startAudio();
  return false;
}

function keyPressed() {
  if (key === "1") chooseWorld(0);
  if (key === "2") chooseWorld(1);
  if (key === "3") chooseWorld(2);
}

function chooseWorld(index) {
  worldIndex = constrain(index, 0, worlds.length - 1);
  melodyStep = 0;

  if (audioReady) {
    Tone.Transport.bpm.rampTo(worlds[worldIndex].bpm, 0.2);
  }
}

function updateHandControls() {
  const sorted = getSortedHands();
  const leftHand = getHandBySide(sorted, "Left", 0);
  const rightHand = getHandBySide(sorted, "Right", 1);

  updateLeftHand(leftHand);
  updateRightHand(rightHand);
  updateAudioParams();
}

function updateLeftHand(hand) {
  if (!isValidHand(hand)) {
    leftThumbWasUp = false;
    Object.assign(leftState, {
      thumb: false,
      index: false,
      middle: false,
      ring: false,
      pinky: false,
      pitch: 0,
      echo: 0,
      brightness: 0,
      sparkle: 0,
    });
    return;
  }

  const fingers = getFingers(hand);

  if (fingers.thumb && !leftThumbWasUp) {
    melodyOn = !melodyOn;
  }

  leftThumbWasUp = fingers.thumb;
  leftState.thumb = fingers.thumb;
  leftState.index = fingers.index;
  leftState.middle = fingers.middle;
  leftState.ring = fingers.ring;
  leftState.pinky = fingers.pinky;
  leftState.pitch = fingers.index ? getFingerLevel(hand, 8) : 0;
  leftState.echo = fingers.middle ? getFingerLevel(hand, 12) : 0;
  leftState.brightness = fingers.ring ? getFingerLevel(hand, 16) : 0;
  leftState.sparkle = fingers.pinky ? getFingerLevel(hand, 20) : 0;
}

function updateRightHand(hand) {
  if (!isValidHand(hand)) {
    resetRightState();
    return;
  }

  const fingers = getFingers(hand);
  const indexTip = hand.keypoints[8];
  const middleTip = hand.keypoints[12];
  const ringTip = hand.keypoints[16];
  const pinkyTip = hand.keypoints[20];
  const wrist = hand.keypoints[0];
  const speed = previousMiddleTip ? dist(middleTip.x, middleTip.y, previousMiddleTip.x, previousMiddleTip.y) : 0;
  const indexPinch = isPinching(hand, 8);
  const middlePinch = isPinching(hand, 12);

  rightState.index = fingers.index;
  rightState.indexPinch = indexPinch;
  rightState.pitch = constrain(map(indexTip.y, height, 0, 0, 1), 0, 1);
  rightState.pan = constrain(map(indexTip.x, 0, width, -1, 1), -1, 1);
  rightState.middle = fingers.middle;
  rightState.middleSpeed = constrain(map(speed, 0, 60, 0, 1), 0, 1);
  rightState.middleCircle = getCircleGesture(middleTip, wrist);
  rightState.middlePinch = middlePinch;
  rightState.ring = fingers.ring;
  rightState.pad = fingers.ring ? getFingerLevel(hand, 16) : 0;
  rightState.shimmer = fingers.ring ? constrain(map(ringTip.y, height, 0, 0, 1), 0, 1) : 0;
  rightState.pinky = fingers.pinky;
  rightState.chaos = fingers.pinky ? constrain(map(pinkyTip.y, height, 0, 0, 1), 0, 1) : 0;
  rightState.modifier = getModifier(hand);

  if (audioReady && indexPinch && !rightIndexWasPinched) {
    triggerLead();
  }

  if (audioReady && fingers.middle && speed > 24) {
    kickSynth.triggerAttackRelease(45 + speed * 3, "32n", undefined, 0.28);
  }

  if (audioReady && fingers.middle && rightState.middleCircle > 0.55 && frameCount % 3 === 0) {
    glitchSynth.triggerAttackRelease(random([220, 440, 880, 1760]), "64n", undefined, 0.2);
  }

  if (audioReady && middlePinch && !rightMiddleWasPinched) {
    triggerRhythmBurst();
  }

  previousMiddleTip = { x: middleTip.x, y: middleTip.y };
  rightIndexWasPinched = indexPinch;
  rightMiddleWasPinched = middlePinch;
}

function resetRightState() {
  Object.assign(rightState, {
    index: false,
    indexPinch: false,
    pitch: 0,
    pan: 0,
    middle: false,
    middleSpeed: 0,
    middleCircle: 0,
    middlePinch: false,
    ring: false,
    pad: 0,
    shimmer: 0,
    pinky: false,
    chaos: 0,
    modifier: "none",
  });

  previousMiddleTip = null;
  previousMiddleAngle = null;
  circleAmount = 0;
  rightIndexWasPinched = false;
  rightMiddleWasPinched = false;
}

function updateAudioParams() {
  if (!echo || !filter || !pan || !padGain || !noiseGain) return;

  const echoAmount = max(leftState.echo, rightState.shimmer * 0.45);
  const brightAmount = leftState.ring ? leftState.brightness : 0.35;
  const noiseAmount = max(
    leftState.pinky ? map(leftState.sparkle, 0, 1, 0.005, 0.08) : 0,
    rightState.pinky ? map(rightState.chaos, 0, 1, 0.02, 0.2) : 0
  );

  echo.wet.rampTo(echoAmount, 0.06);
  echo.feedback.rampTo(map(echoAmount, 0, 1, 0.08, 0.68), 0.06);
  filter.frequency.rampTo(map(brightAmount, 0, 1, 260, 6200), 0.06);
  filter.Q.rampTo(map(brightAmount, 0, 1, 0.8, 5), 0.06);
  pan.pan.rampTo(rightState.pan, 0.04);
  padGain.gain.rampTo(rightState.ring ? rightState.pad * 0.28 : 0, 0.12);
  noiseGain.gain.rampTo(noiseAmount, 0.04);

  if (rightState.pinky && audioReady && random() < 0.02 + rightState.chaos * 0.08) {
    triggerChaos();
  }
}

function triggerLead() {
  if (!audioReady) return;

  const baseFrequency = map(rightState.pitch, 0, 1, 90, 2600);
  let frequency = baseFrequency;
  let duration = "32n";
  let velocity = 0.55;

  if (rightState.modifier === "distorted") {
    velocity = 0.9;
    duration = "16n";
    noiseGain.gain.rampTo(0.12, 0.01);
    noiseGain.gain.rampTo(0.02, 0.08);
  }

  if (rightState.modifier === "octave") {
    frequency *= 2;
  }

  if (rightState.modifier === "granular") {
    for (let i = 0; i < 6; i++) {
      leadSynth.triggerAttackRelease(
        baseFrequency * random(0.5, 2.5),
        "64n",
        Tone.now() + i * 0.018,
        random(0.18, 0.45)
      );
    }
    return;
  }

  leadSynth.triggerAttackRelease(frequency, duration, undefined, velocity);
}

function triggerRhythmBurst() {
  if (!audioReady) return;

  for (let i = 0; i < 5; i++) {
    glitchSynth.triggerAttackRelease(random([180, 360, 720, 1440]), "64n", Tone.now() + i * 0.045, 0.28);
  }
}

function triggerChaos() {
  if (!audioReady) return;

  const frequency = random([110, 220, 440, 880, 1760, 3520]);
  const duration = random(["64n", "32n"]);
  glitchSynth.triggerAttackRelease(frequency, duration, undefined, random(0.1, 0.5));
}

function drawHands() {
  const sorted = getSortedHands();

  for (let i = 0; i < sorted.length; i++) {
    const hand = sorted[i];
    const isLeft = i === 0;
    const pointColor = isLeft ? color(0, 210, 255) : color(255, 80, 180);
    const lineColor = isLeft ? color(0, 210, 255, 150) : color(255, 80, 180, 150);

    stroke(lineColor);
    strokeWeight(3);
    for (let j = 0; j < connections.length; j++) {
      const a = hand.keypoints[connections[j][0]];
      const b = hand.keypoints[connections[j][1]];
      line(a.x, a.y, b.x, b.y);
    }

    noStroke();
    fill(pointColor);
    for (let j = 0; j < hand.keypoints.length; j++) {
      circle(hand.keypoints[j].x, hand.keypoints[j].y, 10);
    }

    const wrist = hand.keypoints[0];
    const label = isLeft ? "Left controls" : "Right performance";
    textSize(13);
    fill(pointColor);
    rect(wrist.x - 8, wrist.y - 34, textWidth(label) + 18, 24, 4);
    fill(0);
    textAlign(LEFT, CENTER);
    text(label, wrist.x, wrist.y - 22);
  }
}

function drawPanels() {
  noStroke();
  fill(0, 180);
  rect(12, 12, 240, 100, 6);
  fill(255);
  textSize(14);
  textAlign(LEFT, TOP);
  text("Ikeda Hand Sampler", 24, 24);
  text(audioReady ? "Audio ready" : "Click canvas to start audio", 24, 46);
  text("World " + (worldIndex + 1) + ": " + worlds[worldIndex].name, 24, 68);
  text("Hands detected: " + hands.length, 24, 90);

  const x = width - 260;
  const y = 12;
  fill(0, 180);
  rect(x, y, 248, 318, 6);
  fill(255);
  textSize(14);
  text("Left hand", x + 14, y + 14);
  drawRow("Thumb", melodyOn ? "melody on" : "melody off", leftState.thumb, melodyOn ? 1 : 0, x + 14, y + 40);
  drawRow("Index", "pitch", leftState.index, leftState.pitch, x + 14, y + 62);
  drawRow("Middle", "echo", leftState.middle, leftState.echo, x + 14, y + 84);
  drawRow("Ring", "brightness", leftState.ring, leftState.brightness, x + 14, y + 106);
  drawRow("Pinky", "sparkle", leftState.pinky, leftState.sparkle, x + 14, y + 128);

  fill(255);
  textSize(14);
  text("Right hand", x + 14, y + 166);
  textSize(12);
  text("Thumb mode: " + rightState.modifier, x + 14, y + 187);
  drawRow("Index", "lead", rightState.indexPinch, rightState.pitch, x + 14, y + 210);
  drawRow("Middle", "glitch", rightState.middle, max(rightState.middleSpeed, rightState.middleCircle), x + 14, y + 232);
  drawRow("Ring", "pad", rightState.ring, rightState.pad, x + 14, y + 254);
  drawRow("Pinky", "chaos", rightState.pinky, rightState.chaos, x + 14, y + 276);
}

function drawRow(name, label, active, level, x, y) {
  fill(active ? color(0, 210, 255) : color(80));
  circle(x + 6, y + 7, 9);
  fill(255);
  textSize(12);
  textAlign(LEFT, TOP);
  text(name + " - " + label, x + 18, y);
  fill(65);
  rect(x + 146, y + 3, 72, 7, 3);
  fill(active ? color(255, 80, 180) : color(130));
  rect(x + 146, y + 3, 72 * constrain(level, 0, 1), 7, 3);
}

function getSortedHands() {
  return hands
    .slice()
    .filter(isValidHand)
    .sort((a, b) => getHandCenterX(a) - getHandCenterX(b));
}

function isValidHand(hand) {
  if (!hand || !hand.keypoints || hand.keypoints.length < 21) return false;

  for (let i = 0; i < 21; i++) {
    const point = hand.keypoints[i];
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      return false;
    }
  }

  return true;
}

function getHandBySide(sortedHands, label, fallbackIndex) {
  const hasHandednessLabels = sortedHands.some((hand) => hand.handedness);

  for (let i = 0; i < sortedHands.length; i++) {
    if (sortedHands[i].handedness === label) {
      return sortedHands[i];
    }
  }

  if (hasHandednessLabels) {
    return null;
  }

  return sortedHands[fallbackIndex] || null;
}

function getHandCenterX(hand) {
  if (!isValidHand(hand)) return width / 2;

  let total = 0;

  for (let i = 0; i < hand.keypoints.length; i++) {
    total += hand.keypoints[i].x;
  }

  return total / hand.keypoints.length;
}

function getFingers(hand) {
  return {
    thumb: isFingerUp(hand, 4, 2),
    index: isFingerUp(hand, 8, 6),
    middle: isFingerUp(hand, 12, 10),
    ring: isFingerUp(hand, 16, 14),
    pinky: isFingerUp(hand, 20, 18),
  };
}

function isFingerUp(hand, tipIndex, jointIndex) {
  const tip = hand.keypoints[tipIndex];
  const joint = hand.keypoints[jointIndex];

  return tip.y < joint.y - 12;
}

function getFingerLevel(hand, tipIndex) {
  const tip = hand.keypoints[tipIndex];
  const wrist = hand.keypoints[0];

  return constrain(map(tip.y, wrist.y + 40, wrist.y - 190, 0, 1), 0, 1);
}

function isPinching(hand, tipIndex) {
  const thumb = hand.keypoints[4];
  const tip = hand.keypoints[tipIndex];

  return dist(thumb.x, thumb.y, tip.x, tip.y) < pinchDistance;
}

function getModifier(hand) {
  if (isPinching(hand, 12)) return "distorted";
  if (isPinching(hand, 16)) return "octave";
  if (isPinching(hand, 20)) return "granular";
  if (isPinching(hand, 8)) return "normal";

  return "none";
}

function getCircleGesture(point, center) {
  const angle = atan2(point.y - center.y, point.x - center.x);

  if (previousMiddleAngle === null) {
    previousMiddleAngle = angle;
    return 0;
  }

  let delta = angle - previousMiddleAngle;
  if (delta > PI) delta -= TWO_PI;
  if (delta < -PI) delta += TWO_PI;

  previousMiddleAngle = angle;
  circleAmount = constrain(circleAmount * 0.92 + abs(delta) * 0.65, 0, 1);

  return circleAmount;
}
