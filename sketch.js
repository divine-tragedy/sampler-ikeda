let video;
let handPose;
let hands = [];
let audioReady = false;
let audioStarting = false;
let lastAudioStartAttempt = 0;

let activeProcessKey = null;
let previousProcessKey = null;
let lastPerformingProcessKey = null;
let leftThumbWasOpen = false;
let leftPinchWasActive = false;
let lastSampleGridCell = null;
let lastSampleGridAt = 0;
let selectedSampleGridCell = null;
let saveCooldownUntil = 0;

let audioEngine;
let loopManager;
let visualSystem;
let systemMessage = "";
let drawErrorMessage = "";
let audioModulationEnabled = true;
let pendingAudioEvents = [];
let pendingSampleLoopEvent = null;

const canvasW = 1048;
const canvasH = 756;
const stillThreshold = 3.4;
const stillSaveTime = 2000;
const saveCooldown = 1400;
const parameterLoopLength = 5000;
const parameterRecordInterval = 70;
const loopLifetimeCycles = 5;

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
  "sounds/Bjork-Interview-1996.mp3",
  "sounds/Cyberstress.mp3",
  "sounds/Female-Evil-Laugh.wav",
  "sounds/Jodie-Foster-Gay-Silence.mp3",
  "sounds/Lakker-Tuk-tuk.mp3",
  "sounds/My-Girl-is-Crying.mp3",
  "sounds/Old-Ladies-Pets.wav",
  "sounds/SR006F.wav",
  "sounds/Scratching-Strings.wav",
  "sounds/Thats-My-Laugh.wav",
  "sounds/Weirdcore-Analysis.mp3",
];
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
  handPose = ml5.handPose({
    flipped: true,
    maxHands: 2,
  });
}

function setup() {
  createCanvas(canvasW, canvasH);
  pixelDensity(1);
  frameRate(30);
  textFont("monospace");

  try {
    video = createCapture(VIDEO);
    video.size(canvasW, canvasH);
    video.hide();

    handPose.detectStart(video, (results) => {
      hands = results.slice(0, 2);
    });
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
    drawFrame();
  } catch (error) {
    drawErrorMessage = error.message;
    console.error(error);
    drawFallbackFrame();
  }
}

function drawFrame() {
  const sorted = HandTracker.getSortedHands(hands);
  const handRoles = HandTracker.getPerformanceHands(sorted);
  const leftHand = handRoles.leftHand;
  const rightHand = handRoles.rightHand;
  const activeFinger = handRoles.activeFinger;
  const gesturePoint = getGestureSpatialPoint(leftHand, activeFinger, rightHand);
  audioAnalysis = readAudioAnalysis();

  if (!audioReady && !audioStarting && activeFinger && millis() - lastAudioStartAttempt > 2400) {
    startAudioFromHands();
  }

  activeProcessKey = activeFinger ? activeFinger.processKey : null;
  if (activeProcessKey && !GestureDetector.isThumbIndexPinch(rightHand)) {
    lastPerformingProcessKey = activeProcessKey;
  }
  if (activeProcessKey !== previousProcessKey) {
    resetStillTracking();
    previousProcessKey = activeProcessKey;
  }

  updateProcessTargets(rightHand);
  updateControlAxes(leftHand, rightHand, activeFinger);
  updateSampleGrid(rightHand, activeFinger);
  handlePinchTrigger(rightHand, leftHand);
  updateProcessSmoothing();
  recordActiveProcessParams();
  updateAudioSafely(gesturePoint);

  const loopingSampleCell = getLoopingSampleGridCell();
  const sampleGridVisible = (activeProcessKey === "decay" && activeFinger && activeFinger.count === 5) || loopingSampleCell !== null;
  const sampleGridPoint = getSampleGridPoint(rightHand, activeFinger);
  visualSystem.update(activeProcessKey, layers, audioAnalysis, gesturePoint);
  visualSystem.drawBackground(sampleGridVisible);
  visualSystem.drawSampleGrid(sampleGridVisible, sampleGridPoint);
  visualSystem.drawAudioReactiveLayer(audioAnalysis);
  visualSystem.drawParticles();
  visualSystem.drawHands(sorted, activeFinger, leftHand);
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
  } catch (error) {
    audioModulationEnabled = false;
    systemMessage = "audio running without continuous modulation";
    console.error(error);
  }
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
  if (key === "motion" || key === "texture") {
    const leftIndex = getIndexPoint(leftHand);
    if (leftIndex) return leftIndex;
  }
  const rightIndex = getIndexPoint(rightHand);
  if (rightIndex) return rightIndex;
  if (activeFinger && isFinitePoint(activeFinger.point)) return activeFinger.point;
  return getIndexPoint(leftHand);
}

function getSampleGridIndex(point) {
  return getSampleGridCell(point) % samplePaths.length;
}

function getSampleGridCell(point) {
  if (!isFinitePoint(point)) return 0;
  const col = floor(constrain(map(point.x, 0, width, 0, 4), 0, 3.999));
  const row = floor(constrain(map(point.y, 0, height, 0, 4), 0, 3.999));
  return row * 4 + col;
}

function getSampleGridPoint(rightHand, activeFinger) {
  if (!activeFinger || activeFinger.processKey !== "decay") return null;
  return getIndexPoint(rightHand);
}

