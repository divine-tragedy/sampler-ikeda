let video;
let handPose;
let hands = [];
let audioReady = false;
let audioStarting = false;
let lastAudioStartAttempt = 0;

let activeProcessKey = null;
let previousProcessKey = null;
let leftThumbWasOpen = false;
let leftPinchWasActive = false;
let saveCooldownUntil = 0;

let audioEngine;
let loopManager;
let visualSystem;
let systemMessage = "";
let drawErrorMessage = "";
let audioModulationEnabled = true;

const canvasW = 960;
const canvasH = 620;
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
  "sounds/loop1.wav",
  "sounds/loop2.wav",
  "sounds/loop3.wav",
  "sounds/loop4.wav",
  "sounds/loop5.wav",
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

function preload() {
  handPose = ml5.handPose({
    flipped: true,
    maxHands: 2,
  });
}

function setup() {
  createCanvas(canvasW, canvasH);
  pixelDensity(1);
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
  const leftHand = HandTracker.getHandBySide(sorted, "Left", 0);
  const rightHand = HandTracker.getHandBySide(sorted, "Right", 1);
  const activeFinger = GestureDetector.getActiveRightGesture(rightHand);

  if (!audioReady && !audioStarting && activeFinger && millis() - lastAudioStartAttempt > 2400) {
    startAudioFromHands();
  }

  activeProcessKey = activeFinger ? activeFinger.processKey : null;
  if (activeProcessKey !== previousProcessKey) {
    resetStillTracking();
    previousProcessKey = activeProcessKey;
  }

  updateProcessTargets(leftHand);
  updateLeftIndexNote(leftHand);
  handlePinchTrigger(leftHand);
  updateProcessSmoothing();
  recordActiveProcessParams();
  updateAudioSafely();

  visualSystem.update(activeProcessKey, layers);
  visualSystem.drawBackground();
  visualSystem.drawSavedBlocks();
  visualSystem.drawParticles();
  visualSystem.drawHands(sorted, activeFinger, leftHand);
  visualSystem.drawInterface(activeFinger);
}

