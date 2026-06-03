let video;
let handPose;
let hands = [];
let bodyPose;
let bodyPoses = [];
let bodyPoseStarted = false;
let bodyPoseLoading = false;
let bodyPoseError = "";
let handPoseStarted = false;
let ml5ScriptRequested = false;
let handPoseLoading = false;
let handPoseError = "";
let handPoseFramePending = false;
let performerCenterX = null;
let audioReady = false;
let audioStarting = false;
let lastAudioStartAttempt = 0;

let activeProcessKey = null;
let previousProcessKey = null;
let lastPerformingProcessKey = null;
let leftThumbWasOpen = false;
let leftPinchWasActive = false;
let leftOpenPalmWasActive = false;
let rightPinchActive = false;
let lastSampleGridCell = null;
let lastSampleGridAt = 0;
let selectedSampleGridCell = null;
let selectedSampleGridCells = { left: null, right: null };
let lastSampleGridCells = { left: null, right: null };
let lastSampleEvents = { left: null, right: null };
let sampleModeWasActive = false;
let saveCooldownUntil = 0;
let stableActiveFinger = null;
let pendingFingerCount = null;
let pendingFingerFrames = 0;
let missingFingerFrames = 0;
let activeMode = null;
let candidateMode = null;
let hoverWrist = null;
let dwellStartTime = 0;
let dwellProgress = 0;
let activeInstructionText = "select a sound";
let lastClapTime = 0;
let clapCooldown = 700;
let isClapActive = false;
let previousWristDistance = null;
let previousWristDistanceAt = 0;
let bodyLeftWrist = null;
let bodyRightWrist = null;
let bodyLeftShoulder = null;
let bodyRightShoulder = null;
let smoothedBodyLeftWrist = null;
let smoothedBodyRightWrist = null;
let smoothedBodyLeftShoulder = null;
let smoothedBodyRightShoulder = null;

let audioEngine;
let loopManager;
let visualSystem;
let systemMessage = "";
let drawErrorMessage = "";
let audioModulationEnabled = true;
let pendingAudioEvents = [];
let pendingSampleLoopEvent = null;
let lastLiveDroneAt = 0;
let lastLiveLeadAt = 0;
let selectedDroneChordIndex = 0;
let lastLivePercussionAt = 0;
let lastLiveClickAt = 0;
let lastGestureEvents = {};
let percussionSubdivisionValue = 0.45;
let percussionDensityValue = 0.32;
let clickPatternValue = 0.35;
let clickDensityValue = 0.3;
let clickHarmonyValue = 0.45;
let leadInstabilityValue = 0.2;
let leadSpeedValue = 0;
let lastLeadPoint = null;
let lastLeadPointAt = 0;

const canvasW = 1048;
const canvasH = 756;
const stillThreshold = 3.4;
const stillSaveTime = 2000;
const saveCooldown = 1400;
const parameterLoopLength = 5000;
const parameterRecordInterval = 70;
const loopLifetimeCycles = 5;
const fingerModeSwitchFrames = 8;
const fingerModeMissingFrames = 15;
const instructionBarHeight = 16;
const modeButtonHeight = 16;
const modeDwellDuration = 1500;
const performanceTop = instructionBarHeight + modeButtonHeight;
const modeActivationHitHeight = 96;
const sampleGridTop = performanceTop + 72;

const processOrder = ["loopCreator", "motion", "texture", "space", "decay"];
const modeButtons = [
  { mode: "click", key: "texture" },
  { mode: "percussion", key: "motion" },
  { mode: "drone", key: "loopCreator" },
  { mode: "lead", key: "space" },
  { mode: "sample", key: "decay" },
];
const modeToProcessKey = {
  drone: "loopCreator",
  percussion: "motion",
  click: "texture",
  lead: "space",
  sample: "decay",
};

const processNames = {
  loopCreator: "1 Finger / Drone Chord",
  motion: "2 Fingers / Percussive Loop",
  texture: "3 Fingers / Click Pattern",
  space: "4 Fingers / Lead",
  decay: "5 Fingers / Sample Grid",
};

const processShortNames = {
  loopCreator: "DRONE",
  motion: "PERC",
  texture: "CLICKS",
  space: "LEAD",
  decay: "SAMPLE",
};

const processColors = {
  loopCreator: [255, 228, 92],
  motion: [255, 42, 185],
  texture: [120, 255, 0],
  space: [35, 80, 255],
  decay: [255, 76, 42],
};

const fingerTips = { thumb: 4, index: 8, middle: 12, ring: 16, pinky: 20 };
const fingerJoints = { thumb: 2, index: 6, middle: 10, ring: 14, pinky: 18 };
const fingerOrder = ["thumb", "index", "middle", "ring", "pinky"];
const requiredFingerModes = [
  ["index"],
  ["thumb", "index"],
  ["thumb", "index", "middle"],
  ["thumb", "index", "middle", "ring"],
  ["thumb", "index", "middle", "ring", "pinky"],
];
const leftParamKeys = ["density", "variation", "depth", "chance"];

const connections = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17],
];

const scaleBanks = [
  ["C2", "Eb2", "G2", "C3", "Eb3", "F3", "G3", "Bb3", "C4", "Eb4", "G4"],
  ["D2", "F2", "A2", "D3", "F3", "G3", "A3", "C4", "D4", "F4", "A4"],
  ["A1", "C2", "E2", "A2", "C3", "D3", "E3", "G3", "A3", "C4", "E4"],
];
const fixedScale = ["C2", "Eb2", "F2", "G2", "Bb2", "C3", "Eb3", "F3", "G3", "Bb3", "C4"];
const chordBank = [
  ["C2", "G2", "Eb3"],
  ["Eb2", "Bb2", "G3"],
  ["F2", "C3", "G3"],
  ["G2", "D3", "Bb3"],
  ["Bb2", "F3", "C4"],
];
const droneChordBank = [
  ["C2", "G2", "D3", "Eb3"],
  ["A2", "E3", "G3", "C4"],
  ["F2", "C3", "G3", "A3"],
  ["Eb2", "Bb2", "D3", "G3"],
];
const rhythmSubdivisions = [1, 2, 3, 4, 6, 8];
const samplePaths = [
  "sounds/Female-Evil-Laugh.wav",
  "sounds/Lakker-Tuk-tuk.mp3",
  "sounds/My-Girl-is-Crying.mp3",
  "sounds/Old-Ladies-Pets.wav",
  "sounds/SR006F.wav",
  "sounds/Scratching-Strings.wav",
  "sounds/Thats-My-Laugh.wav",
  "sounds/aoaoa.mp3",
  "sounds/climax1.mp3",
  "sounds/oh-so.mp3",
  "sounds/sample1.mp3",
  "sounds/text/Balkan-Central-Europe.mp3",
  "sounds/text/Hello-MyNameIsBjork.mp3",
  "sounds/text/Cyberstress.mp3",
  "sounds/text/Bjork-Interview-1996.mp3",
  "sounds/text/Jodie-Foster-Gay-Silence.mp3",
  "sounds/text/KeroKeroBonito-I'dRatherSleep.mp3",
  "sounds/text/MakeMeMoo-TheResidents.mp3",
  "sounds/text/Weirdcore-Analysis.mp3",
  "sounds/text/YungLean-Hurt.mp3",
];
const sampleGridCols = 5;
const sampleGridRows = 4;
let selectedNote = "C3";
let selectedFilter = 0.5;
let selectedSampleIndex = 0;

const defaultParams = {
  density: 0.18,
  variation: 0.18,
  depth: 0.24,
  chance: 0.08,
};

const processProfiles = {
  loopCreator: { density: 0.24, variation: 0.18, depth: 0.28, chance: 0.08 },
  motion: { density: 0.18, variation: 0.34, depth: 0.2, chance: 0.12 },
  texture: { density: 0.22, variation: 0.18, depth: 0.34, chance: 0.16 },
  space: { density: 0.15, variation: 0.16, depth: 0.42, chance: 0.08 },
  decay: { density: 0.14, variation: 0.2, depth: 0.3, chance: 0.26 },
};

let layers = {};
let loopMemories = [];
let particles = [];
let savedBlocks = [];
let audioAnalysis = {
  amp: 0,
  bass: 0,
  mid: 0,
  treble: 0,
  waveform: [],
  fft: [],
};

function preload() {
}

function setup() {
  createCanvas(448, 257);
  pixelDensity(1);
  frameRate(30);
  textFont("monospace");

  function keyPressed() {
  if (key === 'f' || key === 'F') {
    let fs = fullscreen();
    fullscreen(true);
  }
}

  try {
    video = createCapture(VIDEO);
    video.size(width, height);
    video.elt.setAttribute("playsinline", "true");
    video.elt.muted = true;
    video.elt.play().catch((error) => {
      systemMessage = "allow camera / camera starting";
      console.error(error);
    });
    video.hide();

    startHandTrackingWhenReady();
  } catch (error) {
    systemMessage = "camera could not start: " + error.message;
    console.error(error);
  }

  setupLayers();
  visualSystem = new VisualSystem();
  try {
    audioEngine = new AudioEngine();
    loopManager = new LoopManager(audioEngine);
  } catch (error) {
    systemMessage = "audio setup paused until interaction";
    console.error(error);
  }
}

function draw() {
  try {
    startHandTrackingWhenReady();
    drawFrame();
  } catch (error) {
    drawErrorMessage = error.message;
    console.error(error);
    drawFallbackFrame();
  }
}

function startBodyPoseWhenReady() {
  if (bodyPoseStarted || !video) return;
  if (typeof ml5 === "undefined" || typeof ml5.bodyPose !== "function") {
    bodyPoseError = "body tracking library is loading";
    activeInstructionText = "body tracking loading";
    return;
  }
  if (!bodyPose && !bodyPoseLoading) {
    bodyPoseLoading = true;
    try {
      bodyPose = ml5.bodyPose("MoveNet", { modelType: "SINGLEPOSE_LIGHTNING", flipped: true }, () => {
        bodyPoseLoading = false;
        bodyPoseError = "";
      });
    } catch (error) {
      bodyPoseLoading = false;
      bodyPoseError = error.message || "body tracking failed";
      console.error(error);
      return;
    }
  }
  if (!bodyPose || bodyPoseLoading || !video.elt || typeof bodyPose.detectStart !== "function") {
    activeInstructionText = bodyPoseLoading ? "body tracking loading" : "body tracking starting";
    return;
  }
  bodyPoseStarted = true;
  try {
    bodyPose.detectStart(video.elt, handleBodyPoseResults);
  } catch (error) {
    bodyPoseStarted = false;
    bodyPoseError = error.message || "body tracking failed";
    console.error(error);
  }
}

function handleBodyPoseResults(results) {
  bodyPoses = Array.isArray(results) ? results : [];
}

