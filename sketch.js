// Global state
let cnv;
let isPlaying = false;
let toneReady = false;
let bodyVideo;
let pose;
let poseRunning = false;
const scale = [
  "C4", "Eb4", "F4", "G4", "Bb4",
  "C5", "Eb5"
];
let bodyControls = {
  hasPose: false,
  density: 0.25,
  handDistance: 0.2,
  leftX: 0.5,
  leftY: 0.5,
  rightX: 0.5,
  rightY: 0.5,
  lastSeen: 0,
};
let currentNote = scale[0];
let currentNoteIndex = 0;
let currentVolume = -24;
let currentDensity = 0.25;
let pulseCounter = 0;

// Microphone
let recorder;
let mic;

const synth = new Tone.PolySynth(Tone.Synth, {
  oscillator: {
    type: "sine"
  },
  envelope: {
    attack: 1.5,
    decay: 0.3,
    sustain: 0.6,
    release: 3
  }
});
const reverb = new Tone.Reverb({
  decay: 6,
  wet: 0.6,
});
const fft = new Tone.FFT(64);
const meter = new Tone.Meter();
const loop = new Tone.Loop((time) => {
  playNote(time);
}, "4n");

function setup() {
  cnv = createCanvas(448 , 256);
  fullscreen(true);

  mic = new Tone.UserMedia();
  recorder = new Tone.Recorder();
  mic.connect(recorder);

  synth.connect(reverb);
  synth.connect(fft);
  synth.connect(meter);
  reverb.toDestination();

  setupBodyTracking();
}
async function startRecording() {
  await initializeTone();
  await mic.open();
  recorder.start();
  console.log("recording...");
}

async function stopRecording() {
  const recording = await recorder.stop();
  console.log("recording ready:", URL.createObjectURL(recording));
}

function draw() {
  drawBlueSignalCore();
  updateAudioParams();
}

function playNote(time) {
  pulseCounter++;
  const skipEvery = floor(map(currentDensity, 0, 1, 4, 1));
  if (pulseCounter % skipEvery !== 0) return;

  synth.triggerAttackRelease(currentNote, "2n", time);

  if (currentDensity > 0.72 && random() < currentDensity) {
    const harmonyIndex = min(currentNoteIndex + 2, scale.length - 1);
    synth.triggerAttackRelease(scale[harmonyIndex], "4n", time + 0.12);
  }
}

function drawNeonGlitchSpectrum() {
  background(0, 42);

  const spectrum = fft.getValue();
  const bass = getBandEnergy(spectrum, 0, 8);
  const mids = getBandEnergy(spectrum, 8, 34);
  const treble = getBandEnergy(spectrum, 34, spectrum.length);
  const volume = constrain(map(meter.getValue(), -60, -6, 0, 1), 0, 1);
  const pulse = isPlaying ? volume : 0.15 + sin(frameCount * 0.03) * 0.05;
  const glitch = pulse * 22 + random(-2, 2);

  noStroke();
  blendMode(ADD);

  // Solid cyan and blue low-end blocks.
  fill(0, 150 + bass * 105, 255, 170 + bass * 80);
  rect(0, 0, width * (0.12 + bass * 0.06), height);
  fill(0, 45, 200, 180);
  rect(width * 0.04 + sin(frameCount * 0.05) * glitch, 0, width * 0.1, height);

  // Mint/teal scanlines.
  for (let x = width * 0.18; x < width * 0.38; x += 4) {
    const h = height * (0.5 + bass * 0.5);
    const y = (height - h) / 2 + random(-glitch, glitch);
    fill(80, 255, 210, 65 + bass * 160);
    rect(x + random(-2, 2), y, 1 + bass * 3, h);
  }

  // Segmented purple and dark green mid-range blocks.
  for (let y = 0; y < height; y += 24) {
    const blockHeight = 8 + mids * 22 + noise(y, frameCount * 0.02) * 16;
    const shift = sin(frameCount * 0.04 + y * 0.08) * mids * 18;
    fill(95, 20, 150, 75 + mids * 125);
    rect(width * 0.42 + shift, y + 4, width * 0.16, blockHeight);
    fill(20, 95, 70, 55 + mids * 80);
    rect(width * 0.52 - shift * 0.4, y + 14, width * 0.1, blockHeight * 0.6);
  }

  // Hot magenta neon ribbon.
  const ribbonX = width * 0.68 + sin(frameCount * 0.06) * 8;
  for (let i = 0; i < 8; i++) {
    fill(255, 20 + i * 12, 190, 25 + volume * 55);
    rect(ribbonX - i * 3, 0, 8 + i * 5 + volume * 24, height);
  }
  fill(255, 30, 170, 200);
  rect(ribbonX + random(-glitch, glitch), 0, 10 + volume * 22, height);

  // High-frequency prism lines on the right.
  for (let x = width * 0.78; x < width; x += 3) {
    const hueShift = map(x, width * 0.78, width, 0, 1);
    const lineAlpha = 60 + treble * 180;
    fill(255, 220 - hueShift * 120, hueShift * 210, lineAlpha);
    rect(x + random(-treble * 10, treble * 10), 0, 1 + treble * 3, height);
  }

  // Sudden bright horizontal glitches during louder moments.
  if (random() < 0.03 + volume * 0.18) {
    fill(random(120, 255), random(40, 255), random(160, 255), 150);
    rect(0, random(height), width, random(1, 5));
  }

  blendMode(BLEND);
}

