let video;
let handPose;
let hands = [];
let audioReady = false;
let activeLayerKey = null;
let previousActiveLayerKey = null;
let leftThumbWasOpen = false;

let master;
let masterFilter;
let reverb;
let delay;
let crusher;
let distortion;
let droneSubOsc;
let droneSubGain;
let highSignalOsc;
let highSignalGain;
let clickOsc;
let clickGain;
let noiseBurst;
let noiseFilter;
let staticFilter;
let staticGain;
let errorOsc;
let errorGain;
let noise;
let noiseGain;
let loops = {};

const canvasW = 960;
const canvasH = 620;
const stillThreshold = 3.2;
const stillSaveTime = 2000;
const parameterLoopLength = 4000;
const parameterRecordInterval = 60;
const pentatonic = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24];
const subFrequencies = [31, 37, 43, 53, 61, 79];
const machineFrequencies = [731, 947, 1129, 1471, 1999, 2879, 4093, 6151, 7901];
const layerOrder = ["thumb", "index", "middle", "ring", "pinky"];

const fingerTips = { thumb: 4, index: 8, middle: 12, ring: 16, pinky: 20 };
const fingerJoints = { thumb: 2, index: 6, middle: 10, ring: 14, pinky: 18 };

const layerNames = {
  thumb: "Drone / Foundation",
  index: "Melody / Voice",
  middle: "Rhythm / Pulse",
  ring: "Space / Atmosphere",
  pinky: "Chaos / Transformation",
};

const layerShortNames = {
  thumb: "DRONE",
  index: "MELODY",
  middle: "RHYTHM",
  ring: "SPACE",
  pinky: "CHAOS",
};

const layerColors = {
  thumb: [120, 255, 0],
  index: [255, 42, 185],
  middle: [35, 80, 255],
  ring: [165, 70, 255],
  pinky: [255, 225, 0],
};

const connections = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17],
];

let layers = {};
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

  video = createCapture(VIDEO);
  video.size(canvasW, canvasH);
  video.hide();

  handPose.detectStart(video, (results) => {
    hands = results.slice(0, 2);
  });

  setupLayers();
  setupTone();
}

function setupLayers() {
  for (const key of layerOrder) {
    layers[key] = {
      key,
      name: layerNames[key],
      saved: false,
      playing: false,
      stillSince: null,
      lastTip: null,
      saveFlash: 0,
      params: {
        pitch: 0.35,
        intensity: 0.25,
        modulation: 0.25,
        space: 0.2,
        chaos: 0.08,
      },
      target: {
        pitch: 0.35,
        intensity: 0.25,
        modulation: 0.25,
        space: 0.2,
        chaos: 0.08,
      },
      savedParams: null,
      recording: [],
      savedPattern: null,
      savedAt: 0,
      lastRecordTime: 0,
    };
  }
}

function setupTone() {
  master = new Tone.Gain(0.62).toDestination();
  masterFilter = new Tone.Filter(9000, "highpass").connect(master);
  reverb = new Tone.Reverb({ decay: 1.6, wet: 0.08 }).connect(master);
  delay = new Tone.FeedbackDelay("32n", 0.18).connect(reverb);
  distortion = new Tone.Distortion(0.18).connect(delay);
  crusher = new Tone.BitCrusher(6).connect(distortion);

  droneSubGain = new Tone.Gain(0).connect(master);
  droneSubOsc = new Tone.Oscillator({ type: "square", frequency: 43 }).connect(droneSubGain);

  highSignalGain = new Tone.Gain(0).connect(delay);
  highSignalOsc = new Tone.Oscillator({ type: "square", frequency: 4093 }).connect(highSignalGain);

  clickGain = new Tone.Gain(0).connect(master);
  clickOsc = new Tone.Oscillator({ type: "square", frequency: 1200 }).connect(clickGain);

  noiseBurst = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.035, sustain: 0, release: 0.02 },
  });
  noiseFilter = new Tone.Filter(8000, "highpass").connect(delay);
  noiseBurst.connect(noiseFilter);

  errorGain = new Tone.Gain(0).connect(crusher);
  errorOsc = new Tone.Oscillator({ type: "sawtooth", frequency: 2300 }).connect(errorGain);

  noise = new Tone.Noise("white");
  staticFilter = new Tone.Filter(8000, "highpass");
  staticGain = new Tone.Gain(0).connect(delay);
  noiseGain = new Tone.Gain(0).connect(crusher);
  noise.connect(staticFilter);
  staticFilter.connect(staticGain);
  staticFilter.connect(noiseGain);

  loops.thumb = new Tone.Loop((time) => playDrone(time), "8n");
  loops.index = new Tone.Loop((time) => playMelody(time), "16n");
  loops.middle = new Tone.Loop((time) => playRhythm(time), "32n");
  loops.ring = new Tone.Loop((time) => playSpace(time), "16n");
  loops.pinky = new Tone.Loop((time) => playChaos(time), "32n");
}