function startHandTrackingWhenReady() {
  if (handPoseStarted || !video) return;
  if (typeof Hands === "undefined") {
    systemMessage = "hand tracking library is loading";
    return;
  }
  if (!handPose && !handPoseLoading) {
    handPoseLoading = true;
    handPose = new Hands({
      locateFile: (file) => "libraries/mediapipe/hands/" + file,
    });
    handPose.setOptions({
      maxNumHands: 2,
      modelComplexity: 0,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.45,
      selfieMode: true,
    });
    handPose.onResults(handleMediaPipeHands);
    handPoseLoading = false;
  }
  if (!handPose || !video.elt) {
    systemMessage = handPoseLoading ? "hand tracking model is loading" : "hand tracking library is loading";
    return;
  }
  handPoseStarted = true;
  handPoseError = "";
  systemMessage = "";
  requestAnimationFrame(detectHandsFrame);
}

async function detectHandsFrame() {
  if (!handPoseStarted || !handPose || !video || !video.elt) return;
  if (!handPoseFramePending && video.elt.readyState >= 2) {
    handPoseFramePending = true;
    try {
      await handPose.send({ image: video.elt });
      handPoseError = "";
    } catch (error) {
      handPoseError = error.message || "frame failed";
      systemMessage = "hand tracking frame skipped";
      console.error(error);
    }
    handPoseFramePending = false;
  }
  requestAnimationFrame(detectHandsFrame);
}

function handleMediaPipeHands(results) {
  const landmarks = results.multiHandLandmarks || [];
  const handedness = results.multiHandedness || [];
  hands = landmarks.slice(0, 2).map((points, index) => {
    const classification = handedness[index] || null;
    return {
      handedness: classification ? classification.label : null,
      confidence: classification ? classification.score : 1,
      keypoints: points.map((point) => ({
        x: point.x * width,
        y: point.y * height,
        z: point.z || 0,
      })),
    };
  });
}

function drawFrame() {
  const body = BodyPoseTracker.getPrimaryPose(bodyPoses);
  updateBodyPosePoints(body);
  const trackedHands = HandTracker.getPerformanceHands(HandTracker.getSinglePerformerHands(hands));
  const menuPoint = getHandControlPoint(trackedHands.rightHand) || getHandControlPoint(trackedHands.leftHand) || bodyRightWrist || bodyLeftWrist;
  updateModeDwellSelection(menuPoint);
  const leftHand = trackedHands.leftHand || createBodyHand(bodyLeftWrist, bodyLeftShoulder, "Left");
  const rightHand = trackedHands.rightHand || createBodyHand(bodyRightWrist, bodyRightShoulder, "Right");
  const activeFinger = createModeGesture(activeMode, bodyRightWrist || bodyLeftWrist);
  const gesturePoint = getBodyPerformancePoint(activeMode, bodyLeftWrist, bodyRightWrist) || (activeFinger ? activeFinger.point : null);
  audioAnalysis = readAudioAnalysis();

  if (!audioReady && !audioStarting && (activeMode || bodyRightWrist || bodyLeftWrist) && millis() - lastAudioStartAttempt > 250) {
    startAudioFromHands();
  }

  const leftOpenPalmActive = false;

  activeProcessKey = activeFinger ? activeFinger.processKey : null;
  const visualGesturePoint = activeProcessKey === "loopCreator" ? bodyRightWrist : gesturePoint;
  rightPinchActive = detectClap(bodyLeftWrist, bodyRightWrist, bodyLeftShoulder, bodyRightShoulder);
  if (rightPinchActive) handleClap(activeMode, rightHand, leftHand);
  if (activeProcessKey && !rightPinchActive) {
    lastPerformingProcessKey = activeProcessKey;
  }
  if (activeProcessKey !== previousProcessKey) {
    resetStillTracking();
    previousProcessKey = activeProcessKey;
  }

  updateProcessTargets(rightHand);
  if (!leftOpenPalmActive) {
    updateControlAxes(leftHand, rightHand, activeFinger);
    updateSampleGrid(leftHand, rightHand, activeFinger);
    recordActiveProcessParams();
    updateAudioSafely(gesturePoint);
  }
  updateProcessSmoothing();

  const loopingSampleCell = getLoopingSampleGridCell();
  const sampleGridVisible = (activeProcessKey === "decay" && activeFinger && activeFinger.count === 5) || loopingSampleCell !== null;
  const sampleGridPoint = getSampleGridPoint(rightHand, activeFinger) || getSampleGridPoint(leftHand, activeFinger);
  visualSystem.update(activeProcessKey, layers, audioAnalysis, visualGesturePoint, activeFinger);
  visualSystem.drawBackground(sampleGridVisible);
  if (!activeProcessKey || activeProcessKey === "loopCreator" || activeProcessKey === "motion") {
    visualSystem.drawAudioReactiveLayer(audioAnalysis);
    drawBodyPosePoints();
    drawBodyModeInterface();
    return;
  }
  visualSystem.drawSampleGrid(sampleGridVisible, sampleGridPoint);
  visualSystem.drawAudioReactiveLayer(audioAnalysis);
  visualSystem.drawParticles();
  drawBodyPosePoints();
  drawBodyModeInterface();
}

function readAudioAnalysis() {
  if (!audioReady || !audioEngine) {
    return {
      ...audioAnalysis,
      amp: audioAnalysis.amp * 0.92,
      bass: audioAnalysis.bass * 0.92,
      mid: audioAnalysis.mid * 0.92,
      treble: audioAnalysis.treble * 0.92,
    };
  }

  try {
    return audioEngine.getAnalysis(audioAnalysis);
  } catch (error) {
    systemMessage = "audio analyser paused, visuals still active";
    console.error(error);
    return audioAnalysis;
  }
}

function updateBodyPosePoints(pose) {
  const hasHandPoints = updateBodyPosePointsFromHands();
  if (!hasHandPoints) {
    bodyLeftWrist = smoothBodyPoint("leftWrist", BodyPoseTracker.getKeypoint(pose, "left_wrist"));
    bodyRightWrist = smoothBodyPoint("rightWrist", BodyPoseTracker.getKeypoint(pose, "right_wrist"));
    bodyLeftShoulder = smoothBodyPoint("leftShoulder", BodyPoseTracker.getKeypoint(pose, "left_shoulder"));
    bodyRightShoulder = smoothBodyPoint("rightShoulder", BodyPoseTracker.getKeypoint(pose, "right_shoulder"));
  }
  if (!bodyLeftWrist && !bodyRightWrist) {
    if (!handPoseStarted || handPoseLoading) activeInstructionText = "hand tracking loading";
    if (handPoseError) activeInstructionText = handPoseError;
  }
}

function smoothBodyPoint(slot, point) {
  if (!isFinitePoint(point)) {
    setSmoothedBodyPoint(slot, null);
    return null;
  }
  const previous = getSmoothedBodyPoint(slot);
  const amount = slot.includes("Wrist") ? 0.42 : 0.24;
  const smoothed = isFinitePoint(previous) ? lerpPoint(previous, point, amount) : { x: point.x, y: point.y, confidence: point.confidence };
  smoothed.confidence = point.confidence;
  setSmoothedBodyPoint(slot, smoothed);
  return smoothed;
}

function getSmoothedBodyPoint(slot) {
  if (slot === "leftWrist") return smoothedBodyLeftWrist;
  if (slot === "rightWrist") return smoothedBodyRightWrist;
  if (slot === "leftShoulder") return smoothedBodyLeftShoulder;
  if (slot === "rightShoulder") return smoothedBodyRightShoulder;
  return null;
}

function setSmoothedBodyPoint(slot, point) {
  if (slot === "leftWrist") smoothedBodyLeftWrist = point;
  if (slot === "rightWrist") smoothedBodyRightWrist = point;
  if (slot === "leftShoulder") smoothedBodyLeftShoulder = point;
  if (slot === "rightShoulder") smoothedBodyRightShoulder = point;
}

function updateBodyPosePointsFromHands() {
  const sorted = HandTracker.getSinglePerformerHands(hands);
  const roles = HandTracker.getPerformanceHands(sorted);
  const left = roles.leftHand;
  const right = roles.rightHand;
  let foundHand = false;
  if (HandTracker.isValidHand(left)) {
    const leftPoint = getHandControlPoint(left);
    bodyLeftWrist = smoothBodyPoint("leftWrist", leftPoint);
    bodyLeftShoulder = smoothBodyPoint("leftShoulder", { x: constrain(bodyLeftWrist.x - width * 0.16, 0, width), y: constrain(bodyLeftWrist.y + height * 0.22, 0, height) });
    foundHand = true;
  } else {
    bodyLeftWrist = smoothBodyPoint("leftWrist", null);
    bodyLeftShoulder = smoothBodyPoint("leftShoulder", null);
  }
  if (HandTracker.isValidHand(right)) {
    const rightPoint = getHandControlPoint(right);
    bodyRightWrist = smoothBodyPoint("rightWrist", rightPoint);
    bodyRightShoulder = smoothBodyPoint("rightShoulder", { x: constrain(bodyRightWrist.x + width * 0.16, 0, width), y: constrain(bodyRightWrist.y + height * 0.22, 0, height) });
    foundHand = true;
  } else {
    bodyRightWrist = smoothBodyPoint("rightWrist", null);
    bodyRightShoulder = smoothBodyPoint("rightShoulder", null);
  }
  if ((bodyLeftWrist || bodyRightWrist) && (!bodyPoseStarted || bodyPoseLoading || bodyPoseError)) {
    activeInstructionText = activeMode ? activeMode + " active / clap to loop" : "select a sound";
  }
  return foundHand;
}

function getHandControlPoint(hand) {
  if (!HandTracker.isValidHand(hand)) return null;
  const indexTip = hand.keypoints[fingerTips.index];
  if (isFinitePoint(indexTip)) return indexTip;
  const anchors = [hand.keypoints[0], hand.keypoints[5], hand.keypoints[9], hand.keypoints[13], hand.keypoints[17]].filter(isFinitePoint);
  if (!anchors.length) return null;
  const total = anchors.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), { x: 0, y: 0 });
  return { x: total.x / anchors.length, y: total.y / anchors.length, confidence: hand.confidence || 1 };
}

function updateModeDwellSelection(wrist) {
  const hovered = getHoveredModeBox(wrist);
  hoverWrist = wrist;
  if (!hovered) {
    candidateMode = null;
    dwellStartTime = 0;
    dwellProgress = 0;
    if (!activeMode) activeInstructionText = "select a sound";
    else activeInstructionText = activeMode + " active / clap to loop";
    return;
  }

  if (candidateMode !== hovered.mode) {
    candidateMode = hovered.mode;
    dwellStartTime = millis();
    dwellProgress = 0;
  }

  dwellProgress = constrain((millis() - dwellStartTime) / modeDwellDuration, 0, 1);
  const remaining = max(1, ceil((modeDwellDuration - (millis() - dwellStartTime)) / 1000));
  activeInstructionText = "loading... " + remaining;

  if (dwellProgress >= 1) activateMode(candidateMode);
}

function getHoveredModeBox(wrist) {
  if (!isFinitePoint(wrist)) return null;
  if (wrist.y < 0 || wrist.y > modeActivationHitHeight) return null;
  const index = floor(constrain(map(wrist.x, 0, width, 0, modeButtons.length), 0, modeButtons.length - 0.001));
  return modeButtons[index];
}

