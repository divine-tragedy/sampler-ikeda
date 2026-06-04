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
let sampleHandStates = {
  left: { cell: null, enteredAt: 0, lastTriggerAt: -Infinity, activatedCell: null },
  right: { cell: null, enteredAt: 0, lastTriggerAt: -Infinity, activatedCell: null },
};
let sampleModeWasActive = false;
let saveCooldownUntil = 0;
let stableActiveFinger = null;
let pendingFingerCount = null;
let pendingFingerFrames = 0;
let missingFingerFrames = 0;
let activeMode = null;
let lastActivatedMode = null;
let lastActivatedModeAt = 0;
let candidateMode = null;
let candidateModeIsReset = false;
let hoverWrist = null;
let dwellStartTime = 0;
let dwellProgress = 0;
let activeInstructionText = "select a sound";
let instructionHoldUntil = 0;
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
let percussionToneValue = 0.48;
let percussionNoiseMixValue = 0.18;
let percussionPressureValue = 0.5;
let clickPatternValue = 0.35;
let clickDensityValue = 0.3;
let clickHarmonyValue = 0.45;
let clickGlitchValue = 0.22;
let clickSpaceValue = 0.24;
let leadInstabilityValue = 0.2;
let leadSpeedValue = 0;
let lastLeadPoint = null;
let lastLeadPointAt = 0;
let droneCursorClouds = { left: [], right: [] };
let droneCursorTrace = [];
let previousDroneCursorPoints = { left: null, right: null };
let handEchoTrails = { left: [], right: [] };

const canvasW = 1048;
const canvasH = 756;
const stillThreshold = 3.4;
const stillSaveTime = 2000;
const saveCooldown = 1400;
const parameterLoopLength = 5000;
const parameterRecordInterval = 70;
const loopLifetimeCycles = 5;
const backgroundPatternUpdateInterval = 8000;
const sampleHoldDuration = 260;
const sampleRetriggerCooldown = 1100;
const sampleSameCellCooldown = 3000;
const fingerModeSwitchFrames = 8;
const fingerModeMissingFrames = 15;
const instructionBarHeight = 16;
const modeButtonHeight = 16;
const modeDwellDuration = 1500;
const performanceTop = instructionBarHeight + modeButtonHeight;
const modeActivationHitHeight = 96;
const sampleGridTop = performanceTop + 34;
const droneCursorGrid = 5;

const processOrder = ["loopCreator", "motion", "texture", "space", "decay"];
const modeButtons = [
  { mode: "click", key: "texture" },
  { mode: "percussion", key: "motion" },
  { mode: "drone", key: "loopCreator" },
  { mode: "lead", key: "space" },
  { mode: "sample", key: "decay" },
  { mode: "reset", key: "reset", action: "reset" },
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
  ["A1", "C2", "D2", "E2", "G2", "A2", "C3", "D3", "E3", "G3", "A3"],
  ["A2", "C3", "D3", "E3", "G3", "A3", "C4", "D4", "E4", "G4", "A4"],
  ["E1", "G1", "A1", "C2", "D2", "E2", "G2", "A2", "C3", "D3", "E3"],
];
const fixedScale = ["A1", "C2", "D2", "E2", "G2", "A2", "C3", "D3", "E3", "G3", "A3", "C4"];
const chordBank = [
  ["A1", "E2", "C3"],
  ["C2", "G2", "E3"],
  ["D2", "A2", "E3"],
  ["E2", "A2", "G3"],
  ["G1", "D2", "A2"],
];
const droneChordBank = [
  ["A2", "C3", "E3", "G3"],
  ["C3", "E3", "G3", "A3"],
  ["D3", "E3", "A3", "C4"],
  ["E2", "A2", "D3", "G3"],
  ["G2", "A2", "D3", "E3"],
  ["A1", "E2", "A2", "C3"],
];
const droneLowScale = ["A1", "E2", "G2", "A2", "C3", "D3", "E3", "G3", "A3"];
const rhythmSubdivisions = [1, 2, 3, 4, 6, 8];
const samplePaths = [
  "sounds/Female-Evil-Laugh.wav",
  "sounds/Lakker-Tuk-tuk.mp3",
  "sounds/text/Hello-MyNameIsBjork.mp3",
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
let sampleGridLayout = [];
let sampleGridLayoutKey = "";
let selectedNote = "A2";
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
  const menuPoint = getMenuSelectionPoint(trackedHands.leftHand, trackedHands.rightHand);
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

function getMenuSelectionPoint(leftHand, rightHand) {
  const candidates = [
    getHandControlPoint(leftHand),
    getHandControlPoint(rightHand),
    bodyLeftWrist,
    bodyRightWrist,
  ].filter(isFinitePoint);
  const menuCandidates = candidates.filter((point) => point.y >= 0 && point.y <= modeActivationHitHeight);
  if (menuCandidates.length) return menuCandidates.sort((a, b) => a.y - b.y)[0];
  return candidates[0] || null;
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
    if (millis() > instructionHoldUntil) activeInstructionText = getModeInstructionText(activeMode);
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
    candidateModeIsReset = false;
    dwellStartTime = 0;
    dwellProgress = 0;
    if (millis() > instructionHoldUntil) activeInstructionText = getModeInstructionText(activeMode);
    return;
  }

  const isModeReset = hovered.mode === activeMode && hovered.mode !== "reset" && millis() - lastActivatedModeAt > 900;
  if (candidateMode !== hovered.mode || candidateModeIsReset !== isModeReset) {
    candidateMode = hovered.mode;
    candidateModeIsReset = isModeReset;
    dwellStartTime = millis();
    dwellProgress = 0;
  }

  dwellProgress = constrain((millis() - dwellStartTime) / modeDwellDuration, 0, 1);
  const remaining = max(1, ceil((modeDwellDuration - (millis() - dwellStartTime)) / 1000));
  activeInstructionText = isModeReset ? "clear " + hovered.mode + "... " + remaining : "loading... " + remaining;

  if (dwellProgress >= 1) {
    if (candidateModeIsReset) resetSingleMode(candidateMode);
    else activateMode(candidateMode);
  }
}

function getModeInstructionText(mode) {
  if (!mode) return "select a sound";
  if (mode === "sample") return "samples on / clap to loop / hold button to stop";
  return mode + " on / hold button again to stop";
}

function showInstruction(text, hold = 1700) {
  activeInstructionText = text;
  instructionHoldUntil = millis() + hold;
}

function getHoveredModeBox(wrist) {
  if (!isFinitePoint(wrist)) return null;
  if (wrist.y < 0 || wrist.y > modeActivationHitHeight) return null;
  const index = floor(constrain(map(wrist.x, 0, width, 0, modeButtons.length), 0, modeButtons.length - 0.001));
  return modeButtons[index];
}