function updateSampleGrid(rightHand, activeFinger) {
  if (activeProcessKey !== "decay" || !activeFinger || activeFinger.count !== 5) {
    lastSampleGridCell = null;
    return;
  }

  const point = getSampleGridPoint(rightHand, activeFinger);
  if (!isFinitePoint(point)) return;

  const gridCell = getSampleGridCell(point);
  const cell = gridCell % samplePaths.length;
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
  const event = {
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

  visualSystem.createEventParticle(event);
  try {
    playOrQueueGestureEvent(event, 1);
  } catch (error) {
    systemMessage = "sample event skipped";
    console.error(error);
  }
  return event;
}

function getIndexPoint(hand) {
  if (!HandTracker.isValidHand(hand)) return null;
  const point = hand.keypoints[fingerTips.index];
  return isFinitePoint(point) ? point : null;
}

function getGestureSpatialPoint(leftHand, activeFinger, rightHand) {
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

function handlePinchTrigger(rightHand, leftHand) {
  const pinchActive = GestureDetector.isThumbIndexPinch(rightHand);
  if (pinchActive && !leftPinchWasActive) {
    const activeFinger = GestureDetector.getActiveRightGesture(rightHand);
    if (activeFinger && activeFinger.count === 2 && selectedSampleGridCell !== null) {
      toggleSelectedSampleLoop();
      leftPinchWasActive = pinchActive;
      return;
    }
    const key = lastPerformingProcessKey || activeProcessKey;
    if (key === "decay") {
      triggerSelectedSample(rightHand);
    } else {
      triggerSelectedNote(rightHand, leftHand, key);
    }
  }
  leftPinchWasActive = pinchActive;
}

function triggerSelectedNote(rightHand, leftHand, key = activeProcessKey) {
  if (!key || key === "decay") return;
  if (!audioReady && !audioStarting) startAudioFromHands();
  const isBackgroundLoop = key === "loopCreator" || key === "motion";
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
  while (loopMemories.length > 8) {
    const removableIndex = loopMemories.findIndex((item) => !item.background);
    const removed = loopMemories.splice(removableIndex >= 0 ? removableIndex : 0, 1)[0];
    savedBlocks = savedBlocks.filter((block) => block.id !== removed.id);
  }
  visualSystem.createSavedBlock(memory);
  visualSystem.createEventParticle(event);
  try {
    playOrQueueGestureEvent(event, 1);
  } catch (error) {
    systemMessage = "audio event skipped, loop memory stored";
    console.error(error);
  }
}

function triggerSelectedSample(rightHand) {
  const point = getIndexPoint(rightHand);
  if (!isFinitePoint(point)) return;
  if (!audioReady && !audioStarting) startAudioFromHands();

  const event = triggerSampleGridCell(point, getSampleGridIndex(point), 1, getSampleGridCell(point));
  if (!event) return;

  const memory = {
    id: millis() + "-decay",
    key: "decay",
    events: [{ ...event, repeatCount: 1 }],
    params: { ...layers.decay.params, depth: selectedFilter },
    pattern: null,
    savedAt: millis(),
    cycleCount: 0,
    maxCycles: 3,
    lastCycleStep: 0,
    fading: false,
    background: false,
  };
  loopMemories.push(memory);
  while (loopMemories.length > 8) {
    const removableIndex = loopMemories.findIndex((item) => !item.background);
    const removed = loopMemories.splice(removableIndex >= 0 ? removableIndex : 0, 1)[0];
    savedBlocks = savedBlocks.filter((block) => block.id !== removed.id);
  }
  visualSystem.createSavedBlock(memory);
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
    sampleIndex: gridCell % samplePaths.length,
    gridCell,
    repeatCount: 1,
  };
  toggleOrQueueSampleLoop(event, 0.42);
}

function getSampleGridCellCenter(cell) {
  return {
    x: (cell % 4 + 0.5) * width * 0.25,
    y: (floor(cell / 4) % 4 + 0.5) * height * 0.25,
  };
}

function clearOtherProcessMemories(key) {
  if (!key) return;
  loopMemories = loopMemories.filter((memory) => memory.key === key);
  savedBlocks = savedBlocks.filter((block) => block.key === key);
}

function createGestureEvent(engineKey, rightHand, leftHand) {
  const spatialPoint = getAxisControlPoint(engineKey, leftHand, rightHand, null);
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
    return { ...base, type: "chord", chord: chordBank[chordIndex], inversion: floor(random(0, 3)), velocitySpread: random(0.08, 0.32) };
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

function createRegularPercussionEvents(source) {
  const events = [];
  const regularCount = source.subdivision;
  for (let i = 0; i < regularCount; i++) {
    events.push({ ...source, time: i / regularCount, probability: 1, random: false });
  }
  for (let i = 0; i < source.randomHits; i++) {
    events.push({ ...source, time: random(), probability: source.probability, random: true, velocity: source.velocity * random(0.45, 0.9) });
  }
  return events.sort((a, b) => a.time - b.time);
}

function createClickPatternEvents(source) {
  const count = floor(map(getNoteHeightValue(), 0, 1, 2, 12));
  const events = [];
  for (let i = 0; i < count; i++) {
    events.push({ ...source, time: i / count, probability: random(0.55, 0.95), velocity: source.velocity * random(0.45, 0.95) });
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
  while (loopMemories.length > 8) {
    const removed = loopMemories.shift();
    savedBlocks = savedBlocks.filter((block) => block.id !== removed.id);
  }

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

class AudioEngine {
  constructor() {
    this.master = new Tone.Gain(0.66).toDestination();
    this.outputAnalyser = new Tone.Analyser("waveform", 1024);
    this.fftAnalyser = new Tone.Analyser("fft", 64);
    this.memoryFilter = new Tone.Filter(3600, "lowpass");
    this.memoryDistortion = new Tone.Distortion(0.003);
    this.memoryCrusher = new Tone.BitCrusher(12);
    this.delay = new Tone.FeedbackDelay("8n", 0.12);
    this.pingDelay = new Tone.PingPongDelay("4n", 0.12);
    this.reverb = new Tone.Reverb({ decay: 8.2, wet: 0.42 });
    this.width = new Tone.Panner(0);
    this.mainGain = new Tone.Gain(0.72);

    this.mainGain.chain(this.memoryFilter, this.memoryDistortion, this.memoryCrusher, this.delay, this.reverb, this.width, this.master);
    this.mainGain.connect(this.master);
    this.master.connect(this.outputAnalyser);
    this.master.connect(this.fftAnalyser);
    this.pingDelay.connect(this.reverb);

    this.loopEngine = this.createLoopCreatorEngine();
    this.motionEngine = this.createMotionEngine();
    this.textureEngine = this.createTextureEngine();
    this.spaceEngine = this.createSpaceEngine();
    this.memoryEngine = this.createMemoryEngine();
    this.sampleEngine = this.createSampleEngine();
  }

  createLoopCreatorEngine() {
    const noteFilter = new Tone.Filter(780, "lowpass").connect(this.mainGain);
    const noteGain = new Tone.Gain(0.46).connect(noteFilter);
    const voice = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 0.62,
      modulationIndex: 0.22,
      oscillator: { type: "sine" },
      envelope: { attack: 1.5, decay: 1.6, sustain: 0.48, release: 6.4 },
      modulationEnvelope: { attack: 1.8, decay: 1.4, sustain: 0.08, release: 4.8 },
    }).connect(noteGain);

    const pluckFilter = new Tone.Filter(680, "lowpass").connect(this.mainGain);
    const pluckGain = new Tone.Gain(0.24).connect(pluckFilter);
    const pluck = new Tone.PluckSynth({
      attackNoise: 0.1,
      dampening: 720,
      resonance: 0.26,
    }).connect(pluckGain);

    const clickGain = new Tone.Gain(0).connect(this.mainGain);
    const click = new Tone.Oscillator({ type: "sine", frequency: 360 }).connect(clickGain);
    return { voice, noteGain, noteFilter, pluck, pluckGain, pluckFilter, click, clickGain };
  }

  createMotionEngine() {
    const lfo = new Tone.LFO({ frequency: 0.08, min: -18, max: 18 });
    const filterLfo = new Tone.LFO({ frequency: 0.05, min: 520, max: 2200 });
    filterLfo.connect(this.loopEngine.noteFilter.frequency);
    return { lfo, filterLfo, drift: 0, timing: 0, pitch: 0 };
  }

  createTextureEngine() {
    const hissFilter = new Tone.Filter(2600, "bandpass").connect(this.reverb);
    const hissGain = new Tone.Gain(0).connect(hissFilter);
    const hiss = new Tone.Noise("pink").connect(hissGain);
    const crackleGain = new Tone.Gain(0).connect(this.mainGain);
    const crackle = new Tone.Noise("pink").connect(new Tone.Filter(3600, "bandpass").connect(crackleGain));
    return { hiss, hissGain, hissFilter, crackle, crackleGain };
  }

  createSpaceEngine() {
    return { wet: 0.18, feedback: 0.12, width: 0.1 };
  }

  createMemoryEngine() {
    return { age: 0, dropout: 0, filter: 7200 };
  }

  createSampleEngine() {
    const gain = new Tone.Gain(0.54).connect(this.mainGain);
    const states = samplePaths.map((path) => ({ path, loaded: false, failed: false }));
    const players = samplePaths.map((path, index) => {
      const player = new Tone.Player({
        url: path,
        fadeIn: 0.025,
        fadeOut: 0.18,
        onload: () => {
          states[index].loaded = true;
        },
        onerror: (error) => {
          states[index].failed = true;
          console.error("sample failed to load:", path, error);
        },
      }).connect(gain);
      player.samplePath = path;
      return player;
    });
    return { gain, players, states, activeVoices: new Set(), loopPlayer: null, loopIndex: null, loopGridCell: null, loopStopTime: null };
  }

  async start() {
    await Tone.start();
    this.loopEngine.click.start();
    this.motionEngine.lfo.start();
    this.motionEngine.filterLfo.start();
    this.textureEngine.hiss.start();
    this.textureEngine.crackle.start();
    Tone.Transport.bpm.value = 82;
    Tone.Transport.swing = 0.08;
    Tone.Transport.start();
  }

  getAnalysis(previous) {
    const waveform = Array.from(this.outputAnalyser.getValue());
    const fft = Array.from(this.fftAnalyser.getValue());
    let sum = 0;
    for (const sample of waveform) sum += sample * sample;
    const rawAmp = waveform.length ? Math.sqrt(sum / waveform.length) : 0;
    const normalizedAmp = constrain(rawAmp * 3.2, 0, 1);
    const smoothedAmp = lerp(previous ? previous.amp : 0, normalizedAmp, 0.35);
    const normalizedFft = fft.map((value) => constrain(map(value, -110, -18, 0, 1), 0, 1));
    return {
      amp: smoothedAmp,
      bass: averageRange(normalizedFft, 0, 8),
      mid: averageRange(normalizedFft, 8, 28),
      treble: averageRange(normalizedFft, 28, normalizedFft.length),
      waveform,
      fft: normalizedFft,
    };
  }

  setSpatialPosition(point) {
    this.setPanValue(getPanFromPoint(point), 0.08);
  }

  setPanValue(pan, rampTime) {
    if (!this.width || !this.width.pan || !Number.isFinite(pan)) return;
    const target = constrain(pan, -0.9, 0.9);
    if (typeof this.width.pan.rampTo === "function") {
      this.width.pan.rampTo(target, rampTime);
    } else {
      this.width.pan.value = target;
    }
  }

  updateFromLayers(layerState) {
    const filterFrequency = map(selectedFilter, 0, 1, 180, 1800);
    this.loopEngine.noteFilter.frequency.value = filterFrequency;
    this.loopEngine.pluckFilter.frequency.value = filterFrequency;
    this.memoryFilter.frequency.value = map(selectedFilter, 0, 1, 420, 3600);
    this.reverb.wet.value = map(selectedFilter, 0, 1, 0.38, 0.62);
  }

  playEvent(event, time, params) {
    if (event.soundEngine) {
      this.playGestureEvent(event, time, memoryFade({ cycleCount: 0, maxCycles: 5 }));
      return;
    }
    const motion = getPlaybackParams("motion") || defaultParams;
    const decay = getPlaybackParams("decay") || defaultParams;
    const texture = getPlaybackParams("texture") || defaultParams;
    const dropout = this.memoryEngine.dropout + decay.chance * 0.1;
    if (random() < dropout) return;
    if (random() > event.probability + params.density * 0.12 - decay.chance * 0.08) return;

    const eventTime = time + event.drift + random(-this.motionEngine.timing, this.motionEngine.timing);
    const velocity = constrain(event.velocity + random(-0.07, 0.07) * (0.3 + params.variation), 0.03, 0.55);

    if (event.type === "click") {
      const freq = noteToFrequency(event.note) * random([0.5, 1, 2]);
      this.triggerGate(this.loopEngine.click, this.loopEngine.clickGain, freq, random(0.01, 0.026), eventTime, velocity * 0.18);
      return;
    }

    const note = mutateNote(event, params.variation + motion.pitch);
    if (random() < 0.32 + params.variation * 0.25) {
      this.loopEngine.pluck.triggerAttackRelease(note, random(["32n", "16n", "8n"]), eventTime, velocity * 0.5);
    } else {
      this.loopEngine.voice.triggerAttackRelease(note, event.duration, eventTime, velocity);
    }

    if (random() < texture.chance * 0.25 + event.texture * 0.12) {
      this.triggerGate(this.loopEngine.click, this.loopEngine.clickGain, noteToFrequency(note) * random([1.5, 2, 3]), 0.012, eventTime + random(0.01, 0.08), velocity * 0.08);
    }
  }

  playGestureEvent(event, time, fade) {
    this.setPanValue(event.pan, 0.03);
    const velocity = constrain((event.velocity || 0.58) * fade, 0.04, 0.9);
    const filterFrequency = map(event.filterValue || 0.5, 0, 1, 180, 1800);
    this.loopEngine.noteFilter.frequency.value = filterFrequency;
    this.loopEngine.pluckFilter.frequency.value = filterFrequency;

    if (event.type === "chord") {
      this.playDroneChord(event, time, velocity);
      return;
    }

    if (event.type === "percussion") {
      if (random() > event.probability) return;
      this.triggerGate(this.loopEngine.click, this.loopEngine.clickGain, noteToFrequency("C3") * random([0.5, 0.75, 1]), event.random ? 0.018 : 0.028, time, velocity * (event.random ? 0.24 : 0.42));
      return;
    }

    if (event.type === "clickPattern") {
      if (random() > event.probability) return;
      this.memoryDistortion.distortion = map(event.distortion || 0.2, 0, 1, 0.002, 0.08);
      this.triggerGate(this.loopEngine.click, this.loopEngine.clickGain, noteToFrequency(event.note) * random([0.5, 1, 1.5]), 0.014, time, velocity * 0.34);
      return;
    }

    if (event.type === "lead") {
      this.loopEngine.pluck.triggerAttackRelease(event.note, "8n", time, velocity * 0.62);
      return;
    }

    if (event.type === "sample") {
      this.playSample(event, time, velocity);
      return;
    }

    this.loopEngine.pluck.triggerAttackRelease(event.note, "8n", time, velocity * 0.7);
  }

  playDroneChord(event, time, velocity) {
    const chord = randomizeInversion(event.chord || chordBank[0], event.inversion || 0);
    const filterFrequency = map(event.filterValue || 0.5, 0, 1, 180, 1800) * random(0.72, 1.08);
    this.loopEngine.noteFilter.frequency.value = constrain(filterFrequency, 140, 2200);
    for (let i = 0; i < chord.length; i++) {
      const relativeVelocity = constrain(velocity * random(0.65, 1.05 + (event.velocitySpread || 0.1)), 0.03, 0.9);
      this.loopEngine.voice.triggerAttackRelease(chord[i], "1m", time + i * random(0.02, 0.07), relativeVelocity * 0.42);
    }
  }

  playSample(event, time, velocity) {
    const players = this.sampleEngine.players;
    if (!players.length) {
      this.triggerGate(this.loopEngine.click, this.loopEngine.clickGain, noteToFrequency("C3"), 0.04, time, velocity);
      return;
    }
    const index = ((event.sampleIndex || 0) % players.length + players.length) % players.length;
    let player = players[index];
    const state = this.sampleEngine.states[index];
    if (!player || !player.loaded) {
      const fallbackIndex = players.findIndex((item) => item && item.loaded);
      if (fallbackIndex < 0) {
        systemMessage = state && state.failed ? "sample could not load" : "samples still loading";
        return false;
      }
      player = players[fallbackIndex];
    }
    systemMessage = "";
    const repeatCount = max(1, floor(event.repeatCount || 1));
    const volume = map(velocity, 0, 1, -28, -12);
    for (let i = 0; i < repeatCount; i++) {
      const startTime = time + i * random(0.18, 0.28);
      this.startSampleVoice(player, startTime, volume, random([0.78, 0.88, 1, 1]));
    }
    return true;
  }

  startSampleVoice(sourcePlayer, time, volume, playbackRate) {
    const voice = new Tone.Player({
      url: sourcePlayer.buffer,
      fadeIn: 0.025,
      fadeOut: 0.18,
      playbackRate,
      onstop: () => {
        this.sampleEngine.activeVoices.delete(voice);
        voice.dispose();
      },
    }).connect(this.sampleEngine.gain);
    voice.volume.value = volume;
    this.sampleEngine.activeVoices.add(voice);
    voice.start(time);
  }

  toggleSampleLoop(event, time, velocity) {
    const players = this.sampleEngine.players;
    if (!players.length) return false;
    const index = ((event.sampleIndex || 0) % players.length + players.length) % players.length;
    const player = players[index];
    if (!player || !player.loaded) {
      systemMessage = "sample loop waiting for file";
      return false;
    }

    if (this.sampleEngine.loopPlayer && this.sampleEngine.loopIndex === index) {
      this.stopSampleLoop(time);
      return false;
    }

    this.stopSampleLoop(time);
    const loopPlayer = new Tone.Player({
      url: player.buffer,
      fadeIn: 0.03,
      fadeOut: 0.2,
      loop: true,
      playbackRate: 1,
    }).connect(this.sampleEngine.gain);
    loopPlayer.volume.value = map(velocity, 0, 1, -30, -14);
    loopPlayer.start(time);
    this.sampleEngine.loopPlayer = loopPlayer;
    this.sampleEngine.loopIndex = index;
    this.sampleEngine.loopGridCell = Number.isFinite(event.gridCell) ? event.gridCell : index;
    this.sampleEngine.loopStopTime = time + max(1, player.buffer.duration || 1) * 5;
    systemMessage = "";
    return true;
  }

  updateSampleLoops(time) {
    if (!this.sampleEngine || !this.sampleEngine.loopPlayer || !Number.isFinite(this.sampleEngine.loopStopTime)) return;
    if (time >= this.sampleEngine.loopStopTime) this.stopSampleLoop(time);
  }

  stopSampleLoop(time) {
    if (!this.sampleEngine || !this.sampleEngine.loopPlayer) return;
    try {
      this.sampleEngine.loopPlayer.stop(time);
      this.sampleEngine.loopPlayer.dispose();
    } catch (error) {}
    this.sampleEngine.loopPlayer = null;
    this.sampleEngine.loopIndex = null;
    this.sampleEngine.loopGridCell = null;
    this.sampleEngine.loopStopTime = null;
  }

  stopSamples(time) {
    if (!this.sampleEngine || !this.sampleEngine.players) return;
    this.stopSampleLoop(time);
    for (const voice of Array.from(this.sampleEngine.activeVoices || [])) {
      try {
        voice.stop(time);
      } catch (error) {}
    }
    for (const player of this.sampleEngine.players) {
      if (!player || !player.loaded) continue;
      try {
        player.stop(time);
      } catch (error) {}
    }
  }

  playTextureTick(time, params) {
    if (random() > map(params.density + params.chance, 0, 2, 0.05, 0.72)) return;
    this.textureEngine.crackleGain.gain.cancelScheduledValues(time);
    this.textureEngine.crackleGain.gain.setValueAtTime(0, time);
    this.textureEngine.crackleGain.gain.linearRampToValueAtTime(map(params.depth, 0, 1, 0.006, 0.045), time + 0.001);
    this.textureEngine.crackleGain.gain.exponentialRampToValueAtTime(0.0001, time + random(0.025, 0.09));
  }

  playMemoryTick(time, params) {
    if (random() > map(params.chance + params.density, 0, 2, 0.02, 0.36)) return;
    this.memoryFilter.frequency.setValueAtTime(random(420, 1600), time);
    this.memoryFilter.frequency.rampTo(map(params.depth, 0, 1, 3600, 650), random(0.18, 0.48));
  }

  triggerGate(oscillator, gainNode, frequency, duration, time, velocity) {
    oscillator.frequency.setValueAtTime(frequency, time);
    gainNode.gain.cancelScheduledValues(time);
    gainNode.gain.setValueAtTime(0, time);
    gainNode.gain.linearRampToValueAtTime(velocity, time + 0.001);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    gainNode.gain.setValueAtTime(0, time + duration + 0.006);
  }
}

class LoopManager {
  constructor(engine) {
    this.engine = engine;
    this.loopLength = 16;
    this.step = 0;
    this.started = false;
    this.clock = new Tone.Loop((time) => this.tick(time), "16n");
  }

  start() {
    if (this.started) return;
    this.clock.start(0);
    this.started = true;
  }

  tick(time) {
    this.playLivePreview(time);
    this.playSavedLoops(time);
    this.step = (this.step + 1) % this.loopLength;
  }

  playLivePreview(time) {
    if (!activeProcessKey) return;
  }

  playSavedLoops(time) {
    const stepPosition = this.step / this.loopLength;
    const windowSize = 1 / this.loopLength;

    if (this.step === 0) this.advanceMemoryCycles();

    for (const memory of loopMemories) {
      if (!memory.events.length) continue;
      const fade = memoryFade(memory);
      const loopParams = getMemoryParams(memory);
      for (const event of memory.events) {
        if (event.time >= stepPosition && event.time < stepPosition + windowSize) {
          const fadedEvent = { ...event, velocity: event.velocity * fade, probability: event.probability * fade };
          this.engine.playEvent(fadedEvent, time, loopParams);
          visualSystem.createEventParticle(fadedEvent);
        }
      }
    }
  }

  advanceMemoryCycles() {
    for (const memory of loopMemories) {
      if (memory.background) continue;
      memory.cycleCount++;
      if (memory.cycleCount >= memory.maxCycles) memory.fading = true;
    }
    loopMemories = loopMemories.filter((memory) => memory.background || memory.cycleCount <= memory.maxCycles);
    savedBlocks = savedBlocks.filter((block) => loopMemories.some((memory) => memory.id === block.id));
  }
}

class VisualSystem {
  constructor() {
    this.state = {
      colorMix: 0,
      pixelDust: 0.12,
      drift: 0.05,
      space: 0.1,
      decay: 0.08,
    };
    this.audioObjects = [];
    this.globalAmp = 0;
  }

  update(activeKey, layerState, analysis, gesturePoint) {
    const loop = getPlaybackParams("loopCreator");
    const motion = getPlaybackParams("motion");
    const texture = getPlaybackParams("texture");
    const space = getPlaybackParams("space");
    const decay = getPlaybackParams("decay");

    this.state.colorMix = lerp(this.state.colorMix, loop ? loop.depth : 0.12, 0.06);
    this.state.pixelDust = lerp(this.state.pixelDust, texture ? texture.density + texture.chance * 0.7 : 0.12, 0.06);
    this.state.drift = lerp(this.state.drift, motion ? motion.variation : 0.06, 0.06);
    this.state.space = lerp(this.state.space, space ? space.depth : 0.1, 0.06);
    this.state.decay = lerp(this.state.decay, decay ? decay.chance + decay.depth * 0.4 : 0.06, 0.06);
    this.globalAmp = lerp(this.globalAmp, analysis ? analysis.amp : 0, 0.35);

    if (activeKey && isFinitePoint(gesturePoint)) {
      const object = this.getOrCreateAudioObject(activeKey, gesturePoint);
      object.updateTarget(gesturePoint);
      object.hold = max(object.hold, this.globalAmp * 0.9 + 0.08);
    }

    for (let i = this.audioObjects.length - 1; i >= 0; i--) {
      const object = this.audioObjects[i];
      object.update(analysis || audioAnalysis, activeKey === object.key);
      if (object.dead()) this.audioObjects.splice(i, 1);
    }
  }

  drawBackground(gridVisible) {
    if (frameCount < 3) {
      background(0);
    } else {
      background(0, 18 + this.globalAmp * 18);
    }

    if (gridVisible) return;

    noFill();
    strokeWeight(1);
    for (let band = 0; band < 5; band++) {
      const y = map(band, 0, 4, height * 0.18, height * 0.82);
      stroke(255, 255, 255, 14 + this.globalAmp * 24);
      beginShape();
      for (let x = -40; x <= width + 40; x += 24) {
        const n = noise(band * 17, x * 0.003, frameCount * 0.002);
        const drift = sin(frameCount * 0.006 + x * 0.01 + band) * (10 + this.state.drift * 28);
        vertex(x, y + (n - 0.5) * 80 + drift);
      }
      endShape();
    }
  }

  getOrCreateAudioObject(key, point) {
    let object = this.audioObjects.find((item) => item.key === key && item.anchor === "gesture");
    if (!object) {
      object = new ReactiveGestureVisual(key, point, "gesture");
      this.audioObjects.push(object);
    }
    return object;
  }

  pulseAudioObject(event) {
    const key = event.soundEngine || activeProcessKey || "loopCreator";
    const point = {
      x: Number.isFinite(event.visualX) ? event.visualX : width * 0.5,
      y: Number.isFinite(event.visualY) ? event.visualY : height * 0.5,
    };
    const object = new ReactiveGestureVisual(key, point, event.type || "event");
    object.hold = constrain((event.velocity || 0.5) + this.globalAmp, 0.18, 1);
    object.life = event.type === "lead" ? 56 : 104;
    object.radius *= event.type === "chord" ? 1.55 : event.type === "sample" ? 1.3 : 1;
    this.audioObjects.push(object);
    while (this.audioObjects.length > 18) this.audioObjects.shift();
  }

  drawAudioReactiveLayer(analysis) {
    for (const object of this.audioObjects) {
      object.display(analysis || audioAnalysis);
    }
  }

  drawSampleGrid(visible, point) {
    if (!visible) return;
    const col = isFinitePoint(point) ? floor(constrain(map(point.x, 0, width, 0, 4), 0, 3.999)) : -1;
    const row = isFinitePoint(point) ? floor(constrain(map(point.y, 0, height, 0, 4), 0, 3.999)) : -1;
    const loopingCell = getLoopingSampleGridCell();

    if (col >= 0 && row >= 0) {
      noStroke();
      fill(255, 34, 28, 88 + this.globalAmp * 72);
      const pad = 12 + this.globalAmp * 8;
      rect(col * width * 0.25 + pad, row * height * 0.25 + pad, width * 0.25 - pad * 2, height * 0.25 - pad * 2);
    }

    if (loopingCell !== null) {
      this.drawFluidSampleCell(loopingCell, color(20, 92, 255), 96 + this.globalAmp * 82);
    }

    noFill();
    stroke(255, 255, 255, 48 + this.globalAmp * 70);
    strokeWeight(1.2 + this.globalAmp * 2.4);
    for (let i = 1; i < 4; i++) {
      const x = width * i * 0.25;
      const y = height * i * 0.25;
      this.drawWavyDivider(x, true, i);
      this.drawWavyDivider(y, false, i + 8);
    }
  }

  drawFluidSampleCell(cell, fillColor, alpha) {
    const col = cell % 4;
    const row = floor(cell / 4) % 4;
    const x = col * width * 0.25;
    const y = row * height * 0.25;
    const w = width * 0.25;
    const h = height * 0.25;
    const pad = 18 + this.globalAmp * 10;
    const left = x + pad;
    const right = x + w - pad;
    const top = y + pad;
    const bottom = y + h - pad;
    const seed = cell * 31.7;
    const wobble = 9 + this.state.drift * 26 + this.globalAmp * 18;

    noStroke();
    fill(red(fillColor), green(fillColor), blue(fillColor), alpha);
    beginShape();
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const n = noise(seed, t * 1.8, frameCount * 0.01);
      curveVertex(lerp(left, right, t), top + (n - 0.5) * wobble);
    }
    for (let i = 0; i <= 5; i++) {
      const t = i / 5;
      const n = noise(seed + 8, t * 1.8, frameCount * 0.01);
      curveVertex(right + (n - 0.5) * wobble, lerp(top, bottom, t));
    }
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const n = noise(seed + 16, t * 1.8, frameCount * 0.01);
      curveVertex(lerp(right, left, t), bottom + (n - 0.5) * wobble);
    }
    for (let i = 0; i <= 5; i++) {
      const t = i / 5;
      const n = noise(seed + 24, t * 1.8, frameCount * 0.01);
      curveVertex(left + (n - 0.5) * wobble, lerp(bottom, top, t));
    }
    endShape(CLOSE);

    noFill();
    stroke(135, 195, 255, alpha * 0.55);
    strokeWeight(1.2 + this.globalAmp * 2);
    beginShape();
    for (let i = 0; i <= 20; i++) {
      const angle = map(i, 0, 20, 0, TWO_PI);
      const rx = w * 0.34 + (noise(seed + 40, i * 0.2, frameCount * 0.01) - 0.5) * wobble;
      const ry = h * 0.34 + (noise(seed + 48, i * 0.2, frameCount * 0.01) - 0.5) * wobble;
      curveVertex(x + w * 0.5 + cos(angle) * rx, y + h * 0.5 + sin(angle) * ry);
    }
    endShape(CLOSE);
  }

  drawWavyDivider(position, vertical, seed) {
    const step = 24;
    const driftAmount = 12 + this.state.drift * 28 + this.globalAmp * 18;
    beginShape();
    if (vertical) {
      for (let y = -40; y <= height + 40; y += step) {
        const n = noise(seed * 19, y * 0.003, frameCount * 0.002);
        const drift = sin(frameCount * 0.006 + y * 0.01 + seed) * driftAmount;
        vertex(position + (n - 0.5) * 58 + drift, y);
      }
    } else {
      for (let x = -40; x <= width + 40; x += step) {
        const n = noise(seed * 19, x * 0.003, frameCount * 0.002);
        const drift = sin(frameCount * 0.006 + x * 0.01 + seed) * driftAmount;
        vertex(x, position + (n - 0.5) * 58 + drift);
      }
    }
    endShape();
  }

  mainColor() {
    const palette = [
      color(210, 22, 28),
      color(20, 40, 185),
      color(120, 255, 0),
      color(255, 42, 185),
      color(255, 228, 92),
    ];
    const scaled = constrain(this.state.colorMix, 0, 1) * (palette.length - 1);
    const index = floor(scaled);
    const nextIndex = min(index + 1, palette.length - 1);
    return lerpColor(palette[index], palette[nextIndex], scaled - index);
  }

  createLeftHandParticles(leftHand, openness, activeKey) {
    for (const key of ["index", "middle", "ring", "pinky"]) {
      if (openness[key] > 0.45 && frameCount % 3 === 0) {
        const point = leftHand.keypoints[fingerTips[key]];
        if (!isFinitePoint(point)) continue;
        particles.push({
          x: point.x,
          y: point.y,
          vx: random(-1.3, 1.3),
          vy: random(-1.3, 1.3),
          size: random([3, 4, 6]),
          life: 34,
          color: processColors[activeKey] || [255, 255, 255],
        });
      }
    }
  }

  createEventParticle(event) {
    this.pulseAudioObject(event);
    const key = event.soundEngine || event.key || activeProcessKey || "loopCreator";
    const c = processColors[key] || processColors.loopCreator;
    const x = Number.isFinite(event.visualX) ? event.visualX : random(width * 0.22, width * 0.78);
    const y = Number.isFinite(event.visualY) ? event.visualY : random(height * 0.22, height * 0.72);
    particles.push({
      x,
      y,
      vx: random(-0.5, 0.5),
      vy: random(-0.8, 0.8),
      size: event.type === "click" || event.type === "clickPattern" ? 4 : 7,
      life: 46,
      color: c,
    });
  }

  drawParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      const alpha = map(p.life, 0, 46, 0, 170);
      noFill();
      stroke(255, 255, 255, alpha * 0.55);
      strokeWeight(1);
      circle(p.x, p.y, p.size * 2.8);
      noStroke();
      fill(255, 35, 28, alpha);
      circle(p.x, p.y, p.size);
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  createSavedBlock(memory) {
    const c = processColors[memory.key];
    const originX = 78 + savedBlocks.length * 124;
    const originY = height - 112;
    const cells = [];
    for (let i = 0; i < 36; i++) {
      cells.push({
        x: (i % 6) * 13,
        y: floor(i / 6) * 13,
        on: random() < 0.28 + memory.params.density * 0.5,
      });
    }
    savedBlocks.push({ id: memory.id, key: memory.key, background: memory.background, x: originX % (width - 130), y: originY, color: c, cells, age: 0 });
  }

  drawSavedBlocks() {
    for (const block of savedBlocks) {
      const memory = loopMemories.find((item) => item.id === block.id);
      if (!memory) continue;
      const fade = memoryFade(memory);
      block.age++;
      fill(block.color[0], block.color[1], block.color[2], 20 + 34 * fade);
      rect(block.x - 8, block.y - 8, 94, 94);
      for (const cell of block.cells) {
        const decay = block.key === "decay" && random() < this.state.decay * 0.2;
        fill(block.color[0], block.color[1], block.color[2], cell.on && !decay ? 70 + 150 * fade : 35);
        rect(block.x + cell.x + (decay ? random(-2, 2) : 0), block.y + cell.y, 9, 9);
      }
      fill(255);
      textSize(10);
      text(processShortNames[block.key], block.x, block.y + 84);
      text(memory.background ? (block.key === "motion" ? "PERC LOOP" : "BG LOOP") : (memory.maxCycles - memory.cycleCount) + "x left", block.x + 44, block.y + 84);
    }
  }

  drawHands(sortedHands, activeFinger, leftHand) {
    if (HandTracker.isValidHand(leftHand)) {
      for (const key of ["thumb", "index"]) {
        const point = leftHand.keypoints[fingerTips[key]];
        if (isFinitePoint(point)) this.drawEchoDot(point, 9, key === "thumb" ? 0 : 1.3, 0.82);
      }
    }

    const rightHand = HandTracker.getHandBySide(sortedHands, "Right", 1);
    if (HandTracker.isValidHand(rightHand) && activeFinger) {
      for (let i = 0; i < activeFinger.openFingers.length; i++) {
        const key = activeFinger.openFingers[i];
        const point = rightHand.keypoints[fingerTips[key]];
        if (isFinitePoint(point)) this.drawEchoDot(point, 11, i * 0.85, 1);
      }
    }
  }

  drawEchoDot(point, size, phase, strength) {
    const pulse = (sin(frameCount * 0.18 + phase) + 1) * 0.5;
    noFill();
    for (let i = 0; i < 4; i++) {
      const radius = size + i * 13 + pulse * (8 + i * 2);
      stroke(255, 28, 28, strength * (92 - i * 20));
      strokeWeight(max(1, 3 - i * 0.45));
      circle(point.x, point.y, radius);
    }

    noStroke();
    fill(255, 28, 28, 225 * strength);
    circle(point.x, point.y, size);
    fill(255, 220, 210, 190 * strength);
    circle(point.x, point.y, max(3, size * 0.34));
  }

  drawInterface(activeFinger) {
    noStroke();
    fill(0, 138);
    rect(18, 18, 500, 202);
    fill(255);
    textSize(15);
    text("ACTIVE PROCESS", 34, 34);
    textSize(18);
    text(activeProcessKey ? processNames[activeProcessKey] : "show one right finger", 34, 58);
    textSize(13);
    text(audioReady ? "living loops active" : "show hands to start audio", 34, 92);
    text(systemMessage || this.layerStatus(activeFinger), 34, 114);
    text("left index: Y pitch/pattern | X filter/subdivision/grid", 34, 138);
    text("left thumb + index pinch: trigger and store event", 34, 156);
    text("right hand: 1 drone | 2 perc loop | 3 clicks | 4 lead | 5 samples", 34, 174);
    text("note " + selectedNote + " / filter " + nf(selectedFilter * 100, 2, 0) + "% / sample " + (selectedSampleIndex + 1), 34, 192);

    const startX = width - 310;
    const startY = 26;
    fill(0, 130);
    rect(startX - 18, startY - 8, 292, 186);
    fill(255);
    textSize(14);
    text("BACKGROUND + MEMORIES", startX, startY);
    for (let i = 0; i < processOrder.length; i++) {
      const key = processOrder[i];
      const layer = layers[key];
      const c = processColors[key];
      const y = startY + 28 + i * 28;
      const hasBackground = loopMemories.some((memory) => memory.key === key && memory.background);
      fill(c[0], c[1], c[2], layer.saved ? 230 : 60);
      rect(startX, y, 18, 18);
      fill(255);
      textSize(12);
      const count = loopMemories.filter((memory) => memory.key === key).length;
      text(processShortNames[key] + (hasBackground ? (key === "motion" ? " / perc loop" : " / bg loop") : count ? " / " + count + " active" : " / empty"), startX + 28, y + 2);
    }

    if (activeProcessKey) this.drawParamBars(layers[activeProcessKey].params, 34, 236);
  }

  drawParamBars(params, x, y) {
    const labels = ["note", "filter"];
    fill(0, 128);
    rect(x - 16, y - 14, 250, 76);
    for (let i = 0; i < labels.length; i++) {
      const label = labels[i];
      const value = i === 0 ? fixedScale.indexOf(selectedNote) / (fixedScale.length - 1) : selectedFilter;
      fill(255);
      textSize(11);
      text(label, x, y + i * 25);
      fill(25, 20, 90);
      rect(x + 86, y + i * 25 - 3, 120, 8);
      const c = processColors[activeProcessKey];
      fill(c[0], c[1], c[2]);
      rect(x + 86, y + i * 25 - 3, 120 * value, 8);
    }
  }

  layerStatus(activeFinger) {
    if (!activeProcessKey) return "status: waiting";
    const layer = layers[activeProcessKey];
    const progress = layer.stillSince ? constrain((millis() - layer.stillSince) / stillSaveTime, 0, 1) : 0;
    if (millis() < saveCooldownUntil) return "status: saved, move before saving again";
    if (activeProcessKey === "loopCreator" && loopMemories.some((memory) => memory.key === "loopCreator" && memory.background)) return "status: 1-finger pad is looping in background";
    if (activeProcessKey === "motion" && loopMemories.some((memory) => memory.key === "motion" && memory.background)) return "status: 2-finger percussion is looping";
    if (layer.saved && !layer.movedAfterSave) return "status: event remembered for " + loopLifetimeCycles + " cycles";
    if (!activeFinger) return "status: shaping process";
    return "status: pinch left thumb + index to place sound";
  }
}