function activateMode(mode) {
  if (!mode || !modeToProcessKey[mode]) return;
  const nextKey = modeToProcessKey[mode];
  const previousKey = activeProcessKey;
  if (previousKey && previousKey !== nextKey) autoCaptureModeOnExit(previousKey);
  activeMode = mode;
  activeProcessKey = nextKey;
  candidateMode = null;
  dwellStartTime = 0;
  dwellProgress = 0;
  activeInstructionText = mode + " activated";
  if (activeProcessKey === "loopCreator") lastLiveDroneAt = -Infinity;
  if (activeProcessKey === "space") lastLiveLeadAt = -Infinity;
  if (activeProcessKey === "motion") lastLivePercussionAt = -Infinity;
  if (activeProcessKey === "texture") lastLiveClickAt = -Infinity;
  if (!audioReady && !audioStarting) startAudioFromHands();
}

function autoCaptureModeOnExit(key) {
  if (!["loopCreator", "motion", "texture", "space"].includes(key)) return;
  const event = lastGestureEvents[key];
  if (!event) return;
  storeGestureLoop(key, event, true);
  activeInstructionText = key === "loopCreator" ? "drone remembered" : key === "motion" ? "percussion remembered" : key === "texture" ? "click remembered" : "lead remembered";
}

function detectClap(leftWrist, rightWrist, leftShoulder, rightShoulder) {
  if (!isFinitePoint(leftWrist) || !isFinitePoint(rightWrist)) {
    previousWristDistance = null;
    isClapActive = false;
    return false;
  }
  const now = millis();
  const wristDistance = dist(leftWrist.x, leftWrist.y, rightWrist.x, rightWrist.y);
  const shoulderWidth = isFinitePoint(leftShoulder) && isFinitePoint(rightShoulder)
    ? dist(leftShoulder.x, leftShoulder.y, rightShoulder.x, rightShoulder.y)
    : width * 0.28;
  const closeThreshold = max(24, shoulderWidth * 0.42);
  const apartThreshold = max(42, shoulderWidth * 0.72);
  const previous = previousWristDistance;
  const elapsed = max(16, now - (previousWristDistanceAt || now));
  const closingSpeed = previous !== null ? (previous - wristDistance) / elapsed : 0;
  previousWristDistance = wristDistance;
  previousWristDistanceAt = now;

  if (wristDistance > apartThreshold) {
    isClapActive = false;
    return false;
  }
  if (wristDistance < closeThreshold && !isClapActive && now - lastClapTime > clapCooldown && (previous === null || previous > apartThreshold || closingSpeed > 0.24)) {
    isClapActive = true;
    lastClapTime = now;
    activeInstructionText = activeMode ? "clap: " + activeMode : "select a mode first";
    return true;
  }
  return false;
}

function handleClap(mode, rightHand, leftHand) {
  if (!mode || !modeToProcessKey[mode]) return;
  if (!audioReady && !audioStarting) startAudioFromHands();
  const key = modeToProcessKey[mode];
  if (key === "space" || key === "loopCreator" || key === "motion" || key === "texture") {
    activeInstructionText = key === "space" ? "lead is live only" : mode + " remembers on exit";
    return;
  }
  if (key === "decay") {
    triggerSelectedSampleLoopMemory(rightHand, leftHand);
  } else {
    triggerSelectedNote(rightHand, leftHand, key);
  }
  activeInstructionText = mode + " loop stored";
}

function createModeGesture(mode, point) {
  if (!mode || !modeToProcessKey[mode] || !isFinitePoint(point)) return null;
  const index = modeButtons.findIndex((item) => item.mode === mode);
  const count = max(1, index + 1);
  return {
    key: mode,
    count,
    openFingers: [mode],
    processKey: modeToProcessKey[mode],
    point,
    points: [{ key: mode, point }],
  };
}

function createBodyHand(wrist, shoulder, label) {
  if (!isFinitePoint(wrist)) return null;
  const scale = isFinitePoint(shoulder) ? max(42, dist(wrist.x, wrist.y, shoulder.x, shoulder.y) * 0.32) : 54;
  const keypoints = [];
  for (let i = 0; i < 21; i++) keypoints.push({ x: wrist.x, y: wrist.y, z: 0 });
  keypoints[0] = { x: wrist.x, y: wrist.y, z: 0 };
  keypoints[8] = { x: wrist.x, y: wrist.y, z: 0 };
  keypoints[4] = { x: wrist.x + (label === "Left" ? -scale * 0.2 : scale * 0.2), y: wrist.y, z: 0 };
  keypoints[9] = { x: wrist.x, y: wrist.y - scale, z: 0 };
  keypoints[12] = { x: wrist.x, y: wrist.y - scale * 0.8, z: 0 };
  keypoints[16] = { x: wrist.x, y: wrist.y - scale * 0.55, z: 0 };
  keypoints[20] = { x: wrist.x, y: wrist.y - scale * 0.3, z: 0 };
  return { handedness: label, confidence: 1, keypoints, bodyWrist: true };
}

function getBodyPerformancePoint(mode, leftWrist, rightWrist) {
  if (mode === "drone") return rightWrist || leftWrist;
  if (mode === "sample") return rightWrist || leftWrist;
  if (mode === "lead") return rightWrist || leftWrist;
  if (isFinitePoint(leftWrist) && isFinitePoint(rightWrist)) return { x: (leftWrist.x + rightWrist.x) * 0.5, y: (leftWrist.y + rightWrist.y) * 0.5 };
  return rightWrist || leftWrist;
}

function drawBodyModeInterface() {
  noStroke();
  fill(0, 245);
  rect(0, 0, width, performanceTop);
  drawInstructionBar();
  drawModeButtons();
}

function drawInstructionBar() {
  noStroke();
  fill(218);
  const boxW = min(width * 0.46, 480);
  const boxX = (width - boxW) * 0.5;
  rect(boxX, 0, boxW, instructionBarHeight);
  fill(0);
  textAlign(CENTER, CENTER);
  textSize(7.5);
  const label = activeInstructionText || "select a sound";
  push();
  drawingContext.save();
  drawingContext.beginPath();
  drawingContext.rect(boxX + 3, 0, boxW - 6, instructionBarHeight);
  drawingContext.clip();
  text(label, boxX + 5, 0, boxW - 10, instructionBarHeight);
  drawingContext.restore();
  pop();
  textAlign(LEFT, BASELINE);
}

function drawModeButtons() {
  const y = instructionBarHeight;
  const boxW = width / modeButtons.length;
  stroke(180, 120);
  strokeWeight(0.7);
  textAlign(CENTER, CENTER);
  textSize(8);
  for (let i = 0; i < modeButtons.length; i++) {
    const item = modeButtons[i];
    const x = i * boxW;
    if (activeMode === item.mode) {
      noStroke();
      fill(126);
      rect(x, y, boxW, modeButtonHeight);
    } else {
      noFill();
    }
    stroke(180, 120);
    rect(x, y, boxW, modeButtonHeight);
    if (candidateMode === item.mode && dwellProgress > 0) {
      noStroke();
      fill(218, 180);
      rect(x, y, boxW * dwellProgress, modeButtonHeight);
    }
    noStroke();
    fill(activeMode === item.mode || (candidateMode === item.mode && dwellProgress > 0) ? 0 : 190);
    text(item.mode, x + boxW / 2, y + modeButtonHeight / 2);
  }
  textAlign(LEFT, BASELINE);
}

function drawBodyPosePoints() {
  noStroke();
  if (isFinitePoint(bodyLeftWrist)) {
    drawHandEchoPoint(bodyLeftWrist, getHandMarkerColor("left"), 0);
  }
  if (isFinitePoint(bodyRightWrist)) {
    drawHandEchoPoint(bodyRightWrist, getHandMarkerColor("right"), 1.7);
  }
}

function getHandMarkerColor(side) {
  if (activeProcessKey === "space") return color(255, 36, 30);
  if (activeProcessKey === "texture" && side === "left") return color(35, 112, 255);
  if (side === "left") return color(35, 112, 255);
  return color(255, 214, 26);
}

function drawHandEchoPoint(point, pointColor, phase) {
  const pulse = (sin(frameCount * 0.18 + phase) + 1) * 0.5;
  noFill();
  for (let echo = 0; echo < 4; echo++) {
    stroke(red(pointColor), green(pointColor), blue(pointColor), 142 - echo * 27);
    strokeWeight(max(0.7, 1.9 - echo * 0.24));
    beginShape();
    const radius = 14 + echo * 13 + pulse * 7;
    for (let a = 0; a <= TWO_PI + 0.14; a += 0.2) {
      const wobble = (noise(cos(a) + phase, sin(a) + echo, frameCount * 0.012) - 0.5) * (8 + echo * 3);
      vertex(point.x + cos(a) * (radius + wobble), point.y + sin(a) * (radius + wobble));
    }
    endShape(CLOSE);
  }
  noStroke();
  fill(red(pointColor), green(pointColor), blue(pointColor), 230);
  circle(point.x, point.y, 7 + pulse * 2);
}

function updateAudioSafely(gesturePoint) {
  if (!audioReady || !audioEngine || !audioModulationEnabled) return;
  try {
    audioEngine.updateSampleLoops(Tone.now());
    audioEngine.updateFromLayers(layers);
    audioEngine.setSpatialPosition(gesturePoint);
    updateLiveOneFingerDrone();
    updateLivePercussion();
    updateLiveClickPattern();
    updateLiveLead();
  } catch (error) {
    audioModulationEnabled = false;
    systemMessage = "audio running without continuous modulation";
    console.error(error);
  }
}

function updateLiveLead() {
  if (activeProcessKey !== "space" || millis() - lastLiveLeadAt < max(70, 190 - leadSpeedValue * 95)) return;
  const rightHand = createBodyHand(bodyRightWrist || bodyLeftWrist, bodyRightShoulder || bodyLeftShoulder, "Right");
  const leftHand = createBodyHand(bodyLeftWrist, bodyLeftShoulder, "Left");
  if (!rightHand) return;
  const event = createGestureEvent("space", rightHand, leftHand);
  lastGestureEvents.space = event;
  audioEngine.playGestureEvent(event, Tone.now(), 0.72);
  visualSystem.createEventParticle(event);
  lastLiveLeadAt = millis();
}

function updateLivePercussion() {
  if (activeProcessKey !== "motion" || millis() - lastLivePercussionAt < 320) return;
  const rightHand = createBodyHand(bodyRightWrist || bodyLeftWrist, bodyRightShoulder || bodyLeftShoulder, "Right");
  const leftHand = createBodyHand(bodyLeftWrist, bodyLeftShoulder, "Left");
  if (!rightHand && !leftHand) return;
  const event = createGestureEvent("motion", rightHand, leftHand);
  lastGestureEvents.motion = event;
  audioEngine.playGestureEvent({ ...event, probability: 1, accent: false, velocity: event.velocity * 0.72 }, Tone.now(), 0.68);
  visualSystem.createEventParticle(event);
  lastLivePercussionAt = millis();
}