function activateMode(mode) {
  if (mode === "reset") {
    resetPerformance();
    return;
  }
  if (!mode || !modeToProcessKey[mode]) return;
  const nextKey = modeToProcessKey[mode];
  const previousKey = activeProcessKey;
  if (previousKey && previousKey !== nextKey) autoCaptureModeOnExit(previousKey);
  activeMode = mode;
  lastActivatedMode = mode;
  lastActivatedModeAt = millis();
  activeProcessKey = nextKey;
  candidateMode = null;
  candidateModeIsReset = false;
  dwellStartTime = 0;
  dwellProgress = 0;
  showInstruction(getModeInstructionText(mode), 900);
  if (activeProcessKey === "loopCreator") lastLiveDroneAt = -Infinity;
  if (activeProcessKey === "space") lastLiveLeadAt = -Infinity;
  if (activeProcessKey === "motion") lastLivePercussionAt = -Infinity;
  if (activeProcessKey === "texture") lastLiveClickAt = -Infinity;
  if (!audioReady && !audioStarting) startAudioFromHands();
  ensureModeBackgroundLoop(activeProcessKey);
}

function resetSingleMode(mode) {
  if (!mode || !modeToProcessKey[mode]) return;
  const key = modeToProcessKey[mode];
  loopMemories = loopMemories.filter((memory) => memory.key !== key);
  savedBlocks = savedBlocks.filter((block) => block.key !== key);
  if (key === "decay") {
    pendingSampleLoopEvent = null;
    lastSampleEvents = { left: null, right: null };
    if (audioEngine && audioEngine.sampleEngine && typeof Tone !== "undefined") {
      try {
        audioEngine.stopSampleLoop(Tone.now());
        for (const voice of Array.from(audioEngine.sampleEngine.activeVoices || [])) voice.stop(Tone.now());
      } catch (error) {}
    }
  }
  if (key === "loopCreator" && audioEngine && audioEngine.loopEngine && audioEngine.loopEngine.voice && typeof Tone !== "undefined") {
    try {
      for (const note of audioEngine.loopEngine.activeDroneNotes || []) audioEngine.loopEngine.voice.triggerRelease(note, Tone.now());
      audioEngine.loopEngine.activeDroneNotes = [];
    } catch (error) {}
  }
  if (activeMode === mode) {
    activeMode = null;
    activeProcessKey = null;
  }
  candidateMode = null;
  candidateModeIsReset = false;
  dwellStartTime = 0;
  dwellProgress = 0;
  showInstruction(mode + " stopped");
}

function autoCaptureModeOnExit(key) {
  if (key === "decay") {
    autoCaptureSampleLoopsOnExit();
    return;
  }
  if (!["loopCreator", "motion", "texture", "space"].includes(key)) return;
  const event = lastGestureEvents[key];
  if (!event) return;
  storeGestureLoop(key, event, true);
  showInstruction(key === "loopCreator" ? "drone remembered" : key === "motion" ? "percussion remembered" : key === "texture" ? "click remembered" : "lead remembered");
}

function autoCaptureSampleLoopsOnExit() {
  const captured = [];
  for (const side of ["left", "right"]) {
    const state = sampleHandStates[side];
    const gridCell = selectedSampleGridCells[side] !== null
      ? selectedSampleGridCells[side]
      : state && state.cell !== null
        ? state.cell
        : lastSampleEvents[side]
          ? lastSampleEvents[side].gridCell
          : null;
    if (gridCell === null || captured.includes(gridCell)) continue;
    const point = getSampleGridCellCenter(gridCell);
    const event = {
      ...createSampleEvent(point, constrain(gridCell, 0, samplePaths.length - 1), gridCell, 1, side),
      liveSample: false,
      loopPlayback: true,
    };
    updatePersistentSampleLoop(event, side);
    captured.push(gridCell);
  }
  if (captured.length) showInstruction(captured.length === 1 ? "sample kept looping" : "samples kept looping");
}

function ensureModeBackgroundLoop(key) {
  if (!key || key === "decay") return;
  if (loopMemories.some((memory) => memory.key === key && memory.background)) return;
  const rightPoint = bodyRightWrist || bodyLeftWrist || { x: width * 0.62, y: height * 0.56 };
  const leftPoint = bodyLeftWrist || bodyRightWrist || { x: width * 0.38, y: height * 0.58 };
  const rightHand = createBodyHand(rightPoint, bodyRightShoulder || bodyLeftShoulder, "Right");
  const leftHand = createBodyHand(leftPoint, bodyLeftShoulder || bodyRightShoulder, "Left");
  const event = createGestureEvent(key, rightHand, leftHand);
  if (!event) return;
  lastGestureEvents[key] = event;
  updatePersistentBackgroundLoop(key, event);
  if (audioReady && audioEngine) {
    try {
      audioEngine.playGestureEvent(key === "motion" ? { ...event, probability: 1, accent: true, velocity: event.velocity * 1.18 } : event, Tone.now(), key === "texture" ? 0.58 : 0.9);
    } catch (error) {
      console.error(error);
    }
  }
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
    showInstruction(activeMode === "sample" ? "clap: sample" : getModeInstructionText(activeMode), 900);
    return true;
  }
  return false;
}

function handleClap(mode, rightHand, leftHand) {
  if (!mode || !modeToProcessKey[mode]) return;
  if (!audioReady && !audioStarting) startAudioFromHands();
  const key = modeToProcessKey[mode];
  if (key === "space" || key === "loopCreator" || key === "motion" || key === "texture") {
    showInstruction(key === "space" ? "lead is live only" : mode + " remembers on exit");
    return;
  }
  if (key === "decay") {
    triggerSelectedSampleLoopMemory(rightHand, leftHand);
  } else {
    triggerSelectedNote(rightHand, leftHand, key);
  }
  showInstruction(mode + " loop stored");
}

function createModeGesture(mode, point) {
  if (!mode || !modeToProcessKey[mode]) return null;
  if (!isFinitePoint(point)) {
    if (mode !== "drone") return null;
    point = { x: width * 0.5, y: height * 0.58 };
  }
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
    const isLooped = item.key && item.key !== "reset" && hasLoopForKey(item.key);
    if (isLooped) {
      noStroke();
      fill(210, 28, 24);
      rect(x, y, boxW, modeButtonHeight);
    } else if (activeMode === item.mode) {
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
    fill(isLooped || activeMode === item.mode || (candidateMode === item.mode && dwellProgress > 0) ? 0 : 190);
    text(item.mode, x + boxW / 2, y + modeButtonHeight / 2);
  }
  textAlign(LEFT, BASELINE);
}

function hasLoopForKey(key) {
  return !!key && loopMemories.some((memory) => memory.key === key && memory.background);
}

