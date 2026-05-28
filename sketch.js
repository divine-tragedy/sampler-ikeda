let video;
let handPose;
let hands = [];
let audioReady = false;
let activeLayerKey = null;
let previousActiveLayerKey = null;
let leftThumbWasOpen = false;

let master;
let reverb;
let delay;
let crusher;
let distortion;
let ambientEngine;
let blipEngine;
let rhythmEngine;
let atmosphereEngine;
let chaosEngine;
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
  thumb: "Right Thumb / Tonal Field",
  index: "Right Index / Signals",
  middle: "Right Middle / Rhythmic Structures",
  ring: "Right Ring / Texture Clouds",
  pinky: "Right Pinky / Mutation",
};

const layerShortNames = {
  thumb: "TONAL",
  index: "SIGNAL",
  middle: "TIME",
  ring: "CLOUD",
  pinky: "MUTATE",
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
let visualState = {
  colorMix: 0,
  pixelNoise: 0.15,
  scatter: 0.1,
  brokenGrid: 0.08,
  flicker: 0.05,
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
  reverb = new Tone.Reverb({ decay: 3.2, wet: 0.12 }).connect(master);
  delay = new Tone.FeedbackDelay("32n", 0.18).connect(reverb);
  distortion = new Tone.Distortion(0.18).connect(delay);
  crusher = new Tone.BitCrusher(6).connect(distortion);

  ambientEngine = createAmbientEngine();
  blipEngine = createBlipEngine();
  rhythmEngine = createRhythmEngine();
  atmosphereEngine = createAtmosphereEngine();
  chaosEngine = createChaosEngine();

  loops.thumb = new Tone.Loop((time) => playAmbient(time), "8n");
  loops.index = new Tone.Loop((time) => playBlips(time), "16n");
  loops.middle = new Tone.Loop((time) => playRhythm(time), "32n");
  loops.ring = new Tone.Loop((time) => playAtmosphere(time), "16n");
  loops.pinky = new Tone.Loop((time) => playChaos(time), "32n");
}

function createAmbientEngine() {
  const chordFilter = new Tone.Filter(950, "lowpass").connect(reverb);
  const chordGain = new Tone.Gain(0).connect(chordFilter);
  const chordOscs = [
    new Tone.Oscillator({ type: "triangle", frequency: 110 }).connect(chordGain),
    new Tone.Oscillator({ type: "triangle", frequency: 137.5 }).connect(chordGain),
    new Tone.Oscillator({ type: "sine", frequency: 165 }).connect(chordGain),
  ];
  const pulseFilter = new Tone.Filter(95, "lowpass").connect(reverb);
  const pulseGain = new Tone.Gain(0).connect(pulseFilter);
  const pulse = new Tone.Oscillator({ type: "triangle", frequency: 37 }).connect(pulseGain);
  const dustGain = new Tone.Gain(0).connect(reverb);
  const dustFilter = new Tone.Filter(1900, "bandpass").connect(dustGain);
  const dust = new Tone.Noise("pink").connect(dustFilter);
  return { chordOscs, chordGain, chordFilter, pulse, pulseGain, pulseFilter, dust, dustGain, dustFilter };
}

function createBlipEngine() {
  const gain = new Tone.Gain(0).connect(crusher);
  const clickGain = new Tone.Gain(0).connect(master);
  const blip = new Tone.Oscillator({ type: "square", frequency: 4093 }).connect(gain);
  const click = new Tone.Oscillator({ type: "square", frequency: 6200 }).connect(clickGain);
  return { blip, click, gain, clickGain };
}

function createRhythmEngine() {
  const clickGain = new Tone.Gain(0).connect(master);
  const pulseGain = new Tone.Gain(0).connect(delay);
  const click = new Tone.Oscillator({ type: "square", frequency: 1800 }).connect(clickGain);
  const pulse = new Tone.Oscillator({ type: "triangle", frequency: 55 }).connect(pulseGain);
  return { click, pulse, clickGain, pulseGain };
}

function createAtmosphereEngine() {
  const panner = new Tone.Panner(0).connect(reverb);
  const gain = new Tone.Gain(0).connect(panner);
  const filter = new Tone.Filter(7200, "highpass").connect(gain);
  const noise = new Tone.Noise("white").connect(filter);
  const burst = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.045, sustain: 0, release: 0.02 },
  }).connect(delay);
  return { noise, filter, gain, panner, burst };
}

function createChaosEngine() {
  const gain = new Tone.Gain(0).connect(crusher);
  const error = new Tone.Oscillator({ type: "sawtooth", frequency: 2300 }).connect(gain);
  const burst = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.025, sustain: 0, release: 0.006 },
  }).connect(crusher);
  return { error, gain, burst };
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
  updateVisualState();

  drawSavedBlocks();
  drawParticles();
  drawHands(sorted, activeFinger, leftHand);
  drawInterface(activeFinger);
}