class ReactiveGestureVisual {
  constructor(key, point, anchor) {
    this.key = key;
    this.anchor = anchor;
    this.x = point.x;
    this.y = point.y;
    this.targetX = point.x;
    this.targetY = point.y;
    this.seed = random(1000);
    this.clock = random(100);
    this.hold = 0.08;
    this.life = anchor === "gesture" ? 160 : 96;
    this.maxLife = this.life;
    this.radius = this.baseRadius();
    this.aspect = key === "space" ? 0.58 : key === "motion" ? 0.74 : 0.92;
    this.spin = random([-1, 1]) * random(0.002, 0.007);
  }

  baseRadius() {
    if (this.key === "loopCreator") return random(86, 124);
    if (this.key === "motion") return random(44, 72);
    if (this.key === "texture") return random(30, 54);
    if (this.key === "space") return random(72, 112);
    if (this.key === "decay") return random(58, 92);
    return random(48, 84);
  }

  updateTarget(point) {
    this.targetX = point.x;
    this.targetY = point.y;
  }

  update(analysis, active) {
    const amp = analysis ? analysis.amp : 0;
    this.clock += 0.004 + amp * 0.035 + abs(this.spin);
    this.x = lerp(this.x, this.targetX, 0.08 + amp * 0.08);
    this.y = lerp(this.y, this.targetY, 0.08 + amp * 0.08);
    this.hold = lerp(this.hold, amp, active ? 0.16 : 0.08);
    if (active && this.anchor === "gesture") {
      this.life = min(this.maxLife, this.life + 4);
    } else {
      this.life--;
    }
  }