function drawBodyPosePoints() {
  noStroke();
  if (activeProcessKey === "space") return;
  if (activeProcessKey === "loopCreator" || activeProcessKey === "texture") {
    const hasVisibleHand = isFinitePoint(bodyLeftWrist) || isFinitePoint(bodyRightWrist);
    if (activeProcessKey === "texture" && !hasVisibleHand) return;
    updateDroneCursorTrace();
    const scale = activeProcessKey === "loopCreator" ? 0.34 : 0.24;
    const intensity = activeProcessKey === "loopCreator" ? 0.72 : 0.34;
    if (isFinitePoint(bodyLeftWrist)) drawDroneCursor(bodyLeftWrist, "left", scale, intensity);
    if (isFinitePoint(bodyRightWrist)) drawDroneCursor(bodyRightWrist, "right", scale, intensity);
    return;
  }
  if (isFinitePoint(bodyLeftWrist)) {
    drawHandEchoPoint(bodyLeftWrist, "left", 0);
  }
  if (isFinitePoint(bodyRightWrist)) {
    drawHandEchoPoint(bodyRightWrist, "right", 1.7);
  }
}

function getHandMarkerColor(side) {
  if (activeProcessKey === "space") return color(255, 36, 30);
  if (activeProcessKey === "texture" && side === "left") return color(35, 112, 255);
  if (activeProcessKey === "texture") return color(0);
  if (side === "left") return color(35, 112, 255);
  return color(255, 214, 26);
}

function drawHandEchoPoint(point, side, phase) {
  const pulse = (sin(frameCount * 0.18 + phase) + 1) * 0.5;
  const trail = handEchoTrails[side] || [];
  trail.push({ x: point.x, y: point.y, life: 1, phase, seed: random(1000) });
  while (trail.length > 32) trail.shift();
  handEchoTrails[side] = trail;

  noStroke();
  for (let i = 0; i < trail.length; i++) {
    const item = trail[i];
    const age = i / max(1, trail.length - 1);
    const fade = pow(age, 1.28) * item.life;
    const shift = (1 - age) * 34;
    const driftX = (noise(item.seed, frameCount * 0.018) - 0.5) * 42 * (1 - age);
    const driftY = (noise(item.seed + 20, frameCount * 0.018) - 0.5) * 32 * (1 - age);
    const size = 16 + pulse * 5 + age * 22;
    for (let layer = 0; layer < 8; layer++) {
      const layerScale = 4.9 - layer * 0.52;
      const layerAlpha = (3 + layer * 4.4) * fade;
      const offset = shift * (1.25 - layer * 0.11);
      fill(255, 32, 28, layerAlpha);
      circle(
        item.x + offset + driftX * (1 - layer * 0.08),
        item.y - offset * 0.55 + driftY * (1 - layer * 0.08),
        size * layerScale
      );
    }
    if (i % 2 === 0) {
      const fragmentCount = 5;
      for (let f = 0; f < fragmentCount; f++) {
        const scatter = (1 - age) * random(14, 86);
        const angle = random(TWO_PI);
        fill(255, 32, 28, 26 * fade);
        rect(
          item.x + driftX + cos(angle) * scatter,
          item.y + driftY + sin(angle) * scatter,
          random([1, 2, 3]),
          random([1, 2, 3])
        );
      }
    }
  }
  fill(255, 32, 28, 8);
  circle(point.x, point.y, 104 + pulse * 18);
  fill(255, 32, 28, 14);
  circle(point.x, point.y, 72 + pulse * 14);
  fill(255, 32, 28, 28);
  circle(point.x, point.y, 46 + pulse * 10);
  fill(255, 32, 28, 72);
  circle(point.x, point.y, 27 + pulse * 6);
  fill(255, 32, 28, 230);
  circle(point.x, point.y, 13 + pulse * 3);
}

function makeDroneCursorCloud(side) {
  const cloud = [];
  for (let i = 0; i < 950; i++) {
    const a = random(TWO_PI);
    const noiseShape = 120 + noise(cos(a) * 1.4 + 10, sin(a) * 1.4 + 10) * 95 + random(-45, 45);
    const r = random(40, noiseShape);
    if (r < 75 && random() < 0.82) continue;
    const clump = noise(cos(a) * 3.5 + (side === "left" ? 5 : 13), sin(a) * 3.5);
    if (random() > clump * 0.9) continue;
    cloud.push({
      x: cos(a) * r + random(-18, 18),
      y: sin(a) * r + random(-18, 18),
      s: random([2, 2, 3, 3, 4, 6]),
      phase: random(TWO_PI),
      pulse: random(0.02, 0.09),
      drift: random(0.2, 1.8),
    });
  }
  droneCursorClouds[side] = cloud;
}

function drawDroneCursor(point, side, scale = 0.34, intensity = 0.72) {
  if (!droneCursorClouds[side] || !droneCursorClouds[side].length) makeDroneCursorCloud(side);
  const previous = previousDroneCursorPoints[side] || point;
  const speed = dist(point.x, point.y, previous.x, previous.y);
  if (speed > 0.5) addDroneDiffusedTrace(previous, point, speed * intensity, scale);
  previousDroneCursorPoints[side] = { x: point.x, y: point.y };
  const cursorValue = activeProcessKey === "texture" ? 0 : 255;
  noStroke();
  for (const p of droneCursorClouds[side]) {
    const n = noise(p.x * 0.012 + frameCount * 0.015, p.y * 0.012);
    const sparkle = sin(frameCount * p.pulse + p.phase);
    const glitch = random() < 0.025;
    let alpha = (map(sparkle, -1, 1, 35, 230) + speed * 6) * intensity;
    if (glitch) alpha = 255;
    if (random() < 0.025) alpha *= 0.15;
    const wobbleX = map(n, 0, 1, -8, 8) + random(-1.5, 1.5);
    const wobbleY = map(n, 0, 1, 8, -8) + random(-1.5, 1.5);
    const x = snapDroneCursor(point.x + (p.x + wobbleX) * scale);
    const y = snapDroneCursor(point.y + (p.y + wobbleY) * scale);
    fill(cursorValue, constrain(alpha, 0, 255));
    rect(x, y, p.s, p.s);
    if (random() < 0.006 * intensity) {
      fill(cursorValue, 240);
      rect(x + random([-droneCursorGrid, droneCursorGrid, 0]), y, p.s * 2, p.s * 2);
    }
  }
}

