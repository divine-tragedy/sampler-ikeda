let video;
let handPose;
let hands = [];
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
let sampleModeWasActive = false;
let saveCooldownUntil = 0;
let stableActiveFinger = null;
let pendingFingerCount = null;
let pendingFingerFrames = 0;
let missingFingerFrames = 0;

let audioEngine;
let loopManager;
let visualSystem;
let systemMessage = "";
let drawErrorMessage = "";
let audioModulationEnabled = true;
let pendingAudioEvents = [];
let pendingSampleLoopEvent = null;
let lastLiveDroneAt = 0;

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

const processOrder = ["loopCreator", "motion", "texture", "space", "decay"];

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
const rhythmSubdivisions = [1, 2, 4, 8, 16];
const samplePaths = [
  "sounds/Female-Evil-Laugh.wav",
  "sounds/Lakker-Tuk-tuk.mp3",
  "sounds/My-Girl-is-Crying.mp3",
  "sounds/Old-Ladies-Pets.wav",
  "sounds/SR006F.wav",
  "sounds/Scratching-Strings.wav",
  "sounds/Thats-My-Laugh.wav",
  "sounds/text/Balkan-Central-Europe.mp3",
  "sounds/text/Bjork-Interview-1996.mp3",
  "sounds/text/Cyberstress.mp3",
  "sounds/text/Hello-MyNameIsBjork.mp3",
  "sounds/text/Jodie-Foster-Gay-Silence.mp3",
  "sounds/text/KeroKeroBonito-I'dRatherSleep.mp3",
  "sounds/text/MakeMeMoo-TheResidents.mp3",
  "sounds/text/Weirdcore-Analysis.mp3",
  "sounds/text/YungLean-Hurt.mp3",
];
const sampleGridCols = 4;
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
  const sorted = HandTracker.getSinglePerformerHands(hands);
  const handRoles = HandTracker.getPerformanceHands(sorted);
  const leftHand = handRoles.leftHand;
  const rightHand = handRoles.rightHand;
  const activeFinger = handRoles.activeFinger;
  const gesturePoint = getGestureSpatialPoint(leftHand, activeFinger, rightHand);
  audioAnalysis = readAudioAnalysis();

  if (!audioReady && !audioStarting && activeFinger && millis() - lastAudioStartAttempt > 250) {
    startAudioFromHands();
  }

  const leftOpenPalmActive = handleLeftOpenPalmStop(leftHand);

  activeProcessKey = activeFinger ? activeFinger.processKey : null;
  rightPinchActive = GestureDetector.isThumbIndexPinch(rightHand);
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
    updateSampleGrid(rightHand, activeFinger);
    handlePinchTrigger(rightHand, leftHand);
    recordActiveProcessParams();
    updateAudioSafely(gesturePoint);
  }
  updateProcessSmoothing();

  const loopingSampleCell = getLoopingSampleGridCell();
  const sampleGridVisible = (activeProcessKey === "decay" && activeFinger && activeFinger.count === 5) || loopingSampleCell !== null;
  const sampleGridPoint = getSampleGridPoint(rightHand, activeFinger);
  visualSystem.update(activeProcessKey, layers, audioAnalysis, gesturePoint, activeFinger);
  visualSystem.drawBackground(sampleGridVisible);
  if (!activeProcessKey || activeProcessKey === "loopCreator" || activeProcessKey === "motion") {
    visualSystem.drawAudioReactiveLayer(audioAnalysis);
    visualSystem.drawHands(sorted, activeFinger, leftHand);
    visualSystem.drawTrackingStatus(sorted, activeFinger);
    visualSystem.drawGestureInstruction(activeFinger);
    return;
  }
  visualSystem.drawSampleGrid(sampleGridVisible, sampleGridPoint);
  visualSystem.drawAudioReactiveLayer(audioAnalysis);
  visualSystem.drawParticles();
  visualSystem.drawHands(sorted, activeFinger, leftHand);
  visualSystem.drawGestureInstruction(activeFinger);
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