function draw() {
  drawAbstractBackground();

  const sorted = getSortedHands();
  const leftHand = getHandBySide(sorted, "Left", 0);
  const rightHand = getHandBySide(sorted, "Right", 1);
  const activeFinger = getActiveRightFinger(rightHand);

  activeLayerKey = activeFinger ? activeFinger.key : null;
  if (activeLayerKey !== previousActiveLayerKey) resetStillTracking();
  previousActiveLayerKey = activeLayerKey;

  updateLayerTargets(leftHand);
  updateLayerSmoothing();
  recordActiveLayerParams();
  updateFreezeLogic(activeFinger, leftHand);
  updateToneParameters();

  drawSavedBlocks();
  drawParticles();
  drawHands(sorted, activeFinger, leftHand);
  drawInterface(activeFinger);
}

async function startAudio() {
  if (audioReady) return;
  await Tone.start();
  await Tone.loaded();
  droneSubOsc.start();
  highSignalOsc.start();
  clickOsc.start();
  errorOsc.start();
  noise.start();
  Tone.Transport.bpm.value = 96;
  Tone.Transport.start();
  for (const key of layerOrder) loops[key].start(0);
  audioReady = true;
}

function mousePressed() {
  startAudio();
}

function touchStarted() {
  startAudio();
  return false;
}

function keyPressed() {
  startAudio();
  if (key === "s" || key === "S") saveActiveLayer();
}

function updateLayerTargets(leftHand) {
  if (!activeLayerKey || !isValidHand(leftHand)) return;

  const layer = layers[activeLayerKey];
  const openness = getFingerOpenness(leftHand);
  const palm = getPalmCenter(leftHand);
  const basePitch = constrain(map(palm.y, height * 0.85, height * 0.12, 0, 1), 0, 1);

  layer.target.pitch = lerp(layer.target.pitch, basePitch, 0.12);
  layer.target.intensity = lerp(layer.target.intensity, openness.index, 0.18);
  layer.target.modulation = lerp(layer.target.modulation, openness.middle, 0.18);
  layer.target.space = lerp(layer.target.space, openness.ring, 0.18);
  layer.target.chaos = lerp(layer.target.chaos, openness.pinky, 0.18);

  createLeftHandParticles(leftHand, openness);
}

function updateLayerSmoothing() {
  for (const key of layerOrder) {
    const layer = layers[key];
    for (const param of Object.keys(layer.params)) {
      layer.params[param] = lerp(layer.params[param], layer.target[param], 0.08);
    }
    layer.saveFlash *= 0.9;
  }
}