function drawBlueSignalCore() {
  const spectrum = fft.getValue();
  const bass = getBandEnergy(spectrum, 0, 10);
  const mids = getBandEnergy(spectrum, 10, 36);
  const treble = getBandEnergy(spectrum, 36, spectrum.length);
  const volume = constrain(map(meter.getValue(), -60, -6, 0, 1), 0, 1);
  const energy = isPlaying ? volume : 0.18 + sin(frameCount * 0.035) * 0.06;
  const cx = width * 0.5;
  const cy = height * 0.48;
  const coreSize = min(width, height) * (0.09 + energy * 0.11 + bass * 0.06);
  const spin = sin(frameCount * (0.01 + mids * 0.035)) * 0.16;

  background(2, 8, 16);

  noStroke();
  fill(3, 42, 78, 235);
  rect(width * 0.12, height * 0.06, width * 0.76, height * 0.82);

  fill(0, 20, 34, 105);
  rect(width * 0.12, height * 0.72, width * 0.76, height * 0.16);

  stroke(0, 115, 205, 22);
  strokeWeight(1);
  for (let y = height * 0.08; y < height * 0.86; y += 3) {
    line(width * 0.12, y, width * 0.88, y);
  }

  noStroke();
  for (let y = height * 0.08; y < height * 0.86; y += 18) {
    fill(0, 12, 24, 18 + noise(y * 0.04, frameCount * 0.02) * 24);
    rect(width * 0.12, y, width * 0.76, 2);
  }

  for (let i = 0; i < 65; i++) {
    fill(90, 180, 230, random(5, 18));
    rect(random(width * 0.12, width * 0.88), random(height * 0.06, height * 0.88), 1, 1);
  }

  blendMode(ADD);

  stroke(35, 170, 245, 18 + energy * 28);
  strokeWeight(1);
  line(width * 0.28, cy, width * 0.72, cy);
  line(cx, height * 0.13, cx, height * 0.84);

  stroke(75, 180, 245, 14 + treble * 22);
  strokeWeight(1);
  line(width * 0.28, height * 0.2, width * 0.72, height * 0.76);
  line(width * 0.72, height * 0.2, width * 0.28, height * 0.76);

  noStroke();
  for (let i = 9; i > 0; i--) {
    const glowSize = coreSize * (1.2 + i * 0.42);
    fill(0, 185, 255, 5 + energy * 9);
    ellipse(cx, cy, glowSize, glowSize * 1.1);
  }

  fill(0, 125, 220, 18 + energy * 20);
  rect(cx - coreSize * 0.2, height * 0.12, coreSize * 0.4, height * 0.7);
  fill(0, 220, 255, 32 + energy * 38);
  rect(cx - coreSize * 0.07, height * 0.18, coreSize * 0.14, height * 0.58);

  push();
  translate(cx, cy);
  rotate(spin);
  drawSignalCrystal(coreSize);
  pop();

  stroke(155, 235, 255, 42 + energy * 70);
  strokeWeight(1);
  line(cx - coreSize * 2.6, cy, cx + coreSize * 2.6, cy);
  line(cx, cy - coreSize * 3.4, cx, cy + coreSize * 3.4);

  stroke(180, 235, 255, 20 + treble * 34);
  strokeWeight(1);
  for (let i = 0; i < 4; i++) {
    const ray = coreSize * (3.1 + i * 0.22);
    const angle = QUARTER_PI + i * HALF_PI;
    line(cx, cy, cx + cos(angle) * ray, cy + sin(angle) * ray);
  }

  blendMode(BLEND);

  noStroke();
  fill(0, 0, 0, 34);
  rect(width * 0.12, height * 0.86, width * 0.76, height * 0.025);
  fill(0, 0, 0, 42);
  rect(0, 0, width, height * 0.06);
  rect(0, height * 0.88, width, height * 0.12);
}