function addDroneDiffusedTrace(previous, current, speed, scale = 0.34) {
  const amount = constrain(speed * 1.4, 4, 45);
  const moveAngle = atan2(current.y - previous.y, current.x - previous.x);
  for (let i = 0; i < amount; i++) {
    const t = random();
    const baseX = lerp(previous.x, current.x, t);
    const baseY = lerp(previous.y, current.y, t);
    const sideAngle = moveAngle + HALF_PI * random([-1, 1]);
    const scatter = random(5, 75) * random() * scale;
    const backscatter = random(-35, 25) * scale;
    droneCursorTrace.push({
      x: baseX + cos(sideAngle) * scatter + cos(moveAngle) * backscatter + random(-18, 18) * scale,
      y: baseY + sin(sideAngle) * scatter + sin(moveAngle) * backscatter + random(-18, 18) * scale,
      vx: random(-0.7, 0.7),
      vy: random(-0.7, 0.7),
      s: random([2, 2, 3, 3, 4, 6]),
      life: random(25, 90),
      maxLife: random(60, 120),
      flicker: random(TWO_PI),
    });
  }
}

function updateDroneCursorTrace() {
  noStroke();
  const cursorValue = activeProcessKey === "texture" ? 0 : 255;
  for (let i = droneCursorTrace.length - 1; i >= 0; i--) {
    const p = droneCursorTrace[i];
    const fade = p.life / p.maxLife;
    const sparkle = sin(frameCount * 0.2 + p.flicker);
    const alpha = 210 * fade + sparkle * 30;
    p.vx += random(-0.08, 0.08);
    p.vy += random(-0.08, 0.08);
    p.x += p.vx;
    p.y += p.vy;
    if (random() < 0.04) {
      p.x += random([-droneCursorGrid, droneCursorGrid, droneCursorGrid * 2, -droneCursorGrid * 2]);
      p.y += random([-droneCursorGrid, droneCursorGrid, droneCursorGrid * 2, -droneCursorGrid * 2]);
    }
    fill(cursorValue, constrain(alpha, 0, 255));
    rect(snapDroneCursor(p.x), snapDroneCursor(p.y), p.s, p.s);
    if (random() < 0.08 * fade) {
      fill(cursorValue, alpha * 0.55);
      rect(snapDroneCursor(p.x + random(-20, 20)), snapDroneCursor(p.y + random(-20, 20)), random([1, 2, 3]), random([1, 2, 3]));
    }
    p.life--;
    if (p.life <= 0) droneCursorTrace.splice(i, 1);
  }
  if (droneCursorTrace.length > 1800) droneCursorTrace.splice(0, droneCursorTrace.length - 1800);
}

function snapDroneCursor(value) {
  return round(value / droneCursorGrid) * droneCursorGrid;
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
  if (activeProcessKey !== "space" || millis() - lastLiveLeadAt < max(55, 190 - leadSpeedValue * 120)) return;
  const rightHand = createBodyHand(bodyRightWrist || bodyLeftWrist, bodyRightShoulder || bodyLeftShoulder, "Right");
  const leftHand = createBodyHand(bodyLeftWrist, bodyLeftShoulder, "Left");
  if (!rightHand) return;
  const event = createGestureEvent("space", rightHand, leftHand);
  lastGestureEvents.space = event;
  updatePersistentBackgroundLoop("space", event);
  audioEngine.playGestureEvent(event, Tone.now(), 0.82);
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
  updatePersistentBackgroundLoop("motion", event);
  const liveAccent = millis() - lastLivePercussionAt > 620 || event.subdivision <= 2;
  audioEngine.playGestureEvent({ ...event, probability: 1, accent: liveAccent, velocity: event.velocity * 1.28 }, Tone.now(), 1);
  visualSystem.createEventParticle(event);
  lastLivePercussionAt = millis();
}

function updateLiveClickPattern() {
  if (activeProcessKey !== "texture" || millis() - lastLiveClickAt < 260) return;
  const rightHand = createBodyHand(bodyRightWrist || bodyLeftWrist, bodyRightShoulder || bodyLeftShoulder, "Right");
  const leftHand = createBodyHand(bodyLeftWrist, bodyLeftShoulder, "Left");
  if (!rightHand && !leftHand) return;
  const event = createGestureEvent("texture", rightHand, leftHand);
  lastGestureEvents.texture = event;
  updatePersistentBackgroundLoop("texture", event);
  audioEngine.playGestureEvent({ ...event, velocity: event.velocity * 0.82, probability: max(event.probability || 0.4, 0.72) }, Tone.now(), 0.68);
  visualSystem.createEventParticle(event);
  lastLiveClickAt = millis();
}

function updateLiveOneFingerDrone() {
  if (activeProcessKey !== "loopCreator" || millis() - lastLiveDroneAt < 260) return;
  const fallbackPoint = { x: width * 0.5, y: height * 0.58 };
  const rightHand = createBodyHand(bodyRightWrist || bodyLeftWrist || fallbackPoint, bodyRightShoulder || bodyLeftShoulder, "Right");
  const leftHand = createBodyHand(bodyLeftWrist || bodyRightWrist || fallbackPoint, bodyLeftShoulder || bodyRightShoulder, "Left");
  if (!rightHand) return;
  const event = createGestureEvent("loopCreator", rightHand, leftHand);
  lastGestureEvents.loopCreator = event;
  event.velocity = constrain(map(selectedFilter, 0, 1, 0.46, 0.82), 0.42, 0.86);
  updatePersistentBackgroundLoop("loopCreator", event);
  audioEngine.playGestureEvent(event, Tone.now(), 0.82);
  lastLiveDroneAt = millis();
}

function updatePersistentBackgroundLoop(key, event) {
  if (!key || !event || !["loopCreator", "motion", "texture", "space"].includes(key)) return;
  const memoryEvents = key === "motion"
    ? createRegularPercussionEvents(event)
    : key === "texture"
      ? createClickPatternEvents(event)
      : key === "space"
        ? createLeadLoopEvents(event)
        : [event];
  let memory = loopMemories.find((item) => item.key === key && item.background);
  if (!memory) {
    memory = {
      id: millis() + "-" + key,
      key,
      events: memoryEvents,
      params: { ...layers[key].params, depth: key === "loopCreator" ? layers.loopCreator.params.depth : selectedFilter },
      pattern: null,
      savedAt: millis(),
      cycleCount: 0,
      maxCycles: Infinity,
      lastCycleStep: 0,
      fading: false,
      background: true,
      nextPatternUpdateAt: millis() + backgroundPatternUpdateInterval,
    };
    loopMemories.push(memory);
    pruneLoopMemories();
    visualSystem.createSavedBlock(memory);
    showInstruction(getModeNameForKey(key) + " loop created");
    return;
  }
  const now = millis();
  const patternInterval = key === "loopCreator" ? backgroundPatternUpdateInterval * 1.5 : backgroundPatternUpdateInterval;
  if (!memory.nextPatternUpdateAt || now >= memory.nextPatternUpdateAt) {
    memory.events = memoryEvents;
    memory.nextPatternUpdateAt = now + patternInterval;
  } else if (key === "loopCreator" && memory.events.length) {
    memory.events[0] = {
      ...memory.events[0],
      filterValue: event.filterValue,
      texture: event.texture,
      instability: event.instability,
      space: event.space,
      velocity: event.velocity,
      pan: event.pan,
      visualX: event.visualX,
      visualY: event.visualY,
    };
  }
  memory.params = { ...layers[key].params, depth: key === "loopCreator" ? layers.loopCreator.params.depth : selectedFilter };
  memory.savedAt = now;
  memory.cycleCount = 0;
  memory.fading = false;
}