function recordActiveLayerParams() {
  if (!activeLayerKey) return;

  const layer = layers[activeLayerKey];
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
  if (!activeLayerKey || !activeFinger) return;

  const layer = layers[activeLayerKey];
  const tip = activeFinger.point;

  if (!layer.lastTip) {
    layer.lastTip = { x: tip.x, y: tip.y };
    layer.stillSince = millis();
    return;
  }

  const movement = dist(tip.x, tip.y, layer.lastTip.x, layer.lastTip.y);
  if (movement < stillThreshold) {
    if (layer.stillSince === null) layer.stillSince = millis();
    if (millis() - layer.stillSince > stillSaveTime && !layer.saved) saveLayer(activeLayerKey);
  } else {
    layer.stillSince = millis();
  }

  layer.lastTip = lerpPoint(layer.lastTip, tip, 0.3);

  const leftThumbOpen = isValidHand(leftHand) && getFingerOpenAmount(leftHand, "thumb") > 0.58;
  if (leftThumbOpen && !leftThumbWasOpen) saveActiveLayer();
  leftThumbWasOpen = leftThumbOpen;
}

function saveActiveLayer() {
  if (!activeLayerKey) return;
  saveLayer(activeLayerKey);
}

function saveLayer(key) {
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
  layer.savedAt = now;
  layer.saveFlash = 1;
  createSavedBlock(key, layer.savedParams);
}

function updateToneParameters() {
  if (!audioReady) return;

  const space = getPlaybackParams("ring");
  const chaos = getPlaybackParams("pinky");
  const drone = getPlaybackParams("thumb");

  const wet = space ? map(space.space + space.intensity, 0, 2, 0.02, 0.42) : 0.05;
  const feedback = space ? map(space.modulation, 0, 1, 0.04, 0.45) : 0.14;
  const crush = chaos ? floor(map(chaos.chaos, 0, 1, 8, 2)) : 8;
  const damage = chaos ? map(chaos.intensity + chaos.chaos, 0, 2, 0.02, 0.75) : 0.12;
  const cutoff = drone ? map(drone.intensity + drone.pitch, 0, 2, 11000, 1800) : 9000;

  reverb.wet.rampTo(wet, 0.12);
  delay.feedback.rampTo(feedback, 0.12);
  crusher.bits = crush;
  distortion.distortion = damage;
  masterFilter.frequency.rampTo(cutoff, 0.12);
  staticGain.gain.rampTo(space ? map(space.intensity + space.space, 0, 2, 0.002, 0.055) : 0, 0.12);
  noiseGain.gain.rampTo(chaos ? map(chaos.chaos, 0, 1, 0.003, 0.14) : 0, 0.08);
}

function getPlaybackParams(key) {
  const layer = layers[key];
  if (activeLayerKey === key) return layer.params;
  if (layer.saved && layer.savedPattern) return getPatternParams(layer);
  if (layer.saved && layer.savedParams) return layer.savedParams;
  return null;
}

function getPatternParams(layer) {
  if (!layer.savedPattern || !layer.savedPattern.length) return layer.savedParams;

  const loopPosition = (millis() - layer.savedAt) % parameterLoopLength;
  let current = layer.savedPattern[0];

  for (let i = 1; i < layer.savedPattern.length; i++) {
    if (layer.savedPattern[i].t > loopPosition) break;
    current = layer.savedPattern[i];
  }

  return current.params;
}

function playDrone(time) {
  const p = getPlaybackParams("thumb");
  if (!p) return;
  if (random() > map(p.intensity, 0, 1, 0.18, 0.82)) return;

  const sub = random(subFrequencies);
  const high = random(machineFrequencies);
  const subVelocity = map(p.intensity, 0, 1, 0.06, 0.32);
  const highVelocity = map(p.chaos + p.modulation, 0, 2, 0.015, 0.14);

  triggerGate(droneSubOsc, droneSubGain, sub, random([0.025, 0.05, 0.09]), time, subVelocity);
  if (random() < 0.2 + p.modulation * 0.45) {
    triggerGate(highSignalOsc, highSignalGain, high, 0.018, time + random(0, 0.03), highVelocity);
  }
  loops.thumb.interval = random() < p.chaos ? "16n" : random(["8n", "4n"]);
}