function drawSignalCrystal(size) {
  noStroke();
  for (let i = 8; i > 0; i--) {
    fill(0, 215, 255, 10 + i);
    ellipse(0, 0, size * (0.8 + i * 0.24), size * (1.2 + i * 0.38));
  }

  const top = { x: 0, y: -size * 0.74 };
  const upperRight = { x: size * 0.27, y: -size * 0.42 };
  const lowerRight = { x: size * 0.27, y: size * 0.42 };
  const bottom = { x: 0, y: size * 0.74 };
  const lowerLeft = { x: -size * 0.27, y: size * 0.42 };
  const upperLeft = { x: -size * 0.27, y: -size * 0.42 };
  const middleLeft = { x: -size * 0.08, y: 0 };
  const middleRight = { x: size * 0.08, y: 0 };
  const center = { x: 0, y: 0 };

  stroke(235, 255, 255, 190);
  strokeWeight(0.8);

  drawCrystalFacet([top, upperRight, middleRight, center, middleLeft, upperLeft], color(255, 255, 255, 245));
  drawCrystalFacet([center, middleRight, lowerRight, bottom], color(185, 250, 255, 235));
  drawCrystalFacet([center, bottom, lowerLeft, middleLeft], color(100, 230, 255, 205));
  drawCrystalFacet([upperLeft, middleLeft, lowerLeft, bottom, top], color(200, 255, 255, 130));
  drawCrystalFacet([top, upperRight, lowerRight, middleRight], color(255, 255, 255, 170));

  stroke(255, 255, 255, 250);
  strokeWeight(1);
  line(top.x, top.y, bottom.x, bottom.y);
  line(upperLeft.x, upperLeft.y, upperRight.x, upperRight.y);
  line(lowerLeft.x, lowerLeft.y, lowerRight.x, lowerRight.y);

  stroke(255, 255, 255, 245);
  strokeWeight(1.5);
  line(-size * 0.08, -size * 0.36, size * 0.08, -size * 0.48);
  line(-size * 0.05, -size * 0.16, size * 0.09, -size * 0.24);
  line(-size * 0.07, size * 0.2, size * 0.08, size * 0.12);

  noStroke();
  fill(255, 255, 255, 245);
  ellipse(0, -size * 0.1, size * 0.2, size * 0.72);
  fill(0, 235, 255, 90);
  ellipse(0, 0, size * 0.5, size * 1.3);
}

function drawCrystalFacet(points, facetColor) {
  fill(facetColor);
  beginShape();
  for (let point of points) {
    vertex(point.x, point.y);
  }
  endShape(CLOSE);
}

function drawMissingDataVisual() {
  background(0, 20); // slight trail effect

  const spacing = 8;
  const time = frameCount * 0.01;

  noFill();

  // --- Horizontal lines with intermittent "missing data" ---
  for (let y = 0; y < height; y += spacing) {
    const noiseVal = noise(y * 0.01, time);
    if (noiseVal > 0.35) {
      stroke(255);
      strokeWeight(1);
      const offset = sin(time + y * 0.01) * currentDensity * 50;
      line(0 + offset, y, width - offset, y);
    }
  }

  // --- Vertical glitch lines ---
  for (let x = 0; x < width; x += spacing * 2) {
    const n = noise(x * 0.02, time * 1.5);
    if (n > 0.6) {
      stroke(255);
      strokeWeight(0.5);
      const glitchShift = sin(time * 5 + x) * 20;
      line(x + glitchShift, 0, x - glitchShift, height);
    }
  }

  // --- Occasional color bursts ---
  if (random() > 0.98) {
    blendMode(ADD);
    stroke(random(255), random(255), random(255));
    strokeWeight(random(1, 3));
    const y = random(height);
    line(0, y, width, y);
    blendMode(BLEND);
  }

}