async function startAudio() {
  if (audioReady) return;
  await Tone.start();
  await Tone.loaded();
  for (const osc of ambientEngine.chordOscs) osc.start();
  ambientEngine.pulse.start();
  ambientEngine.dust.start();
  blipEngine.blip.start();
  blipEngine.click.start();
  rhythmEngine.click.start();
  rhythmEngine.pulse.start();
  atmosphereEngine.noise.start();
  chaosEngine.error.start();
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

  const ambient = getPlaybackParams("thumb");
  const blips = getPlaybackParams("index");
  const rhythm = getPlaybackParams("middle");
  const atmosphere = getPlaybackParams("ring");
  const chaos = getPlaybackParams("pinky");

  const wet = Math.max(
    ambient ? map(ambient.space, 0, 1, 0.08, 0.55) : 0.04,
    atmosphere ? map(atmosphere.space + atmosphere.intensity, 0, 2, 0.1, 0.82) : 0.04
  );
  const feedback = Math.max(
    blips ? map(blips.space, 0, 1, 0.06, 0.42) : 0.08,
    rhythm ? map(rhythm.space, 0, 1, 0.04, 0.32) : 0.08,
    chaos ? map(chaos.space, 0, 1, 0.08, 0.62) : 0.08
  );
  const crush = chaos ? floor(map(chaos.chaos, 0, 1, 8, 2)) : 8;
  const damage = chaos ? map(chaos.intensity + chaos.chaos, 0, 2, 0.02, 0.75) : 0.12;

  reverb.wet.rampTo(wet, 0.12);
  delay.feedback.rampTo(feedback, 0.12);
  crusher.bits = crush;
  distortion.distortion = damage;

  updateAmbientEngine(ambient);
  updateAtmosphereEngine(atmosphere);
  chaosEngine.gain.gain.rampTo(chaos ? map(chaos.intensity + chaos.chaos, 0, 2, 0.001, 0.18) : 0, 0.08);
}

function updateAmbientEngine(p) {
  if (!p) {
    ambientEngine.chordGain.gain.rampTo(0, 0.45);
    ambientEngine.pulseGain.gain.rampTo(0, 0.08);
    ambientEngine.dustGain.gain.rampTo(0, 0.2);
    return;
  }

  const root = 38 + floor(constrain(p.pitch, 0, 0.999) * 18);
  const chordIntervals = p.chaos > 0.55 ? [0, 3, 10] : [0, 7, 15];
  const spread = map(p.chaos, 0, 1, 0.08, 5.5);
  for (let i = 0; i < ambientEngine.chordOscs.length; i++) {
    const drift = sin(frameCount * map(p.modulation, 0, 1, 0.004, 0.035) + i * 1.7) * spread;
    const freq = Tone.Frequency(root + chordIntervals[i], "midi").toFrequency() + drift;
    ambientEngine.chordOscs[i].frequency.rampTo(freq, 0.35);
  }
  ambientEngine.chordGain.gain.rampTo(map(p.intensity, 0, 1, 0.0, 0.105), 0.5);
  ambientEngine.chordFilter.frequency.rampTo(map(p.intensity + p.space, 0, 2, 260, 2400), 0.45);
  ambientEngine.pulseGain.gain.rampTo(0, 0.08);
  ambientEngine.dustGain.gain.rampTo(map(p.chaos, 0, 1, 0.001, 0.03), 0.2);
  ambientEngine.dustFilter.frequency.rampTo(map(p.modulation + p.space, 0, 2, 600, 4800), 0.22);
  ambientEngine.pulseFilter.frequency.rampTo(map(p.pitch + p.intensity, 0, 2, 55, 180), 0.18);
}

function updateAtmosphereEngine(p) {
  if (!p) {
    atmosphereEngine.gain.gain.rampTo(0, 0.2);
    return;
  }

  atmosphereEngine.gain.gain.rampTo(map(p.intensity, 0, 1, 0.002, 0.075), 0.15);
  atmosphereEngine.filter.frequency.rampTo(map(p.pitch + p.space, 0, 2, 10500, 1500), 0.15);
  atmosphereEngine.panner.pan.rampTo(sin(frameCount * map(p.modulation, 0, 1, 0.005, 0.07)) * map(p.space, 0, 1, 0.1, 0.95), 0.08);
}