function playMelody(time) {
  const p = getPlaybackParams("index");
  if (!p) return;
  if (random() > map(p.intensity, 0, 1, 0.08, 0.9)) return;

  const note = random(machineFrequencies);
  const velocity = map(p.intensity, 0, 1, 0.05, 0.34);
  triggerGate(highSignalOsc, highSignalGain, note, random([0.012, 0.02, 0.035]), time, velocity);
  if (random() < p.modulation * 0.5) {
    triggerGate(highSignalOsc, highSignalGain, random(machineFrequencies), 0.012, time + 0.025, velocity * 0.7);
  }
  loops.index.interval = random() < p.chaos ? "64n" : random(["32n", "16n", "8n"]);
}

function triggerGate(oscillator, gainNode, frequency, duration, time, velocity) {
  oscillator.frequency.setValueAtTime(frequency, time);
  gainNode.gain.cancelScheduledValues(time);
  gainNode.gain.setValueAtTime(0, time);
  gainNode.gain.linearRampToValueAtTime(velocity, time + 0.001);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  gainNode.gain.setValueAtTime(0, time + duration + 0.005);
}

function playRhythm(time) {
  const p = getPlaybackParams("middle");
  if (!p) return;
  if (random() > map(p.intensity, 0, 1, 0.18, 0.98)) return;

  const trains = random() < p.modulation ? floor(random(2, 7)) : 1;
  for (let i = 0; i < trains; i++) {
    const offset = i * random(0.012, 0.038);
    triggerGate(clickOsc, clickGain, random(machineFrequencies), random([0.004, 0.007, 0.011]), time + offset, map(p.intensity, 0, 1, 0.04, 0.34));
  }
  loops.middle.interval = random() < p.chaos ? "64n" : random(["32n", "16n"]);
}

function playSpace(time) {
  const p = getPlaybackParams("ring");
  if (!p) return;
  staticFilter.frequency.rampTo(map(p.pitch + p.space, 0, 2, 12000, 1600), 0.08);
  if (random() < map(p.intensity, 0, 1, 0.05, 0.55)) {
    noiseBurst.triggerAttackRelease(random(["64n", "32n", "16n"]), time, map(p.intensity, 0, 1, 0.02, 0.18));
  }
  loops.ring.interval = random(["16n", "8n", "4n"]);
}

function playChaos(time) {
  const p = getPlaybackParams("pinky");
  if (!p) return;
  if (random() > map(p.intensity + p.chaos, 0, 2, 0.06, 0.92)) return;

  triggerGate(errorOsc, errorGain, random(machineFrequencies) * random(0.25, 2.5), random([0.006, 0.014, 0.028]), time, map(p.intensity + p.chaos, 0, 2, 0.04, 0.48));
  if (random() < p.chaos) {
    noiseBurst.triggerAttackRelease("128n", time + random(0, 0.04), map(p.chaos, 0, 1, 0.03, 0.22));
  }
  loops.pinky.interval = random(["64n", "32n", "16n"]);
}

function drawAbstractBackground() {
  background(235, 22, 28);
  noStroke();
  for (let x = 0; x < width; x += 28) {
    for (let y = 0; y < height; y += 28) {
      fill((x + y + frameCount) % 84 === 0 ? color(20, 40, 180, 80) : color(255, 30, 150, 24));
      rect(x, y, 10, 10);
    }
  }
  stroke(120, 255, 0, 55);
  strokeWeight(1);
  for (let x = 0; x < width; x += 42) line(x, 0, x, height);
  for (let y = 0; y < height; y += 42) line(0, y, width, y);
  noStroke();
  for (let i = 0; i < 90; i++) {
    fill(i % 3 === 0 ? color(0, 35, 210, 110) : color(255, 245, 0, 90));
    rect((i * 83 + frameCount * 0.8) % width, (i * 47 + sin(frameCount * 0.02 + i) * 40 + height) % height, 4, 4);
  }
}