function updateAudioParams() {
  if (bodyControls.hasPose) {
    currentNoteIndex = floor(map(bodyControls.leftY, 0, 1, scale.length - 1, 0));
    currentNoteIndex = constrain(currentNoteIndex, 0, scale.length - 1);
    currentNote = scale[currentNoteIndex];
    currentVolume = lerp(currentVolume, map(bodyControls.rightY, 0, 1, -30, 0), 0.12);
    currentDensity = lerp(currentDensity, bodyControls.density, 0.12);

    synth.volume.value = currentVolume;
    reverb.wet.value = lerp(reverb.wet.value, map(currentDensity, 0, 1, 0.75, 0.35), 0.08);
    Tone.Transport.bpm.value = map(currentDensity, 0, 1, 56, 92);
  } else {
    currentNoteIndex = floor(map(mouseY, height, 0, 0, scale.length - 1));
    currentNoteIndex = constrain(currentNoteIndex, 0, scale.length - 1);
    currentNote = scale[currentNoteIndex];
    currentVolume = map(mouseX, 0, width, -30, 0);
    currentDensity = map(mouseY, height, 0, 0.15, 0.85);
    synth.volume.value = currentVolume;
  }
}

function setupBodyTracking() {
  bodyVideo = createCapture({
    video: {
      width: 640,
      height: 480,
      facingMode: "user",
    },
    audio: false,
  });
  bodyVideo.size(640, 480);
  bodyVideo.hide();

  if (typeof Pose === "undefined") {
    console.log("MediaPipe Pose not loaded. Mouse controls stay active.");
    return;
  }

  pose = new Pose({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
  });
  pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    minDetectionConfidence: 0.55,
    minTrackingConfidence: 0.55,
  });
  pose.onResults(updateBodyControls);
  runPoseTracking();
}

async function runPoseTracking() {
  if (!pose || poseRunning || !bodyVideo || !bodyVideo.elt) return;
  poseRunning = true;

  try {
    if (bodyVideo.elt.readyState >= 2) {
      await pose.send({ image: bodyVideo.elt });
    }
  } catch (error) {
    console.log("Body tracking paused:", error);
  }

  poseRunning = false;
  requestAnimationFrame(runPoseTracking);
}

function updateBodyControls(results) {
  const landmarks = results.poseLandmarks;
  if (!landmarks) {
    bodyControls.hasPose = millis() - bodyControls.lastSeen < 1200;
    return;
  }

  const leftWrist = landmarks[15];
  const rightWrist = landmarks[16];
  const wristsVisible = isPosePointVisible(leftWrist) && isPosePointVisible(rightWrist);

  if (!wristsVisible) {
    bodyControls.hasPose = millis() - bodyControls.lastSeen < 1200;
    return;
  }

  const handDistance = dist(leftWrist.x, leftWrist.y, rightWrist.x, rightWrist.y);
  const density = constrain(map(handDistance, 0.08, 0.7, 0, 1), 0, 1);

  bodyControls.hasPose = true;
  bodyControls.lastSeen = millis();
  bodyControls.density = lerp(bodyControls.density, density, 0.18);
  bodyControls.handDistance = lerp(bodyControls.handDistance, handDistance, 0.18);
  bodyControls.leftX = lerp(bodyControls.leftX, 1 - leftWrist.x, 0.2);
  bodyControls.leftY = lerp(bodyControls.leftY, leftWrist.y, 0.2);
  bodyControls.rightX = lerp(bodyControls.rightX, 1 - rightWrist.x, 0.2);
  bodyControls.rightY = lerp(bodyControls.rightY, rightWrist.y, 0.2);
}

function isPosePointVisible(point) {
  return point && (point.visibility === undefined || point.visibility > 0.45);
}

function getBandEnergy(spectrum, start, end) {
  let total = 0;
  let count = 0;

  for (let i = start; i < end; i++) {
    total += constrain(map(spectrum[i], -100, -20, 0, 1), 0, 1);
    count++;
  }

  return count ? total / count : 0;
}

async function keyPressed() {
  if (key === 'f' || key === 'F') {
    let fs = fullscreen();
    fullscreen(!fs);
  }

  if (key === " ") {
    if (!isPlaying) {
      await initializeTone();
      loop.start(0);
      Tone.Transport.start();
      isPlaying = true;
    } else {
      loop.stop();
      Tone.Transport.stop();
      synth.releaseAll();
      isPlaying = false;
    }
  }
}

async function initializeTone() {
  if (toneReady) return;
  await Tone.start();
  await Tone.loaded();
  Tone.Transport.bpm.value = 64;
  toneReady = true;
  console.log("audio context started");
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