function getModeNameForKey(key) {
  const item = modeButtons.find((button) => button.key === key);
  return item ? item.mode : key;
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

function getTopModeButtonAt(x, y) {
  if (y < instructionBarHeight || y > performanceTop) return null;
  const index = floor(constrain(map(x, 0, width, 0, modeButtons.length), 0, modeButtons.length - 0.001));
  return modeButtons[index] || null;
}

function mousePressed() {
  const clickedModeButton = getTopModeButtonAt(mouseX, mouseY);
  if (clickedModeButton && clickedModeButton.action === "reset") {
    resetPerformance();
    return;
  }
  if (clickedModeButton && clickedModeButton.mode === activeMode) {
    resetSingleMode(clickedModeButton.mode);
    return;
  }
  startAudio(true);
}

function touchStarted() {
  const clickedModeButton = getTopModeButtonAt(mouseX, mouseY);
  if (clickedModeButton && clickedModeButton.action === "reset") {
    resetPerformance();
    return false;
  }
  if (clickedModeButton && clickedModeButton.mode === activeMode) {
    resetSingleMode(clickedModeButton.mode);
    return false;
  }
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
  if (isFinitePoint(rightPoint)) {
    percussionDensityValue = constrain(map(rightPoint.x, width * 0.06, width * 0.94, 0, 1), 0, 1);
    percussionToneValue = constrain(map(rightPoint.y, height * 0.94, performanceTop, 0, 1), 0, 1);
    const noteIndex = floor(constrain(map(percussionToneValue, 0, 1, 0, fixedScale.length), 0, fixedScale.length - 0.001));
    selectedNote = fixedScale[noteIndex];
  }
  if (isFinitePoint(leftPoint)) {
    percussionNoiseMixValue = constrain(map(leftPoint.x, width * 0.06, width * 0.94, 0, 1), 0, 1);
    percussionPressureValue = constrain(map(leftPoint.y, height * 0.94, performanceTop, 0, 1), 0, 1);
    selectedFilter = percussionPressureValue;
  }
  const layer = layers.motion;
  layer.target.density = constrain(0.28 + percussionDensityValue * 0.72, 0.24, 1);
  layer.target.variation = constrain(0.16 + percussionNoiseMixValue * 0.84, 0.12, 1);
  layer.target.depth = selectedFilter;
  layer.target.chance = constrain(0.14 + percussionPressureValue * 0.42 + percussionNoiseMixValue * 0.32, 0.1, 0.88);
}

function updateClickTwoHandControls(leftHand, rightHand) {
  const leftPoint = getHandControlPoint(leftHand) || getIndexPoint(leftHand);
  const rightPoint = getHandControlPoint(rightHand) || getIndexPoint(rightHand);
  if (isFinitePoint(rightPoint)) {
    clickHarmonyValue = constrain(map(rightPoint.x, width * 0.06, width * 0.94, 0, 1), 0, 1);
    clickDensityValue = constrain(map(rightPoint.y, height * 0.94, performanceTop, 0.08, 1), 0.08, 1);
    const noteIndex = floor(constrain(map(clickDensityValue, 0, 1, 0, fixedScale.length), 0, fixedScale.length - 0.001));
    selectedNote = fixedScale[noteIndex];
  }
  if (isFinitePoint(leftPoint)) {
    clickGlitchValue = constrain(map(leftPoint.x, width * 0.06, width * 0.94, 0, 1), 0, 1);
    clickSpaceValue = constrain(map(leftPoint.y, height * 0.94, performanceTop, 0, 1), 0, 1);
    selectedFilter = constrain(0.2 + clickSpaceValue * 0.8, 0.2, 1);
  }
  clickPatternValue = clickGlitchValue;
  const layer = layers.texture;
  layer.target.density = constrain(0.34 + clickDensityValue * 0.66, 0.28, 1);
  layer.target.variation = constrain(0.12 + clickGlitchValue * 0.88, 0.1, 1);
  layer.target.depth = selectedFilter;
  layer.target.chance = constrain(0.12 + clickSpaceValue * 0.58 + clickGlitchValue * 0.28, 0.08, 0.95);
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
      leadSpeedValue = constrain(dist(rightPoint.x, rightPoint.y, lastLeadPoint.x, lastLeadPoint.y) / elapsed * 0.34, 0, 1);
    }
    lastLeadPoint = { x: rightPoint.x, y: rightPoint.y };
    lastLeadPointAt = now;
  }
  if (isFinitePoint(leftPoint)) {
    selectedFilter = constrain(map(leftPoint.y, height, performanceTop, 0.04, 0.86), 0.04, 0.9);
    leadInstabilityValue = constrain(map(leftPoint.x, 0, width, 0, 1) * 0.82 + leadSpeedValue * 0.32, 0, 1);
  }
  const layer = layers.space;
  layer.target.density = constrain(0.14 + leadSpeedValue * 0.64, 0.1, 0.84);
  layer.target.variation = constrain(0.16 + leadInstabilityValue * 0.74, 0.1, 0.9);
  layer.target.depth = selectedFilter;
  layer.target.chance = constrain(0.08 + leadSpeedValue * 0.42 + leadInstabilityValue * 0.28, 0.04, 0.78);
}

