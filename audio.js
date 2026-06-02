class AudioEngine {
  constructor() {
    this.limiter = new Tone.Limiter(-6).toDestination();
    this.master = new Tone.Gain(0.66).connect(this.limiter);
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
    const drumFilter = new Tone.Filter(920, "lowpass").connect(this.mainGain);
    const drumGain = new Tone.Gain(0.34).connect(drumFilter);
    const kick = new Tone.MembraneSynth({
      pitchDecay: 0.04,
      octaves: 2.1,
      oscillator: { type: "sine" },
      envelope: { attack: 0.002, decay: 0.28, sustain: 0.01, release: 0.16 },
    }).connect(drumGain);
    const tickFilter = new Tone.Filter(1550, "bandpass").connect(drumGain);
    const tickGain = new Tone.Gain(0).connect(tickFilter);
    const tick = new Tone.Noise("brown").connect(tickGain);
    return { lfo, filterLfo, drumFilter, drumGain, kick, tick, tickGain, drift: 0, timing: 0, pitch: 0 };
  }

  createTextureEngine() {
    const hissFilter = new Tone.Filter(2600, "bandpass").connect(this.reverb);
    const hissGain = new Tone.Gain(0).connect(hissFilter);
    const hiss = new Tone.Noise("pink").connect(hissGain);
    const crackleGain = new Tone.Gain(0).connect(this.mainGain);
    const crackle = new Tone.Noise("pink").connect(new Tone.Filter(3600, "bandpass").connect(crackleGain));
    const clickFilter = new Tone.Filter(1800, "bandpass").connect(this.mainGain);
    const clickGain = new Tone.Gain(0).connect(clickFilter);
    const click = new Tone.Oscillator({ type: "triangle", frequency: 900 }).connect(clickGain);
    return { hiss, hissGain, hissFilter, crackle, crackleGain, click, clickGain, clickFilter };
  }

  createSpaceEngine() {
    const leadFilter = new Tone.Filter(1250, "lowpass").connect(this.mainGain);
    const leadGain = new Tone.Gain(0.28).connect(leadFilter);
    const lead = new Tone.MonoSynth({
      oscillator: { type: "sine" },
      filter: { type: "lowpass", frequency: 900, rolloff: -24 },
      envelope: { attack: 0.04, decay: 0.16, sustain: 0.34, release: 0.72 },
      filterEnvelope: { attack: 0.05, decay: 0.24, sustain: 0.18, release: 0.6, baseFrequency: 220, octaves: 1.7 },
    }).connect(leadGain);
    return { lead, leadGain, leadFilter, wet: 0.18, feedback: 0.12, width: 0.1 };
  }

  createMemoryEngine() {
    return { age: 0, dropout: 0, filter: 7200 };
  }

  createSampleEngine() {
    const compressor = new Tone.Compressor({
      threshold: -24,
      ratio: 3,
      attack: 0.012,
      release: 0.22,
    }).connect(this.mainGain);
    const gain = new Tone.Gain(0.54).connect(compressor);
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
    return { gain, compressor, players, states, activeVoices: new Set(), loopPlayer: null, loopIndex: null, loopGridCell: null, loopStopTime: null };
  }

  async start() {
    await Tone.start();
    this.loopEngine.click.start();
    this.motionEngine.lfo.start();
    this.motionEngine.filterLfo.start();
    this.motionEngine.tick.start();
    this.textureEngine.hiss.start();
    this.textureEngine.crackle.start();
    this.textureEngine.click.start();
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
      const isInBetween = event.inBetween || event.random;
      const baseFreq = isInBetween ? noteToFrequency("G2") : noteToFrequency("C2");
      this.motionEngine.drumFilter.frequency.setValueAtTime(map(event.filterValue || 0.5, 0, 1, 520, 1350), time);
      if (isInBetween) {
        this.triggerGate(this.motionEngine.tick, this.motionEngine.tickGain, 0, 0.022, time, velocity * 0.18);
      } else {
        this.motionEngine.kick.triggerAttackRelease(baseFreq, "16n", time, velocity * 0.62);
      }
      return;
    }

    if (event.type === "clickPattern") {
      if (random() > event.probability) return;
      this.memoryDistortion.distortion = map(event.distortion || 0.2, 0, 1, 0.002, 0.035);
      this.textureEngine.clickFilter.frequency.setValueAtTime(map(event.filterValue || 0.5, 0, 1, 700, 2600), time);
      this.triggerGate(this.textureEngine.click, this.textureEngine.clickGain, noteToFrequency(event.note), 0.018 + (event.distortion || 0) * 0.018, time, velocity * 0.22);
      return;
    }

    if (event.type === "lead") {
      this.spaceEngine.leadFilter.frequency.setValueAtTime(map(event.filterValue || 0.5, 0, 1, 520, 2200), time);
      this.spaceEngine.lead.triggerAttackRelease(event.note, "8n", time, velocity * 0.54);
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
      const startTime = time + i * 0.24;
      this.startSampleVoice(player, startTime, volume, event.playbackRate || 1);
    }
    return true;
  }

  startSampleVoice(sourcePlayer, time, volume, playbackRate) {
    const isTextSample = sourcePlayer.samplePath && sourcePlayer.samplePath.includes("/text/");
    if (isTextSample) this.stopTextSampleVoices(time);
    this.trimSampleVoices(time, 2);
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
    voice.samplePath = sourcePlayer.samplePath || "";
    voice.isTextSample = isTextSample;
    this.sampleEngine.activeVoices.add(voice);
    voice.start(time);
  }

  stopTextSampleVoices(time) {
    if (!this.sampleEngine || !this.sampleEngine.activeVoices) return;
    if (this.sampleEngine.loopPlayer && this.sampleEngine.loopPlayer.isTextSample) this.stopSampleLoop(time);
    for (const voice of Array.from(this.sampleEngine.activeVoices)) {
      if (!voice.isTextSample) continue;
      try {
        voice.stop(time);
      } catch (error) {}
    }
  }

  trimSampleVoices(time, keepCount) {
    if (!this.sampleEngine || !this.sampleEngine.activeVoices) return;
    const voices = Array.from(this.sampleEngine.activeVoices);
    while (voices.length > keepCount) {
      const voice = voices.shift();
      try {
        voice.stop(time);
      } catch (error) {}
    }
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

    if (player.samplePath && player.samplePath.includes("/text/")) this.stopTextSampleVoices(time);

    this.stopSampleLoop(time);
    this.trimSampleVoices(time, 2);
    const loopPlayer = new Tone.Player({
      url: player.buffer,
      fadeIn: 0.03,
      fadeOut: 0.2,
      loop: true,
      playbackRate: 1,
    }).connect(this.sampleEngine.gain);
    loopPlayer.volume.value = map(velocity, 0, 1, -30, -14);
    loopPlayer.samplePath = player.samplePath || "";
    loopPlayer.isTextSample = loopPlayer.samplePath.includes("/text/");
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

  stopAll(time) {
    this.stopSamples(time);
    try {
      this.loopEngine.voice.releaseAll(time);
    } catch (error) {}
    try {
      this.loopEngine.pluck.releaseAll(time);
    } catch (error) {}
    try {
      this.loopEngine.clickGain.gain.cancelScheduledValues(time);
      this.loopEngine.clickGain.gain.setValueAtTime(0, time);
      this.textureEngine.hissGain.gain.setValueAtTime(0, time);
      this.textureEngine.crackleGain.gain.setValueAtTime(0, time);
    } catch (error) {}
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
    if (oscillator.frequency && Number.isFinite(frequency)) oscillator.frequency.setValueAtTime(frequency, time);
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
          const fadedEvent = { ...event, velocity: event.velocity * fade, probability: event.probability * fade, loopMemoryId: memory.id, loopPlayback: true };
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