function updateAudioSafely(gesturePoint) {
  if (!audioReady || !audioEngine || !audioModulationEnabled) return;
  try {
    audioEngine.updateSampleLoops(Tone.now());
    audioEngine.updateFromLayers(layers);
    audioEngine.setSpatialPosition(gesturePoint);
    updateLiveOneFingerDrone();
  } catch (error) {
    audioModulationEnabled = false;
    systemMessage = "audio running without continuous modulation";
    console.error(error);
  }
}

function updateLiveOneFingerDrone() {
  if (activeProcessKey !== "loopCreator" || millis() - lastLiveDroneAt < 620) return;
  const rightHand = HandTracker.getHandBySide(HandTracker.getSinglePerformerHands(hands), "Right", 1) || HandTracker.getSinglePerformerHands(hands)[0];
  const event = createGestureEvent("loopCreator", rightHand, null);
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
  const point = getAxisControlPoint(activeProcessKey, leftHand, rightHand, activeFinger);
  if (!isFinitePoint(point)) return;

  const noteIndex = floor(constrain(map(point.y, height * 0.92, height * 0.08, 0, fixedScale.length), 0, fixedScale.length - 0.001));
  selectedNote = fixedScale[noteIndex];
  selectedFilter = constrain(map(point.x, width * 0.08, width * 0.92, 0, 1), 0, 1);
  selectedSampleIndex = getSampleGridIndex(point);
}

function getAxisControlPoint(key, leftHand, rightHand, activeFinger) {
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
  const row = floor(constrain(map(point.y, 0, height, 0, sampleGridRows), 0, sampleGridRows - 0.001));
  return row * sampleGridCols + col;
}

function getSampleGridPoint(rightHand, activeFinger) {
  if (!activeFinger || activeFinger.processKey !== "decay") return null;
  return getIndexPoint(rightHand);
}

function updateSampleGrid(rightHand, activeFinger) {
  if (activeProcessKey !== "decay" || !activeFinger || activeFinger.count !== 5) {
    lastSampleGridCell = null;
    if (sampleModeWasActive) selectedSampleGridCell = null;
    sampleModeWasActive = false;
    return;
  }
  sampleModeWasActive = true;

  const point = getSampleGridPoint(rightHand, activeFinger);
  if (!isFinitePoint(point)) return;

  const gridCell = getSampleGridCell(point);
  const cell = constrain(gridCell, 0, samplePaths.length - 1);
  const shouldPlay = gridCell !== lastSampleGridCell;

  selectedSampleIndex = cell;
  selectedSampleGridCell = gridCell;
  if (shouldPlay) {
    lastSampleGridCell = gridCell;
    lastSampleGridAt = millis();
    triggerSampleGridCell(point, cell, 1, gridCell);
  }
}

function triggerSampleGridCell(point, cell, repeatCount = 1, gridCell = getSampleGridCell(point)) {
  if (!audioReady && !audioStarting) startAudioFromHands();
  const event = createSampleEvent(point, cell, gridCell, repeatCount);

  visualSystem.createEventParticle(event);
  try {
    playOrQueueGestureEvent(event, 1);
  } catch (error) {
    systemMessage = "sample event skipped";
    console.error(error);
  }
  return event;
}

function createSampleEvent(point, cell, gridCell, repeatCount = 1) {
  return {
    time: loopManager ? loopManager.step / loopManager.loopLength : (millis() % parameterLoopLength) / parameterLoopLength,
    type: "sample",
    note: selectedNote,
    soundEngine: "decay",
    filterValue: selectedFilter,
    velocity: 0.48,
    duration: "8n",
    probability: 1,
    texture: selectedFilter,
    drift: 0,
    pan: getPanFromPoint(point),
    visualX: point.x,
    visualY: point.y,
    sampleIndex: cell,
    gridCell,
    repeatCount,
  };
}

function getIndexPoint(hand) {
  return getOpenFingerPoint(hand, "index");
}

