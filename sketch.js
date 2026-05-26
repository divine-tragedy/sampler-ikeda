// Global state
let cnv;
let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
const bgColors = [100, 150, 250];
let bgIndex = 0;
const buffers = [buffer1, buffer2, buffer3, buffer4, buffer5]; // from buffers.js
let bufferIndex = 0;
let loopStart, loopEnd, pressedPoint, releasePoint;
let isPlaying = false;
let toneReady = false;
let grainSize = 0.1;
let overlap = 0.1;
let volumeLevel = 1;
let bodyVideo;
let pose;
let poseRunning = false;
let bodyControls = {
  hasPose: false,
  intensity: 0.15,
  leftX: 0.5,
  leftY: 0.5,
  rightX: 0.5,
  rightY: 0.5,
  lastSeen: 0,
};

// Microphone
let recorder;
let mic;
let recordedBuffer;

// MIDI
let midiAccess;
let midiInputs = [];

// Tone.GrainPlayer — granular playback of the active buffer
const player = new Tone.GrainPlayer(buffers[bufferIndex]);
const fft = new Tone.FFT(64);
const meter = new Tone.Meter();
const outputGain = new Tone.Gain(volumeLevel);

// Light reverb tail
const reverb = new Tone.Reverb({
  decay: 3,
  preDelay: 0.25,
  wet: 0.2,
});

function setup() {
  cnv = createCanvas(448 , 256);
  fullscreen(true);
  cnv.mousePressed(getPressedPoint);
  cnv.mouseReleased(getReleasePoint);
  cnv.mouseWheel(trackPad);

  player.loop = true;
  player.playbackRate = 1;
  player.overlap = overlap;
  player.grainSize = grainSize;
  outputGain.toDestination();
  player.connect(fft);
  player.connect(meter);
  player.chain(reverb, outputGain);

  pressedPoint = 0;
  releasePoint = 1;
  loopStart = 0;
  loopEnd = 0;

  mic = new Tone.UserMedia();
  recorder = new Tone.Recorder();

  setupMIDI();
  setupBodyTracking();
}
async function startRecording() {
  await initializeTone();
  await mic.open();
  mic.connect(recorder);
  recorder.start();
  console.log("recording...");
}

async function stopRecording() {
  const recording = await recorder.stop();
  const arrayBuffer = await recording.arrayBuffer();
  const audioBuffer = await Tone.context.decodeAudioData(arrayBuffer);
  recordedBuffer = new Tone.ToneAudioBuffer(audioBuffer);
  buffers.push(recordedBuffer);
  console.log("recorded sample added!");
}

function draw() {
  if (bufferIndex === 0) {
    drawNeonGlitchSpectrum();
  } else if (bufferIndex === 1) {
    drawBlueSignalCore();
  } else {
    drawMissingDataVisual();
  }

  updateAudioParams();
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
      const offset = sin(time + y * 0.01) * grainSize * 50;
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
    const rhythmSpeed = map(bodyControls.leftX, 0, 1, 0.65, 1.8);
    const rhythmicGrain = map(bodyControls.leftY, 0, 1, 0.035, 0.45);
    const ambientGrain = map(bodyControls.intensity, 0, 1, 0.6, 0.04);
    const sliceRatio = map(bodyControls.leftY, 0, 1, 0.05, 0.45);
    const pitchAmount = map(bodyControls.rightY, 0, 1, 1200, -1200);

    grainSize = lerp(grainSize, min(rhythmicGrain, ambientGrain), 0.12);
    overlap = lerp(overlap, map(bodyControls.intensity, 0, 1, 0.45, 0.06), 0.08);
    volumeLevel = lerp(volumeLevel, map(bodyControls.intensity, 0, 1, 0.2, 10), 0.12);

    player.grainSize = grainSize;
    player.overlap = overlap;
    player.playbackRate = rhythmSpeed;
    player.detune = pitchAmount;
    reverb.wet.value = lerp(reverb.wet.value, map(bodyControls.intensity, 0, 1, 0.75, 0.12), 0.08);

    if (buffers[bufferIndex].loaded) {
      const duration = buffers[bufferIndex].duration;
      const sliceDuration = duration * sliceRatio;
      const sliceCenter = bodyControls.rightX * duration;
      loopStart = constrain(sliceCenter - sliceDuration * 0.5, 0, duration - sliceDuration);
      loopEnd = loopStart + sliceDuration;
      player.loopStart = loopStart;
      player.loopEnd = loopEnd;
    }
  } else {
    const pitchAmount = map(mouseY, 0, height, 50, -50);
    volumeLevel = constrain(map(mouseX, 0, width, 0, 10), 0, 10);
    player.detune = pitchAmount * 20;
  }

  outputGain.gain.value = volumeLevel;
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
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const wristsVisible = isPosePointVisible(leftWrist) && isPosePointVisible(rightWrist);
  const shouldersVisible = isPosePointVisible(leftShoulder) && isPosePointVisible(rightShoulder);

  if (!wristsVisible || !shouldersVisible) {
    bodyControls.hasPose = millis() - bodyControls.lastSeen < 1200;
    return;
  }

  const shoulderDistance = dist(leftShoulder.x, leftShoulder.y, rightShoulder.x, rightShoulder.y);
  const closeness = constrain(map(shoulderDistance, 0.11, 0.34, 0, 1), 0, 1);

  bodyControls.hasPose = true;
  bodyControls.lastSeen = millis();
  bodyControls.intensity = lerp(bodyControls.intensity, closeness, 0.18);
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

