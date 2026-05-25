// Global state
let cnv;
let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
const bgColors = [100, 150, 250];
let bgIndex = 0;
const buffers = [buffer1, buffer2, buffer3, buffer4, buffer5]; // from buffers.js
let bufferIndex = 0;
let loopStart, loopEnd, pressedPoint, releasePoint;
let isPlaying = false;
let grainSize = 0.1;
let overlap = 0.1;

// Microphone
let recorder;
let mic;
let recordedBuffer;

// MIDI
let midiAccess;
let midiInputs = [];

// Tone.GrainPlayer — granular playback of the active buffer
const player = new Tone.GrainPlayer(buffers[bufferIndex]);

// Light reverb tail
const reverb = new Tone.Reverb({
  decay: 3,
  preDelay: 0.25,
  wet: 0.2,
});

function setup() {
  cnv = createCanvas(windowWidth, windowHeight);
  cnv.style('display', 'block');
  cnv.mousePressed(getPressedPoint);
  cnv.mouseReleased(getReleasePoint);
  cnv.mouseWheel(trackPad);

  player.loop = true;
  player.playbackRate = 1;
  player.overlap = overlap;
  player.grainSize = grainSize;
  reverb.toDestination();
  player.chain(reverb);

  pressedPoint = 0;
  releasePoint = 1;

  mic = new Tone.UserMedia();
  recorder = new Tone.Recorder();

  setupMIDI();
}

async function startRecording() {
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

  // --- Mouse-driven audio params ---
  const audioFactorX = map(mouseX, 0, width, -50, 50);
  const audioFactorY = map(mouseY, 0, height, 0.5, 2);
  grainSize = map(mouseY, 0, height, 0.01, 1.5);
  player.playbackRate = audioFactorY;
  player.detune = audioFactorX * 20;
}

function getPressedPoint() {
  pressedPoint = mouseX / width;
  x1 = mouseX;
  y1 = mouseY;
}

function getReleasePoint() {
  releasePoint = mouseX / width;
  x2 = mouseX;
  y2 = mouseY;
  calculateLoop();
}

function calculateLoop() {
  loopStart = pressedPoint * buffers[bufferIndex].duration;
  loopEnd = releasePoint * buffers[bufferIndex].duration;

  if (loopStart < loopEnd) {
    player.loopStart = loopStart;
    player.loopEnd = loopEnd;
    player.reverse = false;
    player.start(1, loopStart);
  } else {
    player.loopStart = loopEnd;
    player.loopEnd = loopStart;
    player.reverse = true;
    player.start(1, loopEnd);
  }
  isPlaying = true;
}

function keyPressed() {
  if (key === " ") {
    if (!isPlaying) {
      initializeTone();
      player.start(1, loopStart);
      isPlaying = true;
    } else {
      player.stop();
      isPlaying = false;
    }
  }

  if (key === "ArrowRight") {
    bufferIndex = (bufferIndex + 1) % buffers.length;
    player.buffer = buffers[bufferIndex];
    calculateLoop();
    bgIndex = (bgIndex + 1) % bgColors.length;
  }
  if (key === "ArrowLeft") {
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
  await Tone.start();
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
        calculateLoop();
        break;
      case 26: // Fader → loop end
        releasePoint = value;
        calculateLoop();
        break;
      case 36: // Button → next buffer
        if (data2 > 0) {
          bufferIndex = (bufferIndex + 1) % buffers.length;
          player.buffer = buffers[bufferIndex];
          calculateLoop();
        }
        break;
    }
  }
}