function drawHands(sortedHands, activeFinger, leftHand) {
  for (const hand of sortedHands) {
    const isRight = hand === getHandBySide(sortedHands, "Right", 1);
    const baseColor = isRight ? color(255, 42, 185) : color(120, 255, 0);
    stroke(red(baseColor), green(baseColor), blue(baseColor), 125);
    strokeWeight(2);
    for (const pair of connections) {
      const a = hand.keypoints[pair[0]];
      const b = hand.keypoints[pair[1]];
      line(a.x, a.y, b.x, b.y);
    }
    noStroke();
    fill(baseColor);
    for (const point of hand.keypoints) rect(point.x - 3, point.y - 3, 6, 6);
  }

  if (activeFinger) {
    const c = layerColors[activeFinger.key];
    noFill();
    stroke(c[0], c[1], c[2]);
    strokeWeight(4);
    circle(activeFinger.point.x, activeFinger.point.y, 34 + sin(frameCount * 0.15) * 8);
  }

  if (isValidHand(leftHand)) {
    const openness = getFingerOpenness(leftHand);
    for (const key of layerOrder) {
      if (openness[key] > 0.45) {
        const p = leftHand.keypoints[fingerTips[key]];
        fill(255, 255, 255, 180);
        rect(p.x - 5, p.y - 5, 10, 10);
      }
    }
  }
}

function createLeftHandParticles(leftHand, openness) {
  for (const key of layerOrder) {
    if (key === "thumb") continue;
    if (openness[key] > 0.45 && frameCount % 3 === 0) {
      const p = leftHand.keypoints[fingerTips[key]];
      particles.push({ x: p.x, y: p.y, vx: random(-1.4, 1.4), vy: random(-1.4, 1.4), life: 32, color: layerColors[activeLayerKey] || [255, 255, 255] });
    }
  }
}

function drawParticles() {
  noStroke();
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    fill(p.color[0], p.color[1], p.color[2], map(p.life, 0, 32, 0, 220));
    rect(p.x, p.y, 5, 5);
    p.x += p.vx;
    p.y += p.vy;
    p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function createSavedBlock(key, params) {
  const c = layerColors[key];
  const originX = 80 + savedBlocks.length * 124;
  const originY = height - 110;
  const cells = [];
  for (let i = 0; i < 36; i++) cells.push({ x: (i % 6) * 13, y: floor(i / 6) * 13, on: random() < 0.35 + params.intensity * 0.45 });
  savedBlocks.push({ key, x: originX % (width - 120), y: originY, color: c, cells });
}

function drawSavedBlocks() {
  for (const block of savedBlocks) {
    fill(block.color[0], block.color[1], block.color[2], 50);
    rect(block.x - 8, block.y - 8, 94, 94);
    for (const cell of block.cells) {
      fill(block.color[0], block.color[1], block.color[2], cell.on ? 225 : 55);
      rect(block.x + cell.x, block.y + cell.y, 9, 9);
    }
    fill(255);
    textSize(10);
    text(layerShortNames[block.key], block.x, block.y + 84);
  }
}

function drawInterface(activeFinger) {
  noStroke();
  fill(0, 120);
  rect(18, 18, 330, 160);
  fill(255);
  textSize(15);
  text("ACTIVE LAYER", 34, 34);
  textSize(22);
  text(activeLayerKey ? layerNames[activeLayerKey] : "show one right finger", 34, 58);
  textSize(13);
  text(audioReady ? "Tone audio active" : "click/touch once to start Tone", 34, 92);
  text(getLayerStatus(activeFinger), 34, 114);
  text("left hand: thumb save | index intensity | middle speed", 34, 138);
  text("ring space | pinky chaos", 34, 156);

  const startX = width - 310;
  const startY = 26;
  fill(0, 125);
  rect(startX - 18, startY - 8, 292, 186);
  fill(255);
  textSize(14);
  text("SAVED LAYERS", startX, startY);
  for (let i = 0; i < layerOrder.length; i++) {
    const key = layerOrder[i];
    const layer = layers[key];
    const c = layerColors[key];
    const y = startY + 28 + i * 28;
    fill(c[0], c[1], c[2], layer.saved ? 230 : 60);
    rect(startX, y, 18, 18);
    fill(255);
    textSize(12);
    text(layerNames[key] + (layer.saved ? " / pattern loop" : " / empty"), startX + 28, y + 2);
  }
  if (activeLayerKey) drawParamBars(layers[activeLayerKey].params, 34, 205);
}

function drawParamBars(params, x, y) {
  const labels = ["pitch", "intensity", "modulation", "space", "chaos"];
  fill(0, 120);
  rect(x - 16, y - 14, 250, 150);
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    fill(255);
    textSize(11);
    text(label, x, y + i * 25);
    fill(25, 20, 90);
    rect(x + 86, y + i * 25 - 3, 120, 8);
    const c = layerColors[activeLayerKey];
    fill(c[0], c[1], c[2]);
    rect(x + 86, y + i * 25 - 3, 120 * params[label], 8);
  }
}