function updateDroneTwoHandControls(leftHand, rightHand) {
  const leftPoint = getHandControlPoint(leftHand) || getIndexPoint(leftHand);
  const rightPoint = getHandControlPoint(rightHand) || getIndexPoint(rightHand);
  const pitchPoint = rightPoint || leftPoint;
  if (isFinitePoint(pitchPoint)) {
    const noteIndex = floor(constrain(map(pitchPoint.y, height * 0.94, performanceTop + 4, 0, droneLowScale.length), 0, droneLowScale.length - 0.001));
    selectedNote = droneLowScale[noteIndex];
  }
  if (isFinitePoint(rightPoint)) {
    const chordPosition = map(rightPoint.x, 0, width, 0, droneChordBank.length);
    selectedDroneChordIndex = floor(constrain(chordPosition, 0, droneChordBank.length - 0.001));
    const rawBrightness = constrain(map(rightPoint.y, height * 0.96, performanceTop, 0.12, 1), 0.12, 1);
    selectedFilter = pow(rawBrightness, 0.62);
  }
  const layer = layers.loopCreator;
  if (!layer) return;
  const rightX = isFinitePoint(rightPoint) ? constrain(map(rightPoint.x, 0, width, 0, 1), 0, 1) : 0.5;
  const rightY = isFinitePoint(rightPoint) ? constrain(map(rightPoint.y, height, performanceTop, 0, 1), 0, 1) : 0.35;
  const leftX = isFinitePoint(leftPoint) ? constrain(map(leftPoint.x, 0, width, 0, 1), 0, 1) : 0.35;
  const leftY = isFinitePoint(leftPoint) ? constrain(map(leftPoint.y, height, performanceTop, 0.12, 1), 0.12, 1) : selectedFilter;
  layer.target.depth = selectedFilter;
  layer.target.variation = constrain(0.18 + leftX * 0.82, 0.16, 1);
  layer.target.density = constrain(0.3 + rightY * 0.48 + rightX * 0.08, 0.26, 0.86);
  layer.target.chance = constrain(0.16 + leftY * 0.74 + leftX * 0.1, 0.14, 1);
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
  const cell = getSampleGridCell(point);
  return cell === null ? null : constrain(cell, 0, samplePaths.length - 1);
}

function getSampleGridCell(point) {
  if (!isFinitePoint(point)) return null;
  const layout = getSampleGridLayout();
  for (const cell of layout) {
    if (cell.sampleIndex === null) continue;
    if (point.x >= cell.x && point.x <= cell.x + cell.w && point.y >= cell.y && point.y <= cell.y + cell.h) return cell.sampleIndex;
  }
  return null;
}

function getSampleGridLayout() {
  const key = width + "x" + height + ":" + sampleGridTop + ":" + samplePaths.length;
  if (sampleGridLayout.length && sampleGridLayoutKey === key) return sampleGridLayout;
  sampleGridLayoutKey = key;
  sampleGridLayout = createGenerativeSampleGrid(sampleGridTop, width, height - sampleGridTop, samplePaths.length);
  return sampleGridLayout;
}

function deterministicGridNoise(x, y, size, pass) {
  const value = sin(x * 12.9898 + y * 78.233 + size * 37.719 + pass * 19.17) * 43758.5453;
  return value - floor(value);
}

function createGenerativeSampleGrid(top, gridWidth, gridHeight, count) {
  const rows = sampleGridRows;
  const cols = sampleGridCols;
  const rowWeights = [];
  let rowTotal = 0;
  for (let row = 0; row < rows; row++) {
    const weight = 0.82 + deterministicGridNoise(row, top, gridHeight, 3) * 0.58;
    rowWeights.push(weight);
    rowTotal += weight;
  }

  const layout = [];
  let y = top;
  for (let row = 0; row < rows; row++) {
    const rowHeight = row === rows - 1 ? top + gridHeight - y : gridHeight * rowWeights[row] / rowTotal;
    const colWeights = [];
    let colTotal = 0;
    for (let col = 0; col < cols; col++) {
      const weight = 0.72 + deterministicGridNoise(col * 17, row * 23 + top, gridWidth, 5) * 0.74;
      colWeights.push(weight);
      colTotal += weight;
    }

    let x = 0;
    for (let col = 0; col < cols; col++) {
      const index = row * cols + col;
      const cellWidth = col === cols - 1 ? gridWidth - x : gridWidth * colWeights[col] / colTotal;
      layout.push({
        index,
        sampleIndex: index < count ? index : null,
        x,
        y,
        w: cellWidth,
        h: rowHeight,
        row,
        col,
        seed: 37 + index * 43 + row * 19 + col * 29,
      });
      x += cellWidth;
    }
    y += rowHeight;
  }
  return layout;
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
      resetSampleHandStates();
    }
    sampleModeWasActive = false;
    return;
  }
  sampleModeWasActive = true;

  updateSampleHandCell("left", leftHand);
  updateSampleHandCell("right", rightHand);
  if (selectedSampleGridCells.left !== null && selectedSampleGridCells.left === selectedSampleGridCells.right) {
    selectedSampleGridCell = selectedSampleGridCells.left;
  }
}

function updateSampleHandCell(side, hand) {
  const point = getSampleGridPoint(hand, { processKey: "decay" });
  if (!isFinitePoint(point)) {
    selectedSampleGridCells[side] = null;
    sampleHandStates[side].cell = null;
    return;
  }

  const gridCell = getSampleGridCell(point);
  if (gridCell === null) {
    selectedSampleGridCells[side] = null;
    sampleHandStates[side].cell = null;
    return;
  }
  const cell = constrain(gridCell, 0, samplePaths.length - 1);
  const state = sampleHandStates[side];
  const now = millis();
  if (state.cell !== gridCell) {
    state.cell = gridCell;
    state.enteredAt = now;
    state.activatedCell = null;
  }
  const otherSide = side === "left" ? "right" : "left";
  const otherState = sampleHandStates[otherSide];
  const otherHandAlreadyPlayedThisCell = otherState
    && otherState.activatedCell === gridCell
    && now - otherState.lastTriggerAt < sampleSameCellCooldown;
  const sameCellCooldown = state.activatedCell === gridCell ? sampleSameCellCooldown : sampleRetriggerCooldown;
  const shouldPlay = now - state.enteredAt >= sampleHoldDuration
    && now - state.lastTriggerAt >= sameCellCooldown
    && !otherHandAlreadyPlayedThisCell;

  selectedSampleIndex = cell;
  selectedSampleGridCell = gridCell;
  selectedSampleGridCells[side] = gridCell;
  lastSampleGridCell = gridCell;
  if (shouldPlay) {
    lastSampleGridCells[side] = gridCell;
    lastSampleGridAt = millis();
    state.lastTriggerAt = now;
    state.activatedCell = gridCell;
    lastSampleEvents[side] = triggerSampleGridCell(point, cell, 1, gridCell, side);
  }
}

function resetSampleHandStates() {
  sampleHandStates = {
    left: { cell: null, enteredAt: 0, lastTriggerAt: -Infinity, activatedCell: null },
    right: { cell: null, enteredAt: 0, lastTriggerAt: -Infinity, activatedCell: null },
  };
}

function triggerSampleGridCell(point, cell, repeatCount = 1, gridCell = getSampleGridCell(point), handSide = "right") {
  if (!audioReady && !audioStarting) startAudioFromHands();
  const event = createSampleEvent(point, cell, gridCell, repeatCount, handSide);

  visualSystem.createEventParticle(event);
  try {
    playOrQueueGestureEvent(event, 1);
    showInstruction((handSide === "left" ? "left" : "right") + " sample playing", 900);
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
    playbackRate: getSharedSamplePlaybackRate(textureByX),
    liveSample: true,
    organismSeed: gridCell * 97 + (handSide === "left" ? 17 : 43) + millis() * 0.001,
    triggeredAt: millis(),
  };
}