  dead() {
    return this.life <= 0 && this.hold < 0.025;
  }

  display(analysis) {
    const waveform = analysis && analysis.waveform ? analysis.waveform : [];
    const band = this.bandLevel(analysis);
    const amp = constrain(max(analysis ? analysis.amp : 0, this.hold * 0.85), 0, 1);
    const lifeFade = constrain(this.life / this.maxLife, 0, 1);
    const alpha = lifeFade * (38 + amp * 190);
    const detail = this.key === "texture" ? 160 : 128;
    const noiseScale = this.key === "motion" ? 64 : this.key === "texture" ? 96 : 58;
    const ampRadius = this.radius * (1 + amp * 0.34 + band * 0.2);

    push();
    translate(this.x, this.y);
    rotate(sin(this.clock * 0.6) * 0.18 + this.spin * frameCount);
    noFill();
    stroke(255, 255, 255, alpha);
    strokeWeight(0.8 + amp * 4.5);

    for (let ring = 0; ring < 5; ring++) {
      const offset = ring * (7 + amp * 14);
      stroke(255, 255, 255, lifeFade * (36 + amp * 138 - ring * 18));
      strokeWeight(max(0.65, 2.2 + amp * 5 - ring * 0.45));
      beginShape();
      for (let step = 0; step <= detail; step++) {
        const i = map(step, 0, detail, 0, TWO_PI);
        const wave = waveform.length ? waveform[floor(map(step % detail, 0, detail, 0, waveform.length - 1))] : 0;
        const slowNoise = noise(this.seed + ring * 0.9 + cos(i) * 0.8, this.seed + sin(i) * 0.8, frameCount * 0.0012);
        const audioNoise = noise(this.seed * 0.13 + this.clock + ring, i * 0.34);
        const distortion = (slowNoise - 0.5) * 20 + (audioNoise - 0.5) * noiseScale * (0.25 + amp) + wave * (8 + amp * 54);
        const r = ampRadius + offset + distortion;
        vertex(cos(i) * r, sin(i) * r * this.aspect);
      }
      endShape(CLOSE);
    }

    stroke(255, 38, 30, lifeFade * (58 + amp * 172));
    strokeWeight(1.3 + amp * 3);
    for (let step = 0; step < detail; step += 10) {
      const i = map(step, 0, detail, 0, TWO_PI);
      const n = noise(this.seed * 2, i, this.clock);
      const r = ampRadius + (n - 0.5) * (28 + amp * 80);
      point(cos(i) * r, sin(i) * r * this.aspect);
    }

    noStroke();
    fill(255, 32, 28, lifeFade * (150 + amp * 90));
    circle(0, 0, 5 + amp * 9);
    noFill();
    stroke(255, 38, 30, lifeFade * (42 + amp * 110));
    strokeWeight(1.2 + amp * 2);
    circle(0, 0, 22 + amp * 42);
    pop();
  }