function getLayerStatus(activeFinger) {
  if (!activeLayerKey) return "status: waiting";
  const layer = layers[activeLayerKey];
  const progress = layer.stillSince ? constrain((millis() - layer.stillSince) / stillSaveTime, 0, 1) : 0;
  if (layer.saved) return "status: saved/frozen and looping";
  if (!activeFinger) return "status: recording/modulating";
  return "status: hold still to save " + nf(progress * 100, 2, 0) + "%";
}

function getActiveRightFinger(hand) {
  if (!isValidHand(hand)) return null;
  const openness = getFingerOpenness(hand);
  let bestKey = null;
  let bestAmount = 0.58;
  for (const key of layerOrder) {
    if (openness[key] > bestAmount) {
      bestAmount = openness[key];
      bestKey = key;
    }
  }
  if (!bestKey) return null;
  return { key: bestKey, point: hand.keypoints[fingerTips[bestKey]] };
}

function getFingerOpenness(hand) {
  const openness = {};
  for (const key of layerOrder) openness[key] = getFingerOpenAmount(hand, key);
  return openness;
}

function getFingerOpenAmount(hand, key) {
  if (!isValidHand(hand)) return 0;
  const wrist = hand.keypoints[0];
  const tip = hand.keypoints[fingerTips[key]];
  const joint = hand.keypoints[fingerJoints[key]];
  return constrain(map(dist(tip.x, tip.y, wrist.x, wrist.y) - dist(joint.x, joint.y, wrist.x, wrist.y), -10, 55, 0, 1), 0, 1);
}

function getSortedHands() {
  return hands.slice().filter(isValidHand).sort((a, b) => getHandCenterX(a) - getHandCenterX(b));
}

function getHandBySide(sortedHands, label, fallbackIndex) {
  const hasLabels = sortedHands.some((hand) => hand.handedness);
  for (const hand of sortedHands) if (hand.handedness === label) return hand;
  if (hasLabels) return null;
  return sortedHands[fallbackIndex] || null;
}

function isValidHand(hand) {
  if (!hand || !hand.keypoints || hand.keypoints.length < 21) return false;
  for (let i = 0; i < 21; i++) {
    const point = hand.keypoints[i];
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
  }
  return true;
}

function getHandCenterX(hand) {
  let total = 0;
  for (const point of hand.keypoints) total += point.x;
  return total / hand.keypoints.length;
}

function getPalmCenter(hand) {
  return {
    x: (hand.keypoints[0].x + hand.keypoints[5].x + hand.keypoints[17].x) / 3,
    y: (hand.keypoints[0].y + hand.keypoints[5].y + hand.keypoints[17].y) / 3,
  };
}

function getScaleFrequency(position, rootMidi, span) {
  const index = floor(constrain(position, 0, 0.999) * pentatonic.length);
  const octave = floor(constrain(position, 0, 0.999) * span) * 12;
  return Tone.Frequency(rootMidi + pentatonic[index] + octave, "midi").toFrequency();
}

function getTotalSavedIntensity() {
  let total = 0;
  for (const key of layerOrder) if (layers[key].saved && layers[key].savedParams) total += layers[key].savedParams.intensity;
  return total;
}

function lerpPoint(a, b, amount) {
  return { x: lerp(a.x, b.x, amount), y: lerp(a.y, b.y, amount) };
}

function resetStillTracking() {
  for (const key of layerOrder) {
    layers[key].stillSince = null;
    layers[key].lastTip = null;
  }
}