function updateLiveClickPattern() {
  if (activeProcessKey !== "texture" || millis() - lastLiveClickAt < 210) return;
  const rightHand = createBodyHand(bodyRightWrist || bodyLeftWrist, bodyRightShoulder || bodyLeftShoulder, "Right");
  const leftHand = createBodyHand(bodyLeftWrist, bodyLeftShoulder, "Left");
  if (!rightHand && !leftHand) return;
  const event = createGestureEvent("texture", rightHand, leftHand);
  lastGestureEvents.texture = event;
  audioEngine.playGestureEvent({ ...event, velocity: event.velocity * 0.78 }, Tone.now(), 0.62);
  visualSystem.createEventParticle(event);
  lastLiveClickAt = millis();
}

function updateLiveOneFingerDrone() {
  if (activeProcessKey !== "loopCreator" || millis() - lastLiveDroneAt < 620) return;
  const rightHand = createBodyHand(bodyRightWrist || bodyLeftWrist, bodyRightShoulder || bodyLeftShoulder, "Right");
  if (!rightHand) return;
  const event = createGestureEvent("loopCreator", rightHand, null);
  lastGestureEvents.loopCreator = event;
  event.velocity = constrain(map(selectedFilter, 0, 1, 0.28, 0.76), 0.22, 0.82);
  audioEngine.playGestureEvent(event, Tone.now(), 0.82);
  lastLiveDroneAt = millis();
}

function drawFallbackFrame() {
  background(210, 22, 28);
  noStroke();
  for (let x = 0; x < width; x += 28) {
    for (let y = 0; y < height; y += 28) {
      fill((x + y + frameCount) % 84 === 0 ? color(20, 40, 185, 90) : color(255, 42, 185, 38));
      rect(x, y, 7, 7);
    }
  }
  fill(255);
  textSize(16);
  text("visual system recovered", 34, 44);
  textSize(12);
  text(drawErrorMessage || "unknown drawing error", 34, 72, width - 68, 80);
  text("Try moving one right-hand finger. Audio errors will no longer freeze visuals.", 34, 122);
}

async function startAudio(force = false) {
  if (audioReady) return;
  if (audioStarting && !force) return;
  if (audioStarting && force) audioStarting = false;
  audioStarting = true;
  lastAudioStartAttempt = millis();
  try {
    systemMessage = "starting audio from hand movement...";
    if (!audioEngine) audioEngine = new AudioEngine();
    if (!loopManager) loopManager = new LoopManager(audioEngine);
    await audioEngine.start();
    loopManager.start();
    audioReady = true;
    audioModulationEnabled = true;
    audioStarting = false;
    systemMessage = "";
    flushPendingAudioEvents();
    flushPendingSampleLoop();
  } catch (error) {
    audioStarting = false;
    if (!audioReady) systemMessage = "click once to enable audio";
    console.error(error);
  }
}

function startAudioFromHands() {
  startAudio();
}

function getLoopingSampleGridCell() {
  if (!audioReady || !audioEngine || !audioEngine.sampleEngine || !audioEngine.sampleEngine.loopPlayer) return null;
  return Number.isFinite(audioEngine.sampleEngine.loopGridCell) ? audioEngine.sampleEngine.loopGridCell : null;
}

function playOrQueueGestureEvent(event, fade = 1) {
  if (audioReady && audioEngine) {
    audioEngine.playGestureEvent(event, Tone.now(), fade);
    return true;
  }

  pendingAudioEvents.push({ event: { ...event }, fade });
  while (pendingAudioEvents.length > 12) pendingAudioEvents.shift();
  if (!audioStarting) startAudioFromHands();
  return false;
}

function flushPendingAudioEvents() {
  if (!audioReady || !audioEngine || !pendingAudioEvents.length) return;
  const queued = pendingAudioEvents.splice(0);
  const now = Tone.now();
  queued.forEach((item, index) => {
    try {
      audioEngine.playGestureEvent(item.event, now + index * 0.035, item.fade);
    } catch (error) {
      systemMessage = "queued audio event skipped";
      console.error(error);
    }
  });
}

function toggleOrQueueSampleLoop(event, velocity = 0.42) {
  if (audioReady && audioEngine) {
    audioEngine.toggleSampleLoop(event, Tone.now(), velocity);
    return;
  }

  pendingSampleLoopEvent = { event: { ...event }, velocity };
  if (!audioStarting) startAudioFromHands();
}

function flushPendingSampleLoop() {
  if (!audioReady || !audioEngine || !pendingSampleLoopEvent) return;
  const item = pendingSampleLoopEvent;
  pendingSampleLoopEvent = null;
  try {
    audioEngine.toggleSampleLoop(item.event, Tone.now(), item.velocity);
  } catch (error) {
    systemMessage = "sample loop skipped";
    console.error(error);
  }
}

function mousePressed() {
  startAudio(true);
}

function touchStarted() {
  startAudio(true);
  return false;
}

function keyPressed() {
  startAudio(true);
  if (key === 'f' || key === 'F') {
    let fs = fullscreen();
    fullscreen(!fs);
  }
}

function setupLayers() {
  for (const key of processOrder) {
    layers[key] = {
      key,
      name: processNames[key],
      active: false,
      saved: false,
      playing: false,
      events: [],
      stillSince: null,
      lastTip: null,
      movedAfterSave: true,
      savedAt: 0,
      saveFlash: 0,
      profile: { ...processProfiles[key] },
      params: { ...processProfiles[key] },
      target: { ...processProfiles[key] },
      savedParams: null,
      recording: [],
      savedPattern: null,
      lastRecordTime: 0,
    };
  }
}

function updateProcessTargets(leftHand) {
  for (const key of processOrder) layers[key].active = key === activeProcessKey;
  if (!activeProcessKey) return;
  const layer = layers[activeProcessKey];
  layer.target.density = lerp(layer.target.density, 0.42, 0.08);
  layer.target.variation = lerp(layer.target.variation, 0.18, 0.08);
  layer.target.depth = lerp(layer.target.depth, selectedFilter, 0.12);
  layer.target.chance = lerp(layer.target.chance, 0.08, 0.08);
}

function mixParam(base, gesture) {
  return constrain(base * 0.35 + gesture * 0.85, 0, 1);
}

function updateProcessSmoothing() {
  for (const key of processOrder) {
    const layer = layers[key];
    for (const param of leftParamKeys) {
      layer.params[param] = lerp(layer.params[param], layer.target[param], 0.08);
    }
    layer.saveFlash *= 0.9;
  }
}

function recordActiveProcessParams() {
  if (!activeProcessKey) return;
  const layer = layers[activeProcessKey];
  const now = millis();
  if (now - layer.lastRecordTime < parameterRecordInterval) return;

  layer.recording.push({
    t: now,
    params: { ...layer.params },
  });

  while (layer.recording.length && now - layer.recording[0].t > parameterLoopLength) {
    layer.recording.shift();
  }

  layer.lastRecordTime = now;
}

function updateFreezeLogic(activeFinger, leftHand) {
  if (!activeProcessKey || !activeFinger) return;
  const layer = layers[activeProcessKey];
  const tip = activeFinger.point;

  if (!layer.lastTip) {
    layer.lastTip = { x: tip.x, y: tip.y };
    layer.stillSince = millis();
    return;
  }

  const movement = dist(tip.x, tip.y, layer.lastTip.x, layer.lastTip.y);
  if (movement > stillThreshold * 2.2) layer.movedAfterSave = true;

  if (movement < stillThreshold) {
    if (layer.stillSince === null) layer.stillSince = millis();
    const ready = millis() - layer.stillSince > stillSaveTime;
    if (ready && layer.movedAfterSave && millis() > saveCooldownUntil) saveProcess(activeProcessKey);
  } else {
    layer.stillSince = millis();
  }

  layer.lastTip = lerpPoint(layer.lastTip, tip, 0.3);
}

function updateControlAxes(leftHand, rightHand, activeFinger) {
  if (activeProcessKey === "loopCreator") {
    updateDroneTwoHandControls(leftHand, rightHand);
    return;
  }
  if (activeProcessKey === "motion") {
    updatePercussionTwoHandControls(leftHand, rightHand);
    return;
  }
  if (activeProcessKey === "texture") {
    updateClickTwoHandControls(leftHand, rightHand);
    return;
  }
  if (activeProcessKey === "space") {
    updateLeadTwoHandControls(leftHand, rightHand);
    return;
  }
  const point = getAxisControlPoint(activeProcessKey, leftHand, rightHand, activeFinger);
  if (!isFinitePoint(point)) return;

  const noteIndex = floor(constrain(map(point.y, height * 0.92, height * 0.08, 0, fixedScale.length), 0, fixedScale.length - 0.001));
  selectedNote = fixedScale[noteIndex];
  selectedFilter = constrain(map(point.x, width * 0.08, width * 0.92, 0, 1), 0, 1);
  selectedSampleIndex = getSampleGridIndex(point);
}

function updatePercussionTwoHandControls(leftHand, rightHand) {
  const leftPoint = getHandControlPoint(leftHand) || getIndexPoint(leftHand);
  const rightPoint = getHandControlPoint(rightHand) || getIndexPoint(rightHand);
  const rhythmPoint = leftPoint || rightPoint;
  const soundPoint = rightPoint || leftPoint;
  if (isFinitePoint(rhythmPoint)) {
    percussionSubdivisionValue = constrain(map(rhythmPoint.x, 0, width, 0, 1), 0, 1);
    percussionDensityValue = constrain(map(rhythmPoint.y, height, performanceTop, 0, 1), 0, 1);
  }
  if (isFinitePoint(soundPoint)) {
    selectedFilter = constrain(map(soundPoint.x, width * 0.08, width * 0.92, 0, 1), 0, 1);
    const noteIndex = floor(constrain(map(soundPoint.y, height * 0.92, performanceTop + 4, 0, fixedScale.length), 0, fixedScale.length - 0.001));
    selectedNote = fixedScale[noteIndex];
  }
  const layer = layers.motion;
  layer.target.density = constrain(0.12 + percussionDensityValue * 0.78, 0.08, 0.92);
  layer.target.variation = constrain(0.08 + percussionSubdivisionValue * 0.72, 0.08, 0.82);
  layer.target.depth = selectedFilter;
  layer.target.chance = constrain(0.08 + percussionDensityValue * 0.38, 0.06, 0.48);
}

function updateClickTwoHandControls(leftHand, rightHand) {
  const leftPoint = getHandControlPoint(leftHand) || getIndexPoint(leftHand);
  const rightPoint = getHandControlPoint(rightHand) || getIndexPoint(rightHand);
  const patternPoint = leftPoint || rightPoint;
  const texturePoint = rightPoint || leftPoint;
  if (isFinitePoint(patternPoint)) {
    clickPatternValue = constrain(map(patternPoint.x, 0, width, 0, 1), 0, 1);
    clickDensityValue = constrain(map(patternPoint.y, height, performanceTop, 0, 1), 0, 1);
  }
  if (isFinitePoint(texturePoint)) {
    clickHarmonyValue = constrain(map(texturePoint.x, 0, width, 0, 1), 0, 1);
    selectedFilter = constrain(map(texturePoint.y, height, performanceTop, 0.08, 1), 0.08, 1);
    const noteIndex = floor(constrain(map(texturePoint.x, 0, width, 0, fixedScale.length), 0, fixedScale.length - 0.001));
    selectedNote = fixedScale[noteIndex];
  }
  const layer = layers.texture;
  layer.target.density = constrain(0.1 + clickDensityValue * 0.82, 0.08, 0.95);
  layer.target.variation = constrain(0.08 + clickPatternValue * 0.78, 0.08, 0.9);
  layer.target.depth = selectedFilter;
  layer.target.chance = constrain(0.04 + clickDensityValue * 0.32, 0.03, 0.42);
}