  bandLevel(analysis) {
    if (!analysis) return 0;
    if (this.key === "loopCreator") return analysis.bass || 0;
    if (this.key === "motion") return analysis.mid || 0;
    if (this.key === "texture") return analysis.treble || 0;
    if (this.key === "space") return (analysis.mid || 0) * 0.5 + (analysis.treble || 0) * 0.5;
    if (this.key === "decay") return (analysis.bass || 0) * 0.35 + (analysis.mid || 0) * 0.65;
    return analysis.amp || 0;
  }
}

class HandTracker {
  static getSortedHands(sourceHands) {
    return sourceHands.slice().filter(HandTracker.isValidHand).sort((a, b) => HandTracker.getHandCenterX(a) - HandTracker.getHandCenterX(b));
  }

  static getHandBySide(sortedHands, label, fallbackIndex) {
    const hasLabels = sortedHands.some((hand) => hand.handedness);
    for (const hand of sortedHands) if (hand.handedness === label) return hand;
    if (hasLabels) return null;
    return sortedHands[fallbackIndex] || null;
  }

  static getPerformanceHands(sortedHands) {
    const labeledRight = HandTracker.getHandBySide(sortedHands, "Right", 1);
    const labeledLeft = HandTracker.getHandBySide(sortedHands, "Left", 0);
    const rightHand = labeledRight || sortedHands[1] || sortedHands[0] || null;
    const activeFinger = GestureDetector.getActiveRightGesture(rightHand);
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
  static getActiveRightGesture(hand) {
    if (!HandTracker.isValidHand(hand)) return null;
    const openness = GestureDetector.getFingerOpenness(hand);
    const openFingers = [];
    for (const key of fingerOrder) {
      if (openness[key] > 0.52) openFingers.push(key);
    }
    const count = constrain(openFingers.length, 0, 5);
    if (count === 0) return null;

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
    };
  }

  static getFingerOpenness(hand) {
    const openness = {};
    for (const key of fingerOrder) openness[key] = GestureDetector.getFingerOpenAmount(hand, key);
    return openness;
  }

  static getFingerOpenAmount(hand, key) {
    if (!HandTracker.isValidHand(hand)) return 0;
    const wrist = hand.keypoints[0];
    const tip = hand.keypoints[fingerTips[key]];
    const joint = hand.keypoints[fingerJoints[key]];
    if (!isFinitePoint(wrist) || !isFinitePoint(tip) || !isFinitePoint(joint)) return 0;
    return constrain(map(dist(tip.x, tip.y, wrist.x, wrist.y) - dist(joint.x, joint.y, wrist.x, wrist.y), -10, 55, 0, 1), 0, 1);
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