function getSharedSamplePlaybackRate(value) {
  const rates = [0.75, 0.84, 1, 1.125, 1.2];
  const index = floor(constrain(map(value, 0, 1, 0, rates.length), 0, rates.length - 0.001));
  return rates[index];
}

function updatePersistentSampleLoop(event, handSide = event.handSide || "right") {
  if (!event || event.type !== "sample") return;
  const slot = handSide === "left" ? "left" : "right";
  const id = "sample-bg-" + slot;
  const loopEvent = {
    ...event,
    liveSample: false,
    loopPlayback: true,
    time: slot === "left" ? 0.5 : 0,
    velocity: constrain((event.velocity || 0.55) * 0.72, 0.28, 0.46),
    probability: 1,
    repeatCount: 1,
  };
  let memory = loopMemories.find((item) => item.id === id);
  if (!memory) {
    memory = {
      id,
      key: "decay",
      events: [loopEvent],
      params: { ...layers.decay.params, depth: selectedFilter },
      pattern: null,
      savedAt: millis(),
      cycleCount: 0,
      maxCycles: Infinity,
      lastCycleStep: 0,
      fading: false,
      background: true,
      sampleSlot: slot,
    };
    loopMemories.push(memory);
    pruneLoopMemories();
    visualSystem.createSavedBlock(memory);
    showInstruction(slot + " sample loop created");
  } else {
    memory.events = [loopEvent];
    memory.params = { ...layers.decay.params, depth: selectedFilter };
    memory.savedAt = millis();
    memory.cycleCount = 0;
    memory.fading = false;
    showInstruction(slot + " sample loop updated");
  }
  visualSystem.createEventParticle({ ...loopEvent, loopMemoryId: memory.id });
  limitSampleBackgroundMemories();
}