function updateVisualState() {
  const thumb = getPlaybackParams("thumb");
  const index = getPlaybackParams("index");
  const colorTarget = thumb ? constrain(thumb.pitch + thumb.modulation * 0.45, 0, 1) : 0;
  const pixelTarget = index ? constrain(index.intensity * 0.75 + index.chaos * 0.35, 0, 1) : 0.12;
  const scatterTarget = index ? constrain(index.chaos * 0.8 + index.modulation * 0.25, 0, 1) : 0.08;
  const gridTarget = index ? constrain(index.space * 0.5 + index.chaos * 0.6, 0, 1) : 0.06;
  const flickerTarget = index ? constrain(index.modulation * 0.45 + index.chaos * 0.55, 0, 1) : 0.04;

  visualState.colorMix = lerp(visualState.colorMix, colorTarget, 0.08);
  visualState.pixelNoise = lerp(visualState.pixelNoise, pixelTarget, 0.08);
  visualState.scatter = lerp(visualState.scatter, scatterTarget, 0.08);
  visualState.brokenGrid = lerp(visualState.brokenGrid, gridTarget, 0.08);
  visualState.flicker = lerp(visualState.flicker, flickerTarget, 0.08);
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

function playAmbient(time) {
  const p = getPlaybackParams("thumb");
  if (!p) return;

  if (random() < map(p.intensity, 0, 1, 0.08, 0.38)) {
    triggerGate(ambientEngine.pulse, ambientEngine.pulseGain, random(subFrequencies), random([0.018, 0.035, 0.065]), time, map(p.intensity, 0, 1, 0.015, 0.12));
  }
  if (random() < 0.05 + p.chaos * 0.32) {
    const high = random(machineFrequencies) * random([0.5, 1, 2]);
    triggerGate(blipEngine.click, blipEngine.clickGain, high, random([0.002, 0.004, 0.007]), time + random(0, 0.08), map(p.chaos, 0, 1, 0.006, 0.05));
  }
  loops.thumb.interval = random() < p.modulation ? "8n" : "4n";
}

function playBlips(time) {
  const p = getPlaybackParams("index");
  if (!p) return;
  if (random() > map(p.intensity, 0, 1, 0.05, 0.94)) return;

  const repeats = random() < p.modulation ? floor(random(2, 6)) : 1;
  const velocity = map(p.intensity, 0, 1, 0.025, 0.25);
  for (let i = 0; i < repeats; i++) {
    const offset = i * random(0.009, 0.032);
    const pitchJump = random() < p.chaos ? random([0.5, 1, 1.5, 2, 3]) : 1;
    triggerGate(blipEngine.blip, blipEngine.gain, random(machineFrequencies) * pitchJump, random([0.002, 0.004, 0.007, 0.011]), time + offset, velocity);
    if (random() < 0.2 + p.intensity * 0.25) {
      triggerGate(blipEngine.click, blipEngine.clickGain, random(machineFrequencies), 0.002, time + offset + 0.002, velocity * 0.6);
    }
  }
  loops.index.interval = random() < p.chaos ? "64n" : random(["32n", "16n"]);
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

  const trains = random() < p.modulation ? floor(random(2, 9)) : 1;
  for (let i = 0; i < trains; i++) {
    if (random() < p.chaos * 0.35) continue;
    const offset = i * random(0.008, 0.032);
    triggerGate(rhythmEngine.click, rhythmEngine.clickGain, random(machineFrequencies), random([0.003, 0.005, 0.009]), time + offset, map(p.intensity, 0, 1, 0.035, 0.28));
    if (i === 0 || random() < 0.25) {
      triggerGate(rhythmEngine.pulse, rhythmEngine.pulseGain, random(subFrequencies), random([0.018, 0.032, 0.055]), time + offset, map(p.intensity, 0, 1, 0.025, 0.18));
    }
  }
  loops.middle.interval = random() < p.chaos ? "64n" : random(["32n", "16n"]);
}

function playAtmosphere(time) {
  const p = getPlaybackParams("ring");
  if (!p) return;
  if (random() < map(p.intensity + p.chaos, 0, 2, 0.04, 0.7)) {
    atmosphereEngine.burst.triggerAttackRelease(random(["128n", "64n", "32n", "16n"]), time + random(0, 0.035), map(p.intensity, 0, 1, 0.01, 0.16));
  }
  loops.ring.interval = random() < p.modulation ? random(["32n", "16n"]) : random(["8n", "4n"]);
}

function playChaos(time) {
  const p = getPlaybackParams("pinky");
  if (!p) return;
  if (random() > map(p.intensity + p.chaos, 0, 2, 0.06, 0.92)) return;

  triggerGate(chaosEngine.error, chaosEngine.gain, random(machineFrequencies) * random(0.2, 3.5), random([0.004, 0.009, 0.018, 0.032]), time, map(p.intensity + p.chaos, 0, 2, 0.025, 0.42));
  if (random() < p.chaos) {
    chaosEngine.burst.triggerAttackRelease(random(["256n", "128n", "64n"]), time + random(0, 0.04), map(p.chaos, 0, 1, 0.02, 0.2));
  }
  loops.pinky.interval = random(["64n", "32n", "16n"]);
}

function drawAbstractBackground() {
  const mainColor = getMainVisualColor();
  const flicker = random() < visualState.flicker * 0.25 ? random(-45, 45) : 0;

  background(
    constrain(red(mainColor) + flicker, 0, 255),
    constrain(green(mainColor) + flicker * 0.35, 0, 255),
    constrain(blue(mainColor) + flicker, 0, 255)
  );
  noStroke();

  const step = floor(map(visualState.pixelNoise, 0, 1, 34, 12));
  for (let x = 0; x < width; x += step) {
    for (let y = 0; y < height; y += step) {
      const broken = random() < visualState.brokenGrid * 0.18;
      const offsetX = broken ? random(-10, 10) : 0;
      const offsetY = broken ? random(-10, 10) : 0;
      fill((x + y + frameCount) % (step * 3) === 0 ? color(20, 40, 180, 80) : color(255, 30, 150, 24 + visualState.pixelNoise * 60));
      rect(x + offsetX, y + offsetY, max(3, step * 0.34), max(3, step * 0.34));
    }
  }

  stroke(120, 255, 0, 55 + visualState.brokenGrid * 100);
  strokeWeight(1);
  for (let x = 0; x < width; x += 42) {
    const shift = random() < visualState.brokenGrid * 0.45 ? random(-18, 18) : 0;
    line(x + shift, 0, x - shift, height);
  }
  for (let y = 0; y < height; y += 42) {
    const shift = random() < visualState.brokenGrid * 0.45 ? random(-18, 18) : 0;
    line(0, y + shift, width, y - shift);
  }

  noStroke();
  const scatterCount = floor(map(visualState.scatter + visualState.pixelNoise, 0, 2, 70, 360));
  for (let i = 0; i < scatterCount; i++) {
    const size = random([2, 3, 4, 6, 9]);
    const x = random(width);
    const y = random(height);
    fill(i % 3 === 0 ? color(0, 35, 210, 80 + visualState.scatter * 140) : color(255, 245, 0, 70 + visualState.pixelNoise * 120));
    rect(x, y, size, size);
  }

  if (random() < visualState.flicker * 0.55) {
    fill(255, 255, 255, 60 + visualState.flicker * 100);
    rect(0, random(height), width, random(2, 12));
  }
}

function getMainVisualColor() {
  const palette = [
    color(235, 22, 28),
    color(255, 42, 185),
    color(120, 255, 0),
    color(20, 40, 210),
  ];
  const scaled = visualState.colorMix * (palette.length - 1);
  const index = floor(scaled);
  const nextIndex = min(index + 1, palette.length - 1);
  return lerpColor(palette[index], palette[nextIndex], scaled - index);
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
  rect(18, 18, 430, 178);
  fill(255);
  textSize(15);
  text("ACTIVE LAYER", 34, 34);
  textSize(18);
  text(activeLayerKey ? layerNames[activeLayerKey] : "show one right finger", 34, 58);
  textSize(13);
  text(audioReady ? "Tone audio active" : "click/touch once to start Tone", 34, 92);
  text(getLayerStatus(activeFinger), 34, 114);
  text("left hand: thumb freeze | index intensity | middle movement", 34, 138);
  text("ring space | pinky complexity", 34, 156);
  text("right hand: thumb tonal | index signals | middle time", 34, 174);

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
    text(layerShortNames[key] + (layer.saved ? " / pattern loop" : " / empty"), startX + 28, y + 2);
  }
  if (activeLayerKey) drawParamBars(layers[activeLayerKey].params, 34, 205);
}

function drawParamBars(params, x, y) {
  const labels = ["tone", "intensity", "movement", "space", "complexity"];
  const paramsKeys = ["pitch", "intensity", "modulation", "space", "chaos"];
  fill(0, 120);
  rect(x - 16, y - 14, 250, 150);
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    const paramKey = paramsKeys[i];
    fill(255);
    textSize(11);
    text(label, x, y + i * 25);
    fill(25, 20, 90);
    rect(x + 86, y + i * 25 - 3, 120, 8);
    const c = layerColors[activeLayerKey];
    fill(c[0], c[1], c[2]);
    rect(x + 86, y + i * 25 - 3, 120 * params[paramKey], 8);
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
  let bestAmount = 0.56;
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