function getPressedPoint() {
  pressedPoint = mouseX / width;
  x1 = mouseX;
  y1 = mouseY;
}

async function getReleasePoint() {
  releasePoint = mouseX / width;
  x2 = mouseX;
  y2 = mouseY;
  await initializeTone();
  calculateLoop();
}

function calculateLoop() {
  if (!buffers[bufferIndex].loaded) return;

  loopStart = pressedPoint * buffers[bufferIndex].duration;
  loopEnd = releasePoint * buffers[bufferIndex].duration;

  if (isPlaying) {
    player.stop();
  }

  if (loopStart < loopEnd) {
    player.loopStart = loopStart;
    player.loopEnd = loopEnd;
    player.reverse = false;
    player.start(undefined, loopStart);
  } else {
    player.loopStart = loopEnd;
    player.loopEnd = loopStart;
    player.reverse = true;
    player.start(undefined, loopEnd);
  }
  isPlaying = true;
}

async function keyPressed() {
  if (key === 'f' || key === 'F') {
    let fs = fullscreen();
    fullscreen(!fs);
  }

  if (key === " ") {
    if (!isPlaying) {
      await initializeTone();
      if (!buffers[bufferIndex].loaded) return;
      player.start(undefined, loopStart || 0);
      isPlaying = true;
    } else {
      player.stop();
      isPlaying = false;
    }
  }

  if (key === "ArrowRight") {
    await initializeTone();
    bufferIndex = (bufferIndex + 1) % buffers.length;
    player.buffer = buffers[bufferIndex];
    calculateLoop();
    bgIndex = (bgIndex + 1) % bgColors.length;
  }
  if (key === "ArrowLeft") {
    await initializeTone();
    if (bufferIndex > 0) {
      bufferIndex = (bufferIndex - 1) % buffers.length;
    } else {
      bufferIndex = buffers.length - 1;
    }
    player.buffer = buffers[bufferIndex];
    calculateLoop();
    bgIndex = (bgIndex + bgColors.length - 1) % bgColors.length;
  }
}

function trackPad(event) {
  if (event.wheelDeltaY > 10) {
    if (grainSize > 0.02) grainSize -= 0.01;
  } else if (event.wheelDeltaY < -10) {
    if (grainSize < 2) grainSize += 0.01;
  }
  player.grainSize = grainSize;
}

async function initializeTone() {
  if (toneReady) return;
  await Tone.start();
  await Tone.loaded();
  toneReady = true;
  console.log("audio context started");
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// MIDI
function setupMIDI() {
  if (navigator.requestMIDIAccess) {
    navigator.requestMIDIAccess({ sysex: false })
      .then(onMIDISuccess, onMIDIFailure);
  } else {
    console.log("Web MIDI API not supported in this browser.");
  }
}

function onMIDISuccess(midi) {
  midiAccess = midi;
  const inputs = midiAccess.inputs.values();
  for (let input of inputs) {
    midiInputs.push(input);
    input.onmidimessage = handleMIDI;
  }
  console.log("MIDI ready:", midiInputs);
}

function onMIDIFailure() {
  console.log("Failed to access MIDI devices.");
}

function handleMIDI(event) {
  const [status, data1, data2] = event.data;

  // CC messages only
  if (status === 176) {
    const value = data2 / 127;

    switch (data1) {
      case 21: // Knob 1 → grain size
        grainSize = map(value, 0, 1, 0.01, 1.5);
        player.grainSize = grainSize;
        break;
      case 22: // Knob 2 → playback rate
        player.playbackRate = map(value, 0, 1, 0.5, 2);
        break;
      case 23: // Knob 3 → detune
        player.detune = map(value, 0, 1, -1200, 1200);
        break;
      case 24: // Knob 4 → reverb wet
        reverb.wet.value = value;
        break;
      case 25: // Fader → loop start
        pressedPoint = value;
        initializeTone().then(calculateLoop);
        break;
      case 26: // Fader → loop end
        releasePoint = value;
        initializeTone().then(calculateLoop);
        break;
      case 36: // Button → next buffer
        if (data2 > 0) {
          initializeTone().then(() => {
            bufferIndex = (bufferIndex + 1) % buffers.length;
            player.buffer = buffers[bufferIndex];
            calculateLoop();
          });
        }
        break;
    }
  }
}