function getOpenFingerPoint(hand, key) {
  if (!HandTracker.isValidHand(hand)) return null;
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
    if (key === "loopCreator" || key === "motion" || key === "texture") continue;
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
  const isBackgroundLoop = key === "loopCreator" || key === "motion" || key === "texture";
  const event = createGestureEvent(key, rightHand, leftHand);
  const shouldLoop = key !== "space";

  if (!shouldLoop) {
    visualSystem.createEventParticle(event);
    try {
      playOrQueueGestureEvent(event, 1);
    } catch (error) {
      systemMessage = "lead event skipped";
      console.error(error);
    }
    return;
  }

  const memory = {
    id: millis() + "-" + key,
    key,
    events: [event],
    params: { ...layers[key].params, depth: selectedFilter },
    pattern: null,
    savedAt: millis(),
    cycleCount: 0,
    maxCycles: isBackgroundLoop ? Infinity : loopLifetimeCycles,
    lastCycleStep: 0,
    fading: false,
    background: isBackgroundLoop,
  };

  if (key === "motion") memory.events = createRegularPercussionEvents(event);
  if (key === "texture") memory.events = createClickPatternEvents(event);

  if (isBackgroundLoop) {
    loopMemories = loopMemories.filter((item) => !(item.key === key && item.background));
    savedBlocks = savedBlocks.filter((block) => !(block.key === key && block.background));
  }

  loopMemories.push(memory);
  pruneLoopMemories();
  visualSystem.createSavedBlock(memory);
  visualSystem.createEventParticle({ ...event, loopMemoryId: memory.id });
  try {
    playOrQueueGestureEvent(key === "motion" ? { ...event, probability: 1 } : event, 1);
  } catch (error) {
    systemMessage = "audio event skipped, loop memory stored";
    console.error(error);
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

function triggerSelectedSampleLoopMemory(rightHand) {
  if (activeProcessKey !== "decay") return;
  const gridCell = selectedSampleGridCell !== null ? selectedSampleGridCell : lastSampleGridCell;
  const indexPoint = getIndexPoint(rightHand);
  const point = isFinitePoint(indexPoint) ? indexPoint : gridCell !== null ? getSampleGridCellCenter(gridCell) : null;
  if (!isFinitePoint(point)) return;
  if (!audioReady && !audioStarting) startAudioFromHands();

  const eventGridCell = gridCell !== null ? gridCell : getSampleGridCell(point);
  const event = createSampleEvent(point, constrain(eventGridCell, 0, samplePaths.length - 1), eventGridCell, 1);
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
    y: (floor(cell / sampleGridCols) % sampleGridRows + 0.5) * height / sampleGridRows,
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
    const chordIndex = floor(constrain(map(getScaleIndex(selectedNote), 0, fixedScale.length - 1, 0, chordBank.length), 0, chordBank.length - 0.001));
    return { ...base, type: "chord", chord: chordBank[chordIndex], inversion: 2, velocitySpread: 0.22 };
  }

  if (engineKey === "motion") {
    const subdivision = rhythmSubdivisions[floor(constrain(map(selectedFilter, 0, 1, 0, rhythmSubdivisions.length), 0, rhythmSubdivisions.length - 0.001))];
    return { ...base, type: "percussion", subdivision, randomHits: floor(map(getNoteHeightValue(), 0, 1, 0, 9)), probability: map(getNoteHeightValue(), 0, 1, 0.15, 0.7) };
  }

  if (engineKey === "texture") {
    return { ...base, type: "clickPattern", distortion: getNoteHeightValue(), note: fixedScale[floor(selectedFilter * (fixedScale.length - 0.001))] };
  }

  if (engineKey === "decay") {
    return { ...base, type: "sample", sampleIndex: selectedSampleIndex };
  }

  return { ...base, type: "lead", note: selectedNote, velocity: map(getHandCloseness(rightHand), 0, 1, 0.22, 0.92) };
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
  for (let i = 0; i < regularCount; i++) {
    events.push({ ...source, time: i / regularCount, probability: 1, random: false });
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
      velocity: source.velocity * accent,
    });
  }
  return events.sort((a, b) => a.time - b.time);
}

function createClickPatternEvents(source) {
  const count = floor(map(getNoteHeightValue(), 0, 1, 2, 12));
  const events = [];
  for (let i = 0; i < count; i++) {
    const accent = i % 3 === 0 ? 0.82 : 0.48 + (i % 4) * 0.08;
    events.push({ ...source, time: i / count, probability: 1, velocity: source.velocity * accent });
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