function updateLeadTwoHandControls(leftHand, rightHand) {
  const leftPoint = getHandControlPoint(leftHand) || getIndexPoint(leftHand);
  const rightPoint = getHandControlPoint(rightHand) || getIndexPoint(rightHand);
  if (isFinitePoint(rightPoint)) {
    const region = constrain(map(rightPoint.x, 0, width, -2, 3), -2, 3);
    const noteIndex = floor(constrain(map(rightPoint.y, height * 0.94, performanceTop + 4, 0, fixedScale.length), 0, fixedScale.length - 0.001));
    selectedNote = transposeNoteOctaves(fixedScale[noteIndex], floor(region * 0.5));
    const now = millis();
    if (lastLeadPoint && lastLeadPointAt) {
      const elapsed = max(16, now - lastLeadPointAt);
      leadSpeedValue = constrain(dist(rightPoint.x, rightPoint.y, lastLeadPoint.x, lastLeadPoint.y) / elapsed * 0.18, 0, 1);
    }
    lastLeadPoint = { x: rightPoint.x, y: rightPoint.y };
    lastLeadPointAt = now;
  }
  if (isFinitePoint(leftPoint)) {
    selectedFilter = constrain(map(leftPoint.y, height, performanceTop, 0.08, 1), 0.08, 1);
    leadInstabilityValue = constrain(map(leftPoint.x, 0, width, 0, 1), 0, 1);
  }
  const layer = layers.space;
  layer.target.density = constrain(0.16 + leadSpeedValue * 0.62, 0.1, 0.82);
  layer.target.variation = constrain(0.08 + leadInstabilityValue * 0.72, 0.08, 0.9);
  layer.target.depth = selectedFilter;
  layer.target.chance = constrain(0.04 + leadSpeedValue * 0.4 + leadInstabilityValue * 0.18, 0.04, 0.7);
}

function updateDroneTwoHandControls(leftHand, rightHand) {
  const leftPoint = getHandControlPoint(leftHand) || getIndexPoint(leftHand);
  const rightPoint = getHandControlPoint(rightHand) || getIndexPoint(rightHand);
  const pitchPoint = rightPoint || leftPoint;
  if (isFinitePoint(pitchPoint)) {
    const noteIndex = floor(constrain(map(pitchPoint.y, height * 0.92, performanceTop + 4, 0, fixedScale.length), 0, fixedScale.length - 0.001));
    selectedNote = fixedScale[noteIndex];
  }
  if (isFinitePoint(rightPoint)) {
    selectedDroneChordIndex = floor(constrain(map(rightPoint.x, 0, width, 0, droneChordBank.length), 0, droneChordBank.length - 0.001));
  }
  if (isFinitePoint(leftPoint)) {
    const rawFilter = constrain(map(leftPoint.y, height * 0.96, performanceTop, 0, 1), 0, 1);
    selectedFilter = pow(rawFilter, 0.72);
  }
  const layer = layers.loopCreator;
  if (!layer) return;
  const rightX = isFinitePoint(rightPoint) ? constrain(map(rightPoint.x, 0, width, 0, 1), 0, 1) : 0.5;
  const leftX = isFinitePoint(leftPoint) ? constrain(map(leftPoint.x, 0, width, 0, 1), 0, 1) : 0.35;
  layer.target.depth = selectedFilter;
  layer.target.variation = constrain(0.08 + leftX * 0.82, 0.08, 0.9);
  layer.target.density = constrain(0.18 + rightX * 0.58, 0.12, 0.84);
  layer.target.chance = constrain(0.04 + leftX * 0.54, 0.04, 0.62);
}

function getAxisControlPoint(key, leftHand, rightHand, activeFinger) {
  if (key === "loopCreator") {
    const leftIndex = getIndexPoint(leftHand);
    if (leftIndex) return leftIndex;
  }
  const rightIndex = getIndexPoint(rightHand);
  if (rightIndex) return rightIndex;
  if (activeFinger && isFinitePoint(activeFinger.point)) return activeFinger.point;
  return getIndexPoint(leftHand);
}

function getSampleGridIndex(point) {
  return constrain(getSampleGridCell(point), 0, samplePaths.length - 1);
}

function getSampleGridCell(point) {
  if (!isFinitePoint(point)) return 0;
  const col = floor(constrain(map(point.x, 0, width, 0, sampleGridCols), 0, sampleGridCols - 0.001));
  const row = floor(constrain(map(point.y, sampleGridTop, height, 0, sampleGridRows), 0, sampleGridRows - 0.001));
  return row * sampleGridCols + col;
}

function getSampleGridPoint(rightHand, activeFinger) {
  if (!activeFinger || activeFinger.processKey !== "decay") return null;
  return getIndexPoint(rightHand);
}

function updateSampleGrid(leftHand, rightHand, activeFinger) {
  if (activeProcessKey !== "decay" || !activeFinger || activeFinger.count !== 5) {
    lastSampleGridCell = null;
    if (sampleModeWasActive) {
      selectedSampleGridCell = null;
      selectedSampleGridCells = { left: null, right: null };
      lastSampleGridCells = { left: null, right: null };
    }
    sampleModeWasActive = false;
    return;
  }
  sampleModeWasActive = true;

  updateSampleHandCell("left", leftHand);
  updateSampleHandCell("right", rightHand);
}

function updateSampleHandCell(side, hand) {
  const point = getSampleGridPoint(hand, { processKey: "decay" });
  if (!isFinitePoint(point)) {
    selectedSampleGridCells[side] = null;
    return;
  }

  const gridCell = getSampleGridCell(point);
  const cell = constrain(gridCell, 0, samplePaths.length - 1);
  const shouldPlay = gridCell !== lastSampleGridCells[side];

  selectedSampleIndex = cell;
  selectedSampleGridCell = gridCell;
  selectedSampleGridCells[side] = gridCell;
  if (shouldPlay) {
    lastSampleGridCells[side] = gridCell;
    lastSampleGridCell = gridCell;
    lastSampleGridAt = millis();
    lastSampleEvents[side] = triggerSampleGridCell(point, cell, 1, gridCell, side);
  }
}

function triggerSampleGridCell(point, cell, repeatCount = 1, gridCell = getSampleGridCell(point), handSide = "right") {
  if (!audioReady && !audioStarting) startAudioFromHands();
  const event = createSampleEvent(point, cell, gridCell, repeatCount, handSide);

  visualSystem.createEventParticle(event);
  try {
    playOrQueueGestureEvent(event, 1);
  } catch (error) {
    systemMessage = "sample event skipped";
    console.error(error);
  }
  return event;
}

function createSampleEvent(point, cell, gridCell, repeatCount = 1, handSide = "right") {
  const filterByY = constrain(map(point.y, height, sampleGridTop, 0.08, 1), 0.08, 1);
  const textureByX = constrain(map(point.x, 0, width, 0, 1), 0, 1);
  return {
    time: loopManager ? loopManager.step / loopManager.loopLength : (millis() % parameterLoopLength) / parameterLoopLength,
    type: "sample",
    note: selectedNote,
    soundEngine: "decay",
    filterValue: filterByY,
    velocity: handSide === "left" ? 0.54 : 0.6,
    duration: "8n",
    probability: 1,
    texture: textureByX,
    drift: 0,
    pan: getPanFromPoint(point),
    visualX: point.x,
    visualY: point.y,
    sampleIndex: cell,
    gridCell,
    repeatCount,
    handSide,
    playbackRate: constrain(0.88 + textureByX * 0.24, 0.82, 1.16),
    triggeredAt: millis(),
  };
}

function getIndexPoint(hand) {
  return getOpenFingerPoint(hand, "index");
}

function getOpenFingerPoint(hand, key) {
  if (!HandTracker.isValidHand(hand)) return null;
  if (hand.bodyWrist) {
    const point = hand.keypoints[fingerTips[key]] || hand.keypoints[0];
    return isFinitePoint(point) ? point : null;
  }
  if (GestureDetector.getFingerOpenAmount(hand, key) <= 0.52) return null;
  const point = hand.keypoints[fingerTips[key]];
  return isFinitePoint(point) ? point : null;
}

function getGestureSpatialPoint(leftHand, activeFinger, rightHand) {
  if (activeFinger && activeFinger.count === 1 && isFinitePoint(activeFinger.point)) return activeFinger.point;
  const rightIndex = getIndexPoint(rightHand);
  if (rightIndex) return rightIndex;
  if (activeFinger && isFinitePoint(activeFinger.point)) return activeFinger.point;
  const leftIndex = getIndexPoint(leftHand);
  if (leftIndex) return leftIndex;
  if (HandTracker.isValidHand(rightHand) && isFinitePoint(rightHand.keypoints[0])) return rightHand.keypoints[0];
  return null;
}

function getPanFromPoint(point) {
  if (!isFinitePoint(point)) return 0;
  return constrain(map(point.x, 0, width, -0.9, 0.9), -0.9, 0.9);
}

function handleLeftOpenPalmStop(leftHand) {
  const openPalmActive = GestureDetector.isOpenPalm(leftHand);
  if (openPalmActive && !leftOpenPalmWasActive) {
    stopAllAudio();
  }
  leftOpenPalmWasActive = openPalmActive;
  return openPalmActive;
}

function stopAllAudio() {
  pendingAudioEvents = [];
  pendingSampleLoopEvent = null;
  loopMemories = loopMemories.filter((memory) => memory.background);
  savedBlocks = savedBlocks.filter((block) => loopMemories.some((memory) => memory.id === block.id));
  for (const key of processOrder) {
    if (key === "loopCreator" || key === "motion" || key === "texture" || key === "space") continue;
    const layer = layers[key];
    if (!layer) continue;
    layer.saved = false;
    layer.playing = false;
    layer.events = [];
    layer.savedPattern = null;
    layer.savedParams = null;
  }
  if (audioEngine) {
    try {
      audioEngine.stopTransient(Tone.now());
    } catch (error) {
      systemMessage = "audio stop skipped";
      console.error(error);
    }
  }
}

function handlePinchTrigger(rightHand, leftHand) {
  const pinchActive = rightPinchActive;
  if (pinchActive && !leftPinchWasActive) {
    const activeFinger = stableActiveFinger;
    const twoFingerMode = activeFinger && activeFinger.count === 2 || lastPerformingProcessKey === "motion";
    if (twoFingerMode && selectedSampleGridCell !== null && activeProcessKey === "decay") {
      toggleSelectedSampleLoop();
      leftPinchWasActive = pinchActive;
      return;
    }
    const key = activeProcessKey || lastPerformingProcessKey;
    if (key === "decay") {
      triggerSelectedSampleLoopMemory(rightHand);
    } else {
      triggerSelectedNote(rightHand, leftHand, key);
    }
  }
  leftPinchWasActive = pinchActive;
}