function limitSampleBackgroundMemories() {
  const sampleBackgrounds = loopMemories.filter((memory) => memory.key === "decay" && memory.background);
  while (sampleBackgrounds.length > 5) {
    const removed = sampleBackgrounds.shift();
    loopMemories = loopMemories.filter((memory) => memory.id !== removed.id);
    savedBlocks = savedBlocks.filter((block) => block.id !== removed.id);
  }
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

function resetPerformance() {
  loopMemories = [];
  savedBlocks = [];
  particles = [];
  pendingAudioEvents = [];
  pendingSampleLoopEvent = null;
  lastGestureEvents = {};
  selectedSampleGridCell = null;
  selectedSampleGridCells = { left: null, right: null };
  lastSampleGridCells = { left: null, right: null };
  resetSampleHandStates();
  activeMode = null;
  lastActivatedMode = null;
  lastActivatedModeAt = 0;
  activeProcessKey = null;
  previousProcessKey = null;
  lastPerformingProcessKey = null;
  candidateMode = null;
  candidateModeIsReset = false;
  dwellProgress = 0;
  showInstruction("select a sound", 900);
  if (audioEngine && typeof Tone !== "undefined") {
    try {
      audioEngine.stopAll(Tone.now());
    } catch (error) {
      console.error(error);
    }
  }
  if (visualSystem) {
    visualSystem.percussionDots = [];
    visualSystem.audioObjects = [];
    visualSystem.sampleHandTrails = { left: [], right: [] };
    if (visualSystem.clickFluidMask) visualSystem.clickFluidMask.background(0);
    if (visualSystem.percussionPaintMask) visualSystem.percussionPaintMask.background(0);
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
    nextPatternUpdateAt: millis() + backgroundPatternUpdateInterval,
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
  showInstruction(getModeNameForKey(key) + " loop stored");
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
  if (eventGridCell === null) return;
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
  if (eventGridCell === null) return;
  const event = { ...createSampleEvent(point, constrain(eventGridCell, 0, samplePaths.length - 1), eventGridCell, 1, handSide), liveSample: false, loopPlayback: true };
  const memory = {
    id: millis() + "-decay",
    key: "decay",
    events: [event],
    params: { ...layers.decay.params, depth: selectedFilter },
    pattern: null,
    savedAt: millis(),
    cycleCount: 0,
    maxCycles: Infinity,
    lastCycleStep: 0,
    fading: false,
    background: true,
  };

  loopMemories.push(memory);
  pruneLoopMemories();
  visualSystem.createSavedBlock(memory);
  visualSystem.createEventParticle({ ...event, loopMemoryId: memory.id });
  playOrQueueGestureEvent(event, 1);
  updatePersistentSampleLoop(event, handSide);
  showInstruction(handSide + " sample loop created");
}

function toggleSelectedSampleLoop() {
  const gridCell = selectedSampleGridCell !== null ? selectedSampleGridCell : lastSampleGridCell;
  if (gridCell === null) return;
  const point = getSampleGridCellCenter(gridCell);
  const event = { ...createSampleEvent(point, constrain(gridCell, 0, samplePaths.length - 1), gridCell, 1, "right"), liveSample: false, loopPlayback: true };
  loopMemories.push({
    id: millis() + "-decay",
    key: "decay",
    events: [event],
    params: { ...layers.decay.params, depth: selectedFilter },
    pattern: null,
    savedAt: millis(),
    cycleCount: 0,
    maxCycles: Infinity,
    lastCycleStep: 0,
    fading: false,
    background: true,
  });
  pruneLoopMemories();
  visualSystem.createSavedBlock(loopMemories[loopMemories.length - 1]);
  visualSystem.createEventParticle({ ...event, loopMemoryId: loopMemories[loopMemories.length - 1].id });
  playOrQueueGestureEvent(event, 1);
  updatePersistentSampleLoop(event, "right");
  showInstruction("sample loop created");
}

function getSampleGridCellCenter(cell) {
  const layoutCell = getSampleGridLayout().find((item) => item.sampleIndex === cell);
  if (layoutCell) return { x: layoutCell.x + layoutCell.w * 0.5, y: layoutCell.y + layoutCell.h * 0.5 };
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
    return {
      ...base,
      type: "chord",
      chord,
      inversion: selectedDroneChordIndex % 3,
      velocitySpread: 0.18 + (layers.loopCreator.params.variation || 0.1) * 0.22,
      shimmer: layers.loopCreator.params.chance || 0.1,
      instability: layers.loopCreator.target.variation || layers.loopCreator.params.variation || 0.1,
      space: layers.loopCreator.target.chance || layers.loopCreator.params.chance || 0.1,
    };
  }

  if (engineKey === "motion") {
    const subdivision = rhythmSubdivisions[floor(constrain(map(percussionDensityValue, 0, 1, 0, rhythmSubdivisions.length), 0, rhythmSubdivisions.length - 0.001))];
    return {
      ...base,
      type: "percussion",
      subdivision,
      randomHits: floor(map(percussionDensityValue, 0, 1, 1, 10)),
      probability: map(percussionDensityValue, 0, 1, 0.56, 0.98),
      velocity: map(percussionPressureValue, 0, 1, 0.58, 0.94),
      tone: percussionToneValue,
      noiseMix: percussionNoiseMixValue,
      pressure: percussionPressureValue,
      filterValue: percussionPressureValue,
    };
  }

  if (engineKey === "texture") {
    const noteIndex = floor(constrain(map(clickHarmonyValue, 0, 1, 0, fixedScale.length), 0, fixedScale.length - 0.001));
    const heightOffset = floor(map(clickDensityValue, 0, 1, -2, 5));
    return {
      ...base,
      type: "clickPattern",
      distortion: clickGlitchValue,
      note: fixedScale[constrain(noteIndex + heightOffset, 0, fixedScale.length - 1)],
      patternType: clickGlitchValue,
      densityValue: clickDensityValue,
      harmonicRegion: clickHarmonyValue,
      space: clickSpaceValue,
      filterValue: selectedFilter,
      probability: constrain(0.72 + clickDensityValue * 0.24, 0.7, 0.98),
      velocity: constrain(0.62 + clickDensityValue * 0.22, 0.58, 0.9),
    };
  }

  if (engineKey === "decay") {
    return { ...base, type: "sample", sampleIndex: selectedSampleIndex };
  }

  return { ...base, type: "lead", note: selectedNote, velocity: constrain(map(getHandCloseness(rightHand), 0, 1, 0.28, 0.82) + leadSpeedValue * 0.12, 0.24, 0.9), instability: leadInstabilityValue, speed: leadSpeedValue, repeatCount: 1 + floor(leadSpeedValue * 4) };
}

function transposeChordToSelectedHeight(chord, anchorNote) {
  const targetIndex = droneLowScale.indexOf(anchorNote);
  const safeIndex = targetIndex >= 0 ? targetIndex : getScaleIndex(anchorNote);
  const octaveShift = floor(map(safeIndex, 0, droneLowScale.length - 1, -0.25, 0.75));
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
  const noiseMix = constrain(source.noiseMix || 0, 0, 1);
  const tone = constrain(source.tone || 0.5, 0, 1);
  const pressure = constrain(source.pressure || 0.5, 0, 1);
  const offsets = noiseMix < 0.45 ? [0, 0, 2, 0, 4, 2, 0, 5] : [7, 9, 5, 10, 4, 8, 11, 6];
  for (let i = 0; i < regularCount; i++) {
    const accent = i % 4 === 0 ? 1 : i % 2 === 0 ? 0.68 : 0.48;
    const noteIndex = constrain(baseIndex + offsets[i % offsets.length], 0, fixedScale.length - 1);
    events.push({
      ...source,
      time: i / regularCount,
      probability: 1,
      random: false,
      accent: i % 4 === 0,
      note: fixedScale[noteIndex],
      filterValue: constrain(pressure + sin(i * 1.7) * 0.08, 0, 1),
      tone: constrain(tone + sin(i * 1.3) * 0.08, 0, 1),
      noiseMix,
      pressure,
      velocity: constrain(source.velocity * accent, 0.18, 0.9),
      pan: constrain((source.pan || 0) + sin(i * 0.73) * 0.28, -0.9, 0.9),
    });
  }
  const inBetweenCount = source.randomHits;
  const inBetweenLayers = max(1, ceil(inBetweenCount / regularCount));
  for (let i = 0; i < inBetweenCount; i++) {
    const slot = i % regularCount;
    const layer = floor(i / regularCount);
    const offset = (layer + 1) / (inBetweenLayers + 1);
    const accent = 0.38 + 0.24 * (1 - i / max(1, inBetweenCount));
    events.push({
      ...source,
      time: (slot + offset) / regularCount,
      probability: source.probability,
      random: false,
      inBetween: true,
      harmonicRatio: noiseMix < 0.45 ? [0.5, 1, 1.5, 2][i % 4] : [2, 3, 4, 6][i % 4],
      note: fixedScale[constrain(baseIndex + 3 + (i % 4), 0, fixedScale.length - 1)],
      filterValue: constrain(pressure + 0.08 + sin(i * 2.1) * 0.1, 0, 1),
      tone: constrain(tone + 0.18, 0, 1),
      noiseMix,
      pressure,
      velocity: source.velocity * accent * map(noiseMix, 0, 1, 0.42, 0.9),
      pan: constrain((source.pan || 0) + cos(i * 1.1) * 0.42, -0.9, 0.9),
    });
  }
  return events.sort((a, b) => a.time - b.time);
}

function createClickPatternEvents(source) {
  const glitch = constrain(source.distortion || 0, 0, 1);
  const space = constrain(source.space || 0, 0, 1);
  const count = floor(map(source.densityValue || clickDensityValue, 0, 1, 5, 14));
  const events = [];
  const baseIndex = getScaleIndex(source.note);
  const simple = [0, 0.25, 0.5, 0.75];
  const syncopated = [0, 0.1875, 0.375, 0.625, 0.8125];
  const broken = [0, 0.125, 0.3125, 0.4375, 0.6875, 0.875];
  const shape = glitch < 0.3 ? simple : glitch < 0.68 ? syncopated : broken;
  const offsets = [0, 2, 4, 7, 9, 7, 4, 2, 5, 4, 2, 0];
  const ratios = glitch < 0.35 ? [1, 1, 1.5, 1, 2, 1.5, 1, 1] : [1, 2, 3, 1.5, 4, 0.5, 2.5, 1];
  for (let i = 0; i < count; i++) {
    const accent = i % 4 === 0 ? 0.88 : 0.46 + (i % 3) * 0.1;
    const noteIndex = constrain(baseIndex + offsets[i % offsets.length] - 1, 0, fixedScale.length - 1);
    events.push({
      ...source,
      time: (shape[i % shape.length] + floor(i / shape.length)) / ceil(count / shape.length),
      probability: 1,
      note: fixedScale[noteIndex],
      velocity: constrain(source.velocity * accent * map(space, 0, 1, 0.92, 1.12), 0.18, 0.92),
      filterValue: constrain(source.filterValue + sin(i * 1.37) * 0.18 + space * 0.18, 0, 1),
      distortion: constrain(glitch * (0.36 + (i % 5) * 0.14), 0, 1),
      space,
      harmonicRatio: ratios[i % ratios.length],
      durationSeconds: 0.02 + (i % 4) * 0.014 + space * 0.018,
      noiseAccent: i % 4 === 0 && glitch > 0.24,
      pan: constrain((source.pan || 0) + sin(i * 0.91) * map(space, 0, 1, 0.2, 0.75), -0.9, 0.9),
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