function updateAudioSafely() {
  if (!audioReady || !audioEngine || !audioModulationEnabled) return;
  try {
    audioEngine.updateFromLayers(layers);
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

async function startAudio() {
  if (audioReady || audioStarting) return;
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
  } catch (error) {
    audioStarting = false;
    systemMessage = "audio blocked by browser, visuals still active";
    console.error(error);
  }
}

function startAudioFromHands() {
  startAudio();
}

function keyPressed() {
  // Sound events are placed only by the left thumb-index pinch.
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

function updateLeftIndexNote(leftHand) {
  if (!HandTracker.isValidHand(leftHand)) return;
  const indexTip = leftHand.keypoints[fingerTips.index];
  if (!isFinitePoint(indexTip)) return;

  const noteIndex = floor(constrain(map(indexTip.y, height * 0.92, height * 0.08, 0, fixedScale.length), 0, fixedScale.length - 0.001));
  selectedNote = fixedScale[noteIndex];
  selectedFilter = constrain(map(indexTip.x, width * 0.08, width * 0.92, 0, 1), 0, 1);
  selectedSampleIndex = getSampleGridIndex(indexTip);
}

function getSampleGridIndex(point) {
  if (!isFinitePoint(point)) return 0;
  const col = floor(constrain(map(point.x, 0, width, 0, 4), 0, 3.999));
  const row = floor(constrain(map(point.y, 0, height, 0, 4), 0, 3.999));
  return row * 4 + col;
}

function handlePinchTrigger(leftHand) {
  const pinchActive = GestureDetector.isThumbIndexPinch(leftHand);
  if (pinchActive && !leftPinchWasActive) triggerSelectedNote(leftHand);
  leftPinchWasActive = pinchActive;
}

function triggerSelectedNote(leftHand) {
  if (!activeProcessKey) return;
  if (!audioReady && !audioStarting) startAudioFromHands();
  const isBackgroundLoop = activeProcessKey === "loopCreator" || activeProcessKey === "motion";
  const event = createGestureEvent(activeProcessKey, leftHand);
  const shouldLoop = activeProcessKey !== "space";

  if (!shouldLoop) {
    visualSystem.createEventParticle(event);
    if (audioReady && audioEngine) {
      try {
        audioEngine.playGestureEvent(event, Tone.now(), 1);
      } catch (error) {
        systemMessage = "lead event skipped";
        console.error(error);
      }
    }
    return;
  }

  const memory = {
    id: millis() + "-" + activeProcessKey,
    key: activeProcessKey,
    events: [event],
    params: { ...layers[activeProcessKey].params, depth: selectedFilter },
    pattern: null,
    savedAt: millis(),
    cycleCount: 0,
    maxCycles: isBackgroundLoop ? Infinity : loopLifetimeCycles,
    lastCycleStep: 0,
    fading: false,
    background: isBackgroundLoop,
  };

  if (activeProcessKey === "motion") memory.events = createRegularPercussionEvents(event);
  if (activeProcessKey === "texture") memory.events = createClickPatternEvents(event);

  if (isBackgroundLoop) {
    loopMemories = loopMemories.filter((item) => !(item.key === activeProcessKey && item.background));
    savedBlocks = savedBlocks.filter((block) => !(block.key === activeProcessKey && block.background));
  }

  loopMemories.push(memory);
  while (loopMemories.length > 8) {
    const removableIndex = loopMemories.findIndex((item) => !item.background);
    const removed = loopMemories.splice(removableIndex >= 0 ? removableIndex : 0, 1)[0];
    savedBlocks = savedBlocks.filter((block) => block.id !== removed.id);
  }
  visualSystem.createSavedBlock(memory);
  visualSystem.createEventParticle(event);
  if (audioReady && audioEngine) {
    try {
      audioEngine.playGestureEvent(event, Tone.now(), 1);
    } catch (error) {
      systemMessage = "audio event skipped, loop memory stored";
      console.error(error);
    }
  }
}

function createGestureEvent(engineKey, leftHand) {
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

  return { ...base, type: "lead", note: selectedNote, velocity: map(getHandCloseness(leftHand), 0, 1, 0.22, 0.92) };
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
    this.master = new Tone.Gain(0.74).toDestination();
    this.memoryFilter = new Tone.Filter(5200, "lowpass");
    this.memoryDistortion = new Tone.Distortion(0.008);
    this.memoryCrusher = new Tone.BitCrusher(8);
    this.delay = new Tone.FeedbackDelay("8n", 0.16);
    this.pingDelay = new Tone.PingPongDelay("4n", 0.18);
    this.reverb = new Tone.Reverb({ decay: 6.4, wet: 0.28 });
    this.width = new Tone.Panner(0);
    this.mainGain = new Tone.Gain(0.82);

    this.mainGain.chain(this.memoryFilter, this.memoryDistortion, this.memoryCrusher, this.delay, this.reverb, this.width, this.master);
    this.mainGain.connect(this.master);
    this.pingDelay.connect(this.reverb);

    this.loopEngine = this.createLoopCreatorEngine();
    this.motionEngine = this.createMotionEngine();
    this.textureEngine = this.createTextureEngine();
    this.spaceEngine = this.createSpaceEngine();
    this.memoryEngine = this.createMemoryEngine();
    this.sampleEngine = this.createSampleEngine();
  }

  createLoopCreatorEngine() {
    const noteFilter = new Tone.Filter(1050, "lowpass").connect(this.mainGain);
    const noteGain = new Tone.Gain(0.58).connect(noteFilter);
    const voice = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 0.74,
      modulationIndex: 0.42,
      oscillator: { type: "sine" },
      envelope: { attack: 1.2, decay: 1.4, sustain: 0.52, release: 5.2 },
      modulationEnvelope: { attack: 1.6, decay: 1.2, sustain: 0.12, release: 4.2 },
    }).connect(noteGain);

    const pluckFilter = new Tone.Filter(850, "lowpass").connect(this.mainGain);
    const pluckGain = new Tone.Gain(0.34).connect(pluckFilter);
    const pluck = new Tone.PluckSynth({
      attackNoise: 0.18,
      dampening: 950,
      resonance: 0.38,
    }).connect(pluckGain);

    const clickGain = new Tone.Gain(0).connect(this.mainGain);
    const click = new Tone.Oscillator({ type: "triangle", frequency: 420 }).connect(clickGain);
    return { voice, noteGain, noteFilter, pluck, pluckGain, pluckFilter, click, clickGain };
  }

  createMotionEngine() {
    const lfo = new Tone.LFO({ frequency: 0.08, min: -18, max: 18 });
    const filterLfo = new Tone.LFO({ frequency: 0.05, min: 900, max: 3600 });
    filterLfo.connect(this.loopEngine.noteFilter.frequency);
    return { lfo, filterLfo, drift: 0, timing: 0, pitch: 0 };
  }

  createTextureEngine() {
    const hissFilter = new Tone.Filter(4200, "bandpass").connect(this.reverb);
    const hissGain = new Tone.Gain(0).connect(hissFilter);
    const hiss = new Tone.Noise("pink").connect(hissGain);
    const crackleGain = new Tone.Gain(0).connect(this.mainGain);
    const crackle = new Tone.Noise("white").connect(new Tone.Filter(6500, "highpass").connect(crackleGain));
    return { hiss, hissGain, hissFilter, crackle, crackleGain };
  }

  createSpaceEngine() {
    return { wet: 0.18, feedback: 0.12, width: 0.1 };
  }

  createMemoryEngine() {
    return { age: 0, dropout: 0, filter: 7200 };
  }

  createSampleEngine() {
    const gain = new Tone.Gain(0.72).connect(this.mainGain);
    const players = samplePaths.map((path) => new Tone.Player(path).connect(gain));
    return { gain, players };
  }

  async start() {
    await Tone.start();
    await Tone.loaded();
    this.loopEngine.click.start();
    this.motionEngine.lfo.start();
    this.motionEngine.filterLfo.start();
    this.textureEngine.hiss.start();
    this.textureEngine.crackle.start();
    Tone.Transport.bpm.value = 82;
    Tone.Transport.swing = 0.08;
    Tone.Transport.start();
  }

  updateFromLayers(layerState) {
    const filterFrequency = map(selectedFilter, 0, 1, 260, 2600);
    this.loopEngine.noteFilter.frequency.value = filterFrequency;
    this.loopEngine.pluckFilter.frequency.value = filterFrequency;
    this.memoryFilter.frequency.value = map(selectedFilter, 0, 1, 700, 5200);
    this.reverb.wet.value = map(selectedFilter, 0, 1, 0.24, 0.46);
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
      this.triggerGate(this.loopEngine.click, this.loopEngine.clickGain, freq, random(0.004, 0.018), eventTime, velocity * 0.35);
      return;
    }

    const note = mutateNote(event, params.variation + motion.pitch);
    if (random() < 0.32 + params.variation * 0.25) {
      this.loopEngine.pluck.triggerAttackRelease(note, random(["32n", "16n", "8n"]), eventTime, velocity * 0.5);
    } else {
      this.loopEngine.voice.triggerAttackRelease(note, event.duration, eventTime, velocity);
    }

    if (random() < texture.chance * 0.25 + event.texture * 0.12) {
      this.triggerGate(this.loopEngine.click, this.loopEngine.clickGain, noteToFrequency(note) * random([2, 3, 4]), 0.006, eventTime + random(0.01, 0.08), velocity * 0.18);
    }
  }

  playGestureEvent(event, time, fade) {
    const velocity = constrain((event.velocity || 0.58) * fade, 0.04, 0.9);
    const filterFrequency = map(event.filterValue || 0.5, 0, 1, 260, 2600);
    this.loopEngine.noteFilter.frequency.value = filterFrequency;
    this.loopEngine.pluckFilter.frequency.value = filterFrequency;

    if (event.type === "chord") {
      this.playDroneChord(event, time, velocity);
      return;
    }

    if (event.type === "percussion") {
      if (random() > event.probability) return;
      this.triggerGate(this.loopEngine.click, this.loopEngine.clickGain, noteToFrequency("C3") * random([0.5, 1, 2]), event.random ? 0.011 : 0.018, time, velocity * (event.random ? 0.55 : 0.9));
      return;
    }

    if (event.type === "clickPattern") {
      if (random() > event.probability) return;
      this.memoryDistortion.distortion = map(event.distortion || 0.2, 0, 1, 0.01, 0.28);
      this.triggerGate(this.loopEngine.click, this.loopEngine.clickGain, noteToFrequency(event.note) * random([1, 1.5, 2]), 0.008, time, velocity * 0.72);
      return;
    }

    if (event.type === "lead") {
      this.loopEngine.pluck.triggerAttackRelease(event.note, "8n", time, velocity * 0.82);
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
    const filterFrequency = map(event.filterValue || 0.5, 0, 1, 260, 2600) * random(0.86, 1.16);
    this.loopEngine.noteFilter.frequency.value = constrain(filterFrequency, 180, 3200);
    for (let i = 0; i < chord.length; i++) {
      const relativeVelocity = constrain(velocity * random(0.65, 1.05 + (event.velocitySpread || 0.1)), 0.03, 0.9);
      this.loopEngine.voice.triggerAttackRelease(chord[i], "1m", time + i * random(0.01, 0.045), relativeVelocity * 0.5);
    }
  }

  playSample(event, time, velocity) {
    if (!this.sampleEngine.players.length) {
      this.triggerGate(this.loopEngine.click, this.loopEngine.clickGain, noteToFrequency("C3"), 0.04, time, velocity);
      return;
    }
    const index = event.sampleIndex % this.sampleEngine.players.length;
    const player = this.sampleEngine.players[index];
    if (!player || !player.loaded) return;
    player.volume.value = map(velocity, 0, 1, -22, -4);
    player.playbackRate = random([0.75, 1, 1, 1.25]);
    player.start(time);
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
  }

  update(activeKey, layerState) {
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
  }

  drawBackground() {
    const c = this.mainColor();
    const flicker = random() < this.state.decay * 0.08 ? random(-28, 28) : 0;
    background(
      constrain(red(c) + flicker, 0, 255),
      constrain(green(c) + flicker * 0.3, 0, 255),
      constrain(blue(c) + flicker, 0, 255)
    );

    noStroke();
    const grid = floor(map(constrain(this.state.pixelDust, 0, 1), 0, 1, 36, 12));
    for (let x = 0; x < width; x += grid) {
      for (let y = 0; y < height; y += grid) {
        if (random() < 0.08 + this.state.pixelDust * 0.24) {
          fill(random([color(0, 35, 210, 80), color(120, 255, 0, 70), color(255, 42, 185, 72), color(255, 228, 92, 80)]));
          rect(x + random(-this.state.decay * 10, this.state.decay * 10), y, random([3, 5, 8]), random([3, 5, 8]));
        }
      }
    }

    stroke(0, 18, 80, 58 + this.state.space * 70);
    strokeWeight(1);
    for (let x = 0; x < width; x += 48) {
      const shift = sin(frameCount * 0.01 + x * 0.02) * this.state.drift * 22;
      line(x + shift, 0, x - shift, height);
    }
    for (let y = 0; y < height; y += 48) {
      const shift = cos(frameCount * 0.011 + y * 0.02) * this.state.drift * 22;
      line(0, y + shift, width, y - shift);
    }

    if (this.state.space > 0.18) {
      noFill();
      stroke(255, 255, 255, 24 + this.state.space * 42);
      strokeWeight(2);
      for (let i = 0; i < 4; i++) {
        const r = 120 + i * 90 + sin(frameCount * 0.01 + i) * 30;
        rect(width * 0.5 - r, height * 0.5 - r * 0.45, r * 2, r * 0.9);
      }
    }
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
    particles.push({
      x: random(width * 0.22, width * 0.78),
      y: random(height * 0.22, height * 0.72),
      vx: random(-0.5, 0.5),
      vy: random(-0.8, 0.8),
      size: event.type === "click" ? 4 : 7,
      life: 46,
      color: processColors.loopCreator,
    });
  }

  drawParticles() {
    noStroke();
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      fill(p.color[0], p.color[1], p.color[2], map(p.life, 0, 46, 0, 220));
      rect(p.x, p.y, p.size, p.size);
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
    for (const hand of sortedHands) {
      const isRight = hand === HandTracker.getHandBySide(sortedHands, "Right", 1);
      const baseColor = isRight ? color(255, 42, 185) : color(120, 255, 0);
      stroke(red(baseColor), green(baseColor), blue(baseColor), 125);
      strokeWeight(2);
      for (const pair of connections) {
        const a = hand.keypoints[pair[0]];
        const b = hand.keypoints[pair[1]];
        if (isFinitePoint(a) && isFinitePoint(b)) line(a.x, a.y, b.x, b.y);
      }
      noStroke();
      fill(baseColor);
      for (const point of hand.keypoints) {
        if (isFinitePoint(point)) rect(point.x - 3, point.y - 3, 6, 6);
      }
    }

    if (activeFinger && activeProcessKey) {
      const c = processColors[activeProcessKey];
      noFill();
      stroke(c[0], c[1], c[2]);
      strokeWeight(4);
      circle(activeFinger.point.x, activeFinger.point.y, 34 + sin(frameCount * 0.15) * 8);
    }

    if (HandTracker.isValidHand(leftHand)) {
      const openness = GestureDetector.getFingerOpenness(leftHand);
      for (const key of ["thumb", "index"]) {
        if (openness[key] > 0.45) {
          const point = leftHand.keypoints[fingerTips[key]];
          if (isFinitePoint(point)) {
            fill(255, 255, 255, 180);
            rect(point.x - 5, point.y - 5, 10, 10);
          }
        }
      }
    }
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