function triggerSelectedNote(rightHand, leftHand, key = activeProcessKey) {
  if (!key || key === "decay") return;
  if (!audioReady && !audioStarting) startAudioFromHands();
  const event = createGestureEvent(key, rightHand, leftHand);
  if (key === "space") {
    visualSystem.createEventParticle(event);
    try {
      playOrQueueGestureEvent(event, 1);
    } catch (error) {
      systemMessage = "lead event skipped";
      console.error(error);
    }
    return;
  }

  storeGestureLoop(key, event, true);
}

function storeGestureLoop(key, event, playImmediately = false) {
  if (!key || !event || !["loopCreator", "motion", "texture", "space"].includes(key)) return;
  if (key === "loopCreator") {
    event = {
      ...event,
      filterValue: layers.loopCreator.params.depth,
      texture: layers.loopCreator.params.variation,
      velocity: constrain(map(layers.loopCreator.params.depth, 0, 1, 0.28, 0.78), 0.24, 0.82),
    };
  }
  const memory = {
    id: millis() + "-" + key,
    key,
    events: [event],
    params: { ...layers[key].params, depth: key === "loopCreator" ? layers.loopCreator.params.depth : selectedFilter },
    pattern: null,
    savedAt: millis(),
    cycleCount: 0,
    maxCycles: Infinity,
    lastCycleStep: 0,
    fading: false,
    background: true,
  };

  if (key === "motion") memory.events = createRegularPercussionEvents(event);
  if (key === "texture") memory.events = createClickPatternEvents(event);
  if (key === "space") memory.events = createLeadLoopEvents(event);

  loopMemories = loopMemories.filter((item) => !(item.key === key && item.background));
  savedBlocks = savedBlocks.filter((block) => !(block.key === key && block.background));

  loopMemories.push(memory);
  pruneLoopMemories();
  visualSystem.createSavedBlock(memory);
  visualSystem.createEventParticle({ ...event, loopMemoryId: memory.id });
  if (playImmediately) {
    try {
      playOrQueueGestureEvent(key === "motion" ? { ...event, probability: 1 } : event, 1);
    } catch (error) {
      systemMessage = "audio event skipped, loop memory stored";
      console.error(error);
    }
  }
}

function triggerSelectedSample(rightHand) {
  if (activeProcessKey !== "decay") return;
  const gridCell = selectedSampleGridCell !== null ? selectedSampleGridCell : lastSampleGridCell;
  const point = getIndexPoint(rightHand);
  if (!isFinitePoint(point)) return;
  if (!audioReady && !audioStarting) startAudioFromHands();

  const eventGridCell = gridCell !== null ? gridCell : getSampleGridCell(point);
  triggerSampleGridCell(point, constrain(eventGridCell, 0, samplePaths.length - 1), 1, eventGridCell);
}

function triggerSelectedSampleLoopMemory(rightHand, leftHand = null) {
  if (activeProcessKey !== "decay") return;
  const rightPoint = getIndexPoint(rightHand);
  const leftPoint = getIndexPoint(leftHand);
  let handSide = "right";
  let gridCell = selectedSampleGridCells.right !== null ? selectedSampleGridCells.right : null;
  let indexPoint = rightPoint;
  const leftRecent = lastSampleEvents.left && millis() - lastSampleEvents.left.triggeredAt < 2200;
  const rightRecent = lastSampleEvents.right && millis() - lastSampleEvents.right.triggeredAt < 2200;
  if (selectedSampleGridCells.left !== null && (leftRecent || !rightRecent || (lastSampleEvents.left && lastSampleEvents.right && lastSampleEvents.left.triggeredAt > lastSampleEvents.right.triggeredAt))) {
    handSide = "left";
    gridCell = selectedSampleGridCells.left;
    indexPoint = leftPoint;
  }
  if (gridCell === null) gridCell = selectedSampleGridCell !== null ? selectedSampleGridCell : lastSampleGridCell;
  const point = isFinitePoint(indexPoint) ? indexPoint : gridCell !== null ? getSampleGridCellCenter(gridCell) : null;
  if (!isFinitePoint(point)) return;
  if (!audioReady && !audioStarting) startAudioFromHands();

  const eventGridCell = gridCell !== null ? gridCell : getSampleGridCell(point);
  const event = createSampleEvent(point, constrain(eventGridCell, 0, samplePaths.length - 1), eventGridCell, 1, handSide);
  const memory = {
    id: millis() + "-decay",
    key: "decay",
    events: [event],
    params: { ...layers.decay.params, depth: selectedFilter },
    pattern: null,
    savedAt: millis(),
    cycleCount: 0,
    maxCycles: loopLifetimeCycles,
    lastCycleStep: 0,
    fading: false,
    background: false,
  };

  loopMemories.push(memory);
  pruneLoopMemories();
  visualSystem.createSavedBlock(memory);
  visualSystem.createEventParticle({ ...event, loopMemoryId: memory.id });
  playOrQueueGestureEvent(event, 1);
}

function toggleSelectedSampleLoop() {
  const gridCell = selectedSampleGridCell !== null ? selectedSampleGridCell : lastSampleGridCell;
  if (gridCell === null) return;
  const point = getSampleGridCellCenter(gridCell);
  const event = {
    time: loopManager ? loopManager.step / loopManager.loopLength : (millis() % parameterLoopLength) / parameterLoopLength,
    type: "sample",
    note: selectedNote,
    soundEngine: "decay",
    filterValue: selectedFilter,
    velocity: 0.42,
    duration: "8n",
    probability: 1,
    texture: selectedFilter,
    drift: 0,
    pan: getPanFromPoint(point),
    visualX: point.x,
    visualY: point.y,
    sampleIndex: constrain(gridCell, 0, samplePaths.length - 1),
    gridCell,
    repeatCount: 1,
  };
  toggleOrQueueSampleLoop(event, 0.42);
}

function getSampleGridCellCenter(cell) {
  return {
    x: (cell % sampleGridCols + 0.5) * width / sampleGridCols,
    y: sampleGridTop + (floor(cell / sampleGridCols) % sampleGridRows + 0.5) * (height - sampleGridTop) / sampleGridRows,
  };
}

function clearOtherProcessMemories(key) {
  if (!key) return;
  loopMemories = loopMemories.filter((memory) => memory.key === key);
  savedBlocks = savedBlocks.filter((block) => block.key === key);
}

function pruneLoopMemories() {
  while (loopMemories.length > 8) {
    const removableIndex = loopMemories.findIndex((item) => !item.background);
    if (removableIndex < 0) return;
    const removed = loopMemories.splice(removableIndex, 1)[0];
    savedBlocks = savedBlocks.filter((block) => block.id !== removed.id);
  }
}

function createGestureEvent(engineKey, rightHand, leftHand) {
  const pinchPoint = engineKey === "motion" ? getThumbIndexCenter(rightHand) : null;
  const spatialPoint = pinchPoint || getAxisControlPoint(engineKey, leftHand, rightHand, null);
  const base = {
    time: loopManager ? loopManager.step / loopManager.loopLength : (millis() % parameterLoopLength) / parameterLoopLength,
    type: "gesture",
    note: selectedNote,
    soundEngine: engineKey,
    filterValue: selectedFilter,
    velocity: 0.58,
    duration: "8n",
    probability: 0.96,
    texture: selectedFilter,
    drift: 0,
    pan: getPanFromPoint(spatialPoint),
    visualX: spatialPoint ? spatialPoint.x : width * 0.5,
    visualY: spatialPoint ? spatialPoint.y : height * 0.5,
  };

  if (engineKey === "loopCreator") {
    const chord = transposeChordToSelectedHeight(droneChordBank[selectedDroneChordIndex] || droneChordBank[0], selectedNote);
    return { ...base, type: "chord", chord, inversion: selectedDroneChordIndex % 3, velocitySpread: 0.18 + (layers.loopCreator.params.variation || 0.1) * 0.22, shimmer: layers.loopCreator.params.chance || 0.1 };
  }

  if (engineKey === "motion") {
    const subdivision = rhythmSubdivisions[floor(constrain(map(percussionSubdivisionValue, 0, 1, 0, rhythmSubdivisions.length), 0, rhythmSubdivisions.length - 0.001))];
    return { ...base, type: "percussion", subdivision, randomHits: floor(map(percussionDensityValue, 0, 1, 0, 5)), probability: map(percussionDensityValue, 0, 1, 0.08, 0.42), velocity: map(percussionDensityValue, 0, 1, 0.34, 0.62) };
  }

  if (engineKey === "texture") {
    const noteIndex = floor(constrain(map(clickHarmonyValue, 0, 1, 0, fixedScale.length), 0, fixedScale.length - 0.001));
    return { ...base, type: "clickPattern", distortion: selectedFilter, note: fixedScale[noteIndex], patternType: clickPatternValue, densityValue: clickDensityValue, harmonicRegion: clickHarmonyValue };
  }

  if (engineKey === "decay") {
    return { ...base, type: "sample", sampleIndex: selectedSampleIndex };
  }

  return { ...base, type: "lead", note: selectedNote, velocity: map(getHandCloseness(rightHand), 0, 1, 0.22, 0.92), instability: leadInstabilityValue, speed: leadSpeedValue, repeatCount: 1 + floor(leadSpeedValue * 3) };
}

function transposeChordToSelectedHeight(chord, anchorNote) {
  const targetIndex = getScaleIndex(anchorNote);
  const octaveShift = floor(map(targetIndex, 0, fixedScale.length - 1, -1, 1));
  return chord.map((note) => transposeNoteOctaves(note, octaveShift));
}

function transposeNoteOctaves(note, octaveShift) {
  const match = String(note).match(/^([A-G][b#]?)(-?\d+)$/);
  if (!match) return note;
  return match[1] + constrain(int(match[2]) + octaveShift, 1, 6);
}

function getThumbIndexCenter(hand) {
  if (!HandTracker.isValidHand(hand)) return null;
  const thumb = hand.keypoints[fingerTips.thumb];
  const index = hand.keypoints[fingerTips.index];
  if (!isFinitePoint(thumb) || !isFinitePoint(index)) return null;
  return {
    x: (thumb.x + index.x) * 0.5,
    y: (thumb.y + index.y) * 0.5,
  };
}

function createRegularPercussionEvents(source) {
  const events = [];
  const regularCount = source.subdivision;
  const baseIndex = getScaleIndex(source.note);
  const offsets = [0, 3, 5, 7, 2, 4, 6, 8];
  for (let i = 0; i < regularCount; i++) {
    const accent = i % 4 === 0 ? 1 : i % 2 === 0 ? 0.74 : 0.52;
    const noteIndex = constrain(baseIndex + offsets[i % offsets.length], 0, fixedScale.length - 1);
    events.push({
      ...source,
      time: i / regularCount,
      probability: 1,
      random: false,
      accent: i % 4 === 0,
      note: fixedScale[noteIndex],
      filterValue: constrain(source.filterValue + sin(i * 1.7) * 0.08, 0, 1),
      velocity: constrain(source.velocity * accent, 0.12, 0.86),
      pan: constrain((source.pan || 0) + sin(i * 0.73) * 0.28, -0.9, 0.9),
    });
  }
  const inBetweenCount = source.randomHits;
  const inBetweenLayers = max(1, ceil(inBetweenCount / regularCount));
  for (let i = 0; i < inBetweenCount; i++) {
    const slot = i % regularCount;
    const layer = floor(i / regularCount);
    const offset = (layer + 1) / (inBetweenLayers + 1);
    const accent = 0.58 + 0.32 * (1 - i / max(1, inBetweenCount));
    events.push({
      ...source,
      time: (slot + offset) / regularCount,
      probability: source.probability,
      random: false,
      inBetween: true,
      note: fixedScale[constrain(baseIndex + 3 + (i % 4), 0, fixedScale.length - 1)],
      filterValue: constrain(source.filterValue + 0.08 + sin(i * 2.1) * 0.1, 0, 1),
      velocity: source.velocity * accent * 0.62,
      pan: constrain((source.pan || 0) + cos(i * 1.1) * 0.42, -0.9, 0.9),
    });
  }
  return events.sort((a, b) => a.time - b.time);
}

function createClickPatternEvents(source) {
  const count = floor(map(source.densityValue || clickDensityValue, 0, 1, 2, 9));
  const events = [];
  const baseIndex = getScaleIndex(source.note);
  const simple = [0, 0.25, 0.5, 0.75];
  const syncopated = [0, 0.1875, 0.375, 0.625, 0.8125];
  const broken = [0, 0.125, 0.3125, 0.4375, 0.6875, 0.875];
  const shape = (source.patternType || 0) < 0.34 ? simple : (source.patternType || 0) < 0.67 ? syncopated : broken;
  const offsets = [0, 7, 3, 10, 5, 2, 8, 4, 9, 1, 6, 0];
  for (let i = 0; i < count; i++) {
    const accent = i % 3 === 0 ? 0.82 : 0.48 + (i % 4) * 0.08;
    const noteIndex = constrain(baseIndex + offsets[i % offsets.length] - 2, 0, fixedScale.length - 1);
    events.push({
      ...source,
      time: (shape[i % shape.length] + floor(i / shape.length)) / ceil(count / shape.length),
      probability: 1,
      note: fixedScale[noteIndex],
      velocity: source.velocity * accent,
      filterValue: constrain(source.filterValue + sin(i * 1.37) * 0.18, 0, 1),
      distortion: constrain(source.distortion * (0.28 + (i % 5) * 0.08), 0, 0.72),
      harmonicRatio: [1, 1.5, 2, 2.5][i % 4],
      durationSeconds: 0.012 + (i % 3) * 0.008,
      noiseAccent: i % 7 === 0 && (source.patternType || 0) > 0.42,
      pan: constrain((source.pan || 0) + sin(i * 0.91) * 0.5, -0.9, 0.9),
    });
  }
  return events.sort((a, b) => a.time - b.time);
}

function createLeadLoopEvents(source) {
  const baseIndex = getScaleIndex(source.note);
  const offsets = [0, 2, 4, 1, -1, 3];
  const count = 6;
  const events = [];
  for (let i = 0; i < count; i++) {
    const noteIndex = constrain(baseIndex + offsets[i % offsets.length], 0, fixedScale.length - 1);
    events.push({
      ...source,
      time: i / count,
      note: fixedScale[noteIndex],
      velocity: constrain(source.velocity * (i % 3 === 0 ? 0.86 : 0.58), 0.12, 0.92),
      filterValue: constrain(source.filterValue + sin(i * 0.9) * 0.12, 0, 1),
      probability: 1,
    });
  }
  return events;
}

function getScaleIndex(note) {
  return max(0, fixedScale.indexOf(note));
}

function getNoteHeightValue() {
  return fixedScale.indexOf(selectedNote) / (fixedScale.length - 1);
}

function getHandCloseness(hand) {
  if (!HandTracker.isValidHand(hand)) return 0.45;
  const wrist = hand.keypoints[0];
  const middleTip = hand.keypoints[fingerTips.middle];
  const indexTip = hand.keypoints[fingerTips.index];
  const pinkyTip = hand.keypoints[fingerTips.pinky];
  if (!isFinitePoint(wrist) || !isFinitePoint(middleTip) || !isFinitePoint(indexTip) || !isFinitePoint(pinkyTip)) return 0.45;
  const verticalSize = dist(wrist.x, wrist.y, middleTip.x, middleTip.y);
  const widthSize = dist(indexTip.x, indexTip.y, pinkyTip.x, pinkyTip.y);
  const handSize = max(verticalSize, widthSize);
  return constrain(map(handSize, 95, 260, 0, 1), 0, 1);
}

function saveActiveProcess() {
  if (!activeProcessKey || millis() < saveCooldownUntil) return;
  saveProcess(activeProcessKey);
}

function saveProcess(key) {
  const layer = layers[key];
  const now = millis();
  const recentRecording = layer.recording.filter((point) => now - point.t <= parameterLoopLength);

  layer.saved = true;
  layer.playing = true;
  layer.savedParams = { ...layer.params };
  layer.savedPattern = recentRecording.length
    ? recentRecording.map((point) => ({
        t: point.t - recentRecording[0].t,
        params: { ...point.params },
      }))
    : [{ t: 0, params: { ...layer.params } }];
  layer.events = generateEventsForProcess(key, layer.savedParams);
  layer.savedAt = now;
  layer.saveFlash = 1;
  layer.movedAfterSave = false;
  saveCooldownUntil = now + saveCooldown;

  const memory = {
    id: now + "-" + key,
    key,
    events: layer.events.map((event) => ({ ...event })),
    params: { ...layer.savedParams },
    pattern: layer.savedPattern ? layer.savedPattern.map((point) => ({ t: point.t, params: { ...point.params } })) : null,
    savedAt: now,
    cycleCount: 0,
    maxCycles: loopLifetimeCycles,
    lastCycleStep: 0,
    fading: false,
  };
  loopMemories.push(memory);
  pruneLoopMemories();

  visualSystem.createSavedBlock(memory);
}

function generateEventsForProcess(key, params) {
  if (key !== "loopCreator") return [];

  const scale = random(scaleBanks);
  const density = params.density;
  const variation = params.variation;
  const chance = params.chance;
  const eventCount = floor(map(density, 0, 1, 4, 18));
  const events = [];

  for (let i = 0; i < eventCount; i++) {
    const step = floor(random(0, 16));
    const noteIndex = floor(random(0, scale.length));
    const isClick = random() < 0.28 + chance * 0.22;
    events.push({
      time: step / 16,
      type: isClick ? "click" : "note",
      note: scale[noteIndex],
      noteIndex,
      scale,
      velocity: random(0.16, 0.46) * map(density, 0, 1, 0.6, 1),
      duration: random(["32n", "16n", "16n", "8n"]),
      probability: random(0.55, 0.95) - chance * 0.18,
      texture: random(0.08, 0.45),
      drift: random(-0.014, 0.014) * (0.3 + variation),
    });
  }

  events.sort((a, b) => a.time - b.time);
  return events;
}

function getPlaybackParams(key) {
  const layer = layers[key];
  if (activeProcessKey === key) return layer.params;
  if (layer.saved && layer.savedPattern) return getPatternParams(layer);
  if (layer.saved && layer.savedParams) return layer.savedParams;
  return null;
}

function getPatternParams(layer) {
  if (!layer.savedPattern || !layer.savedPattern.length) return layer.savedParams || defaultParams;

  const loopPosition = (millis() - layer.savedAt) % parameterLoopLength;
  let current = layer.savedPattern[0];
  for (let i = 1; i < layer.savedPattern.length; i++) {
    if (layer.savedPattern[i].t > loopPosition) break;
    current = layer.savedPattern[i];
  }
  return current.params;
}

function getMemoryParams(memory) {
  if (!memory.pattern || !memory.pattern.length) return memory.params || defaultParams;

  const loopPosition = (millis() - memory.savedAt) % parameterLoopLength;
  let current = memory.pattern[0];
  for (let i = 1; i < memory.pattern.length; i++) {
    if (memory.pattern[i].t > loopPosition) break;
    current = memory.pattern[i];
  }
  return current.params;
}

function memoryFade(memory) {
  if (memory.background) return 1;
  const remaining = memory.maxCycles - memory.cycleCount;
  if (remaining <= 1) return 0.35;
  if (remaining <= 2) return 0.65;
  return 1;
}

class BodyPoseTracker {
  static getPrimaryPose(sourcePoses) {
    if (!sourcePoses || !sourcePoses.length) return null;
    let best = sourcePoses[0];
    let bestScore = -1;
    for (const pose of sourcePoses) {
      const score = BodyPoseTracker.getPoseScore(pose);
      if (score > bestScore) {
        best = pose;
        bestScore = score;
      }
    }
    return best;
  }

  static getPoseScore(pose) {
    const leftWrist = BodyPoseTracker.getKeypoint(pose, "left_wrist", 0);
    const rightWrist = BodyPoseTracker.getKeypoint(pose, "right_wrist", 0);
    const leftShoulder = BodyPoseTracker.getKeypoint(pose, "left_shoulder", 0);
    const rightShoulder = BodyPoseTracker.getKeypoint(pose, "right_shoulder", 0);
    let score = 0;
    for (const point of [leftWrist, rightWrist, leftShoulder, rightShoulder]) if (isFinitePoint(point)) score += point.confidence || 1;
    return score;
  }

  static getKeypoint(pose, name, minimumConfidence = 0.18) {
    if (!pose) return null;
    let point = null;
    if (pose[name]) {
      point = pose[name];
    } else if (pose.keypoints && Array.isArray(pose.keypoints)) {
      point = pose.keypoints.find((item) => item && (item.name === name || item.part === name || item.label === name));
    }
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
    const confidence = Number.isFinite(point.confidence) ? point.confidence : Number.isFinite(point.score) ? point.score : 1;
    if (confidence < minimumConfidence) return null;
    return {
      x: constrain(point.x, 0, width),
      y: constrain(point.y, 0, height),
      confidence,
    };
  }
}

class HandTracker {
  static getSortedHands(sourceHands) {
    return sourceHands.slice().filter(HandTracker.isValidHand).sort((a, b) => HandTracker.getHandCenterX(a) - HandTracker.getHandCenterX(b));
  }

  static getSinglePerformerHands(sourceHands) {
    const sortedHands = HandTracker.getSortedHands(sourceHands);
    if (sortedHands.length <= 1) {
      if (sortedHands.length === 1) performerCenterX = HandTracker.getHandCenterX(sortedHands[0]);
      return sortedHands;
    }

    const maxPairDistance = width * 0.62;
    let bestPair = null;
    let bestPairScore = Infinity;
    for (let i = 0; i < sortedHands.length; i++) {
      for (let j = i + 1; j < sortedHands.length; j++) {
        const a = HandTracker.getHandCenterX(sortedHands[i]);
        const b = HandTracker.getHandCenterX(sortedHands[j]);
        const distance = abs(b - a);
        if (distance > maxPairDistance) continue;
        const center = (a + b) * 0.5;
        const score = performerCenterX === null ? -HandTracker.getPairOpenness(sortedHands[i], sortedHands[j]) : abs(center - performerCenterX);
        if (score < bestPairScore) {
          bestPair = [sortedHands[i], sortedHands[j]];
          bestPairScore = score;
        }
      }
    }

    if (bestPair) {
      performerCenterX = (HandTracker.getHandCenterX(bestPair[0]) + HandTracker.getHandCenterX(bestPair[1])) * 0.5;
      return bestPair.sort((a, b) => HandTracker.getHandCenterX(a) - HandTracker.getHandCenterX(b));
    }

    const chosen = performerCenterX === null
      ? HandTracker.getMostExpressiveHand(sortedHands)
      : sortedHands.reduce((best, hand) => {
          return abs(HandTracker.getHandCenterX(hand) - performerCenterX) < abs(HandTracker.getHandCenterX(best) - performerCenterX) ? hand : best;
        }, sortedHands[0]);
    performerCenterX = HandTracker.getHandCenterX(chosen);
    return [chosen];
  }

  static getPairOpenness(a, b) {
    return HandTracker.getHandOpennessScore(a) + HandTracker.getHandOpennessScore(b);
  }

  static getMostExpressiveHand(sortedHands) {
    let best = sortedHands[0];
    let bestScore = -1;
    for (const hand of sortedHands) {
      const score = HandTracker.getHandOpennessScore(hand);
      if (score > bestScore) {
        best = hand;
        bestScore = score;
      }
    }
    return best;
  }

  static getHandOpennessScore(hand) {
    const openness = GestureDetector.getFingerOpenness(hand);
    let score = 0;
    for (const key of fingerOrder) score += openness[key];
    return score;
  }

  static getHandBySide(sortedHands, label, fallbackIndex) {
    const hasLabels = sortedHands.some((hand) => hand.handedness);
    for (const hand of sortedHands) if (hand.handedness === label) return hand;
    if (hasLabels) return null;
    return sortedHands[fallbackIndex] || null;
  }

  static getPerformanceHands(sortedHands) {
    if (sortedHands.length === 1) {
      const rightHand = sortedHands[0];
      const activeFinger = GestureDetector.getStableActiveRightGesture(rightHand);
      return { leftHand: null, rightHand, activeFinger };
    }
    const labeledRight = HandTracker.getHandBySide(sortedHands, "Right", 1);
    const labeledLeft = HandTracker.getHandBySide(sortedHands, "Left", 0);
    const rightHand = labeledRight || sortedHands[1] || sortedHands[0] || null;
    const activeFinger = GestureDetector.getStableActiveRightGesture(rightHand);
    let leftHand = labeledLeft && labeledLeft !== rightHand ? labeledLeft : null;
    if (!leftHand) leftHand = sortedHands.find((hand) => hand !== rightHand) || null;
    return { leftHand, rightHand, activeFinger };
  }

  static isValidHand(hand) {
    if (!hand || !hand.keypoints || hand.keypoints.length < 21) return false;
    for (let i = 0; i < 21; i++) {
      const point = hand.keypoints[i];
      if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
    }
    return true;
  }

  static getHandCenterX(hand) {
    let total = 0;
    for (const point of hand.keypoints) total += point.x;
    return total / hand.keypoints.length;
  }
}

class GestureDetector {
  static getStableActiveRightGesture(hand) {
    const rawGesture = GestureDetector.getActiveRightGesture(hand);
    if (!rawGesture) {
      missingFingerFrames++;
      pendingFingerCount = null;
      pendingFingerFrames = 0;
      if (missingFingerFrames >= fingerModeMissingFrames) stableActiveFinger = null;
      return stableActiveFinger;
    }

    missingFingerFrames = 0;
    if (!stableActiveFinger) {
      if (pendingFingerCount === rawGesture.count) {
        pendingFingerFrames++;
      } else {
        pendingFingerCount = rawGesture.count;
        pendingFingerFrames = 1;
      }
      if (pendingFingerFrames >= fingerModeSwitchFrames) {
        stableActiveFinger = rawGesture;
        pendingFingerCount = null;
        pendingFingerFrames = 0;
      }
      return stableActiveFinger;
    }

    if (rawGesture.count === stableActiveFinger.count) {
      stableActiveFinger = rawGesture;
      pendingFingerCount = null;
      pendingFingerFrames = 0;
      return stableActiveFinger;
    }

    if (pendingFingerCount === rawGesture.count) {
      pendingFingerFrames++;
    } else {
      pendingFingerCount = rawGesture.count;
      pendingFingerFrames = 1;
    }

    if (pendingFingerFrames >= fingerModeSwitchFrames) {
      stableActiveFinger = rawGesture;
      pendingFingerCount = null;
      pendingFingerFrames = 0;
    }

    return stableActiveFinger;
  }

  static getActiveRightGesture(hand) {
    if (!HandTracker.isValidHand(hand)) return null;
    const openness = GestureDetector.getFingerOpenness(hand);
    const openFingers = GestureDetector.getRequiredOpenFingers(openness);
    if (!openFingers) return null;
    const count = openFingers.length;

    let x = 0;
    let y = 0;
    for (const key of openFingers) {
      const point = hand.keypoints[fingerTips[key]];
      if (!isFinitePoint(point)) return null;
      x += point.x;
      y += point.y;
    }

    return {
      key: openFingers[openFingers.length - 1],
      count,
      openFingers,
      processKey: processOrder[count - 1],
      point: { x: x / openFingers.length, y: y / openFingers.length },
      points: openFingers.map((key) => ({ key, point: hand.keypoints[fingerTips[key]] })),
    };
  }

  static getRequiredOpenFingers(openness) {
    const openThreshold = 0.52;
    const closedThreshold = 0.62;
    const modeChecks = [
      ["index"],
      ["thumb", "index"],
      ["thumb", "index", "middle"],
      ["thumb", "index", "middle", "ring"],
      ["thumb", "index", "middle", "ring", "pinky"],
    ];

    for (let i = modeChecks.length - 1; i >= 0; i--) {
      const required = modeChecks[i];
      let matches = true;
      for (const key of fingerOrder) {
        const shouldBeOpen = required.includes(key);
        if (shouldBeOpen && openness[key] < openThreshold) matches = false;
        if (!shouldBeOpen && openness[key] > closedThreshold) matches = false;
      }
      if (matches) return requiredFingerModes[i].slice();
    }
    return null;
  }

  static getFingerOpenness(hand) {
    const openness = {};
    for (const key of fingerOrder) openness[key] = GestureDetector.getFingerOpenAmount(hand, key);
    return openness;
  }

  static isOpenPalm(hand) {
    if (!HandTracker.isValidHand(hand)) return false;
    const openness = GestureDetector.getFingerOpenness(hand);
    return fingerOrder.every((key) => openness[key] > 0.72);
  }

  static getFingerOpenAmount(hand, key) {
    if (!HandTracker.isValidHand(hand)) return 0;
    const wrist = hand.keypoints[0];
    const tip = hand.keypoints[fingerTips[key]];
    const joint = hand.keypoints[fingerJoints[key]];
    if (!isFinitePoint(wrist) || !isFinitePoint(tip) || !isFinitePoint(joint)) return 0;
    const handScale = GestureDetector.getHandScale(hand);
    const extension = dist(tip.x, tip.y, wrist.x, wrist.y) - dist(joint.x, joint.y, wrist.x, wrist.y);
    const verticalLift = joint.y - tip.y;

    if (key === "thumb") {
      const indexBase = hand.keypoints[5];
      const pinkyBase = hand.keypoints[17];
      if (!isFinitePoint(indexBase) || !isFinitePoint(pinkyBase)) return 0;
      const palmCenter = { x: (wrist.x + indexBase.x + pinkyBase.x) / 3, y: (wrist.y + indexBase.y + pinkyBase.y) / 3 };
      const thumbSpread = dist(tip.x, tip.y, palmCenter.x, palmCenter.y);
      return constrain(map(thumbSpread / handScale, 0.34, 0.74, 0, 1), 0, 1);
    }

    const distanceScore = constrain(map(extension / handScale, 0.02, 0.24, 0, 1), 0, 1);
    const liftScore = constrain(map(verticalLift / handScale, -0.04, 0.18, 0, 1), 0, 1);
    return constrain(distanceScore * 0.72 + liftScore * 0.28, 0, 1);
  }

  static getHandScale(hand) {
    if (!HandTracker.isValidHand(hand)) return 120;
    const wrist = hand.keypoints[0];
    const middleBase = hand.keypoints[9];
    const pinkyBase = hand.keypoints[17];
    if (!isFinitePoint(wrist) || !isFinitePoint(middleBase) || !isFinitePoint(pinkyBase)) return 120;
    return max(60, dist(wrist.x, wrist.y, middleBase.x, middleBase.y) + dist(middleBase.x, middleBase.y, pinkyBase.x, pinkyBase.y));
  }

  static isThumbIndexPinch(hand) {
    if (!HandTracker.isValidHand(hand)) return false;
    const thumb = hand.keypoints[fingerTips.thumb];
    const index = hand.keypoints[fingerTips.index];
    if (!isFinitePoint(thumb) || !isFinitePoint(index)) return false;
    return dist(thumb.x, thumb.y, index.x, index.y) < 34;
  }
}

function isFinitePoint(point) {
  return !!point && Number.isFinite(point.x) && Number.isFinite(point.y);
}

function mutateNote(event, amount) {
  if (!event.scale || random() > amount * 0.16) return event.note;
  const shift = random([-1, 1]);
  const index = constrain((event.noteIndex || 0) + shift, 0, event.scale.length - 1);
  return event.scale[index];
}

function noteToFrequency(note) {
  return Tone.Frequency(note).toFrequency();
}

function averageRange(values, start, end) {
  if (!values || !values.length || end <= start) return 0;
  const safeStart = constrain(floor(start), 0, values.length);
  const safeEnd = constrain(floor(end), safeStart, values.length);
  let total = 0;
  for (let i = safeStart; i < safeEnd; i++) total += values[i];
  return safeEnd > safeStart ? total / (safeEnd - safeStart) : 0;
}

function randomizeInversion(chord, inversion) {
  const notes = chord.slice();
  const rotations = floor(random(0, max(1, inversion + 2)));
  for (let i = 0; i < rotations; i++) {
    const note = notes.shift();
    notes.push(Tone.Frequency(Tone.Frequency(note).toMidi() + 12, "midi").toNote());
  }
  return notes;
}

function lerpPoint(a, b, amount) {
  return { x: lerp(a.x, b.x, amount), y: lerp(a.y, b.y, amount) };
}

function resetStillTracking() {
  for (const key of processOrder) {
    layers[key].stillSince = null;
    layers[key].lastTip = null;
  }
}
