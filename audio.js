class AudioEngine {
  constructor() {
    this.limiter = new Tone.Limiter(-3).toDestination();
    this.master = new Tone.Gain(0.96).connect(this.limiter);
    this.outputAnalyser = new Tone.Analyser("waveform", 1024);
    this.fftAnalyser = new Tone.Analyser("fft", 64);
    this.memoryFilter = new Tone.Filter(3600, "lowpass");
    this.memoryDistortion = new Tone.Distortion(0.003);
    this.memoryCrusher = new Tone.BitCrusher(12);
    this.delay = new Tone.FeedbackDelay("8n", 0.12);
    this.pingDelay = new Tone.PingPongDelay("4n", 0.12);
    this.reverb = new Tone.Reverb({ decay: 8.2, wet: 0.42 });
    this.width = new Tone.Panner(0);
    this.mainGain = new Tone.Gain(0.9);

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
    const noteFilter = new Tone.Filter(620, "lowpass").connect(this.mainGain);
    const noteGain = new Tone.Gain(0.62).connect(noteFilter);
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
    return { voice, noteGain, noteFilter, pluck, pluckGain, pluckFilter, click, clickGain, droneChorus: null, droneDelay: null };
  }

  createMotionEngine() {
    const lfo = new Tone.LFO({ frequency: 0.08, min: -18, max: 18 });
    const filterLfo = new Tone.LFO({ frequency: 0.05, min: 520, max: 2200 });
    filterLfo.connect(this.loopEngine.noteFilter.frequency);
    const drumDistortion = new Tone.Distortion(0.035).connect(this.mainGain);
    const drumFilter = new Tone.Filter(980, "lowpass").connect(drumDistortion);
    const drumGain = new Tone.Gain(0.42).connect(drumFilter);
    const kick = new Tone.MembraneSynth({
      pitchDecay: 0.018,
      octaves: 1.15,
      oscillator: { type: "sine" },
      envelope: { attack: 0.006, decay: 0.34, sustain: 0.02, release: 0.28 },
    }).connect(drumGain);
    const tickFilter = new Tone.Filter(1350, "bandpass").connect(drumGain);
    const tickGain = new Tone.Gain(0).connect(tickFilter);
    const tick = new Tone.Noise("pink").connect(tickGain);
    const tunedClickFilter = new Tone.Filter(1150, "bandpass").connect(drumGain);
    const tunedClickGain = new Tone.Gain(0).connect(tunedClickFilter);
    const tunedClick = new Tone.Oscillator({ type: "triangle", frequency: 220 }).connect(tunedClickGain);
    return { lfo, filterLfo, drumFilter, drumDistortion, drumGain, kick, tick, tickGain, tunedClick, tunedClickGain, tunedClickFilter, drift: 0, timing: 0, pitch: 0 };
  }

  createTextureEngine() {
    const hissFilter = new Tone.Filter(2600, "bandpass").connect(this.reverb);
    const hissGain = new Tone.Gain(0).connect(hissFilter);
    const hiss = new Tone.Noise("pink").connect(hissGain);
    const crackleGain = new Tone.Gain(0).connect(this.mainGain);
    const crackle = new Tone.Noise("pink").connect(new Tone.Filter(3200, "bandpass").connect(crackleGain));
    const clickFilter = new Tone.Filter(2100, "bandpass").connect(this.mainGain);
    const clickGain = new Tone.Gain(0).connect(clickFilter);
    const click = new Tone.Oscillator({ type: "triangle", frequency: 900 }).connect(clickGain);
    return { hiss, hissGain, hissFilter, crackle, crackleGain, click, clickGain, clickFilter };
  }

  createSpaceEngine() {
    const leadDelay = new Tone.FeedbackDelay({ delayTime: "8n", feedback: 0.34, wet: 0.34 }).connect(this.reverb);
    const leadFilter = new Tone.Filter(980, "lowpass").connect(this.mainGain);
    leadFilter.connect(leadDelay);
    const leadGain = new Tone.Gain(0.32).connect(leadFilter);
    const lead = new Tone.FMSynth({
      harmonicity: 0.51,
      modulationIndex: 0.34,
      oscillator: { type: "sine" },
      modulation: { type: "sine" },
      envelope: { attack: 0.025, decay: 0.26, sustain: 0.12, release: 0.62 },
      modulationEnvelope: { attack: 0.03, decay: 0.22, sustain: 0.08, release: 0.46 },
    }).connect(leadGain);
    const crackleFilter = new Tone.Filter(1900, "bandpass").connect(this.mainGain);
    crackleFilter.connect(leadDelay);
    const crackleGain = new Tone.Gain(0).connect(crackleFilter);
    const crackle = new Tone.Noise("pink").connect(crackleGain);
    return { lead, leadGain, leadFilter, leadCrusher: null, leadDelay, crackle, crackleGain, wet: 0.34, feedback: 0.34, width: 0.1 };
  }

  createMemoryEngine() {
    return { age: 0, dropout: 0, filter: 7200 };
  }

  createSampleEngine() {
    const limiter = new Tone.Limiter(-4).connect(this.mainGain);
    const compressor = new Tone.Compressor({
      threshold: -30,
      ratio: 8,
      attack: 0.006,
      release: 0.18,
    }).connect(limiter);
    const sampleDistortion = new Tone.Distortion(0.01).connect(compressor);
    const lowpass = new Tone.Filter(2600, "lowpass").connect(sampleDistortion);
    const highpass = new Tone.Filter(80, "highpass").connect(lowpass);
    const gain = new Tone.Gain(1.12).connect(highpass);
    const states = samplePaths.map((path) => ({ path, loaded: false, failed: false, trimDb: 0 }));
    const players = samplePaths.map((path, index) => {
      const player = new Tone.Player({
        url: path,
        fadeIn: 0.025,
        fadeOut: 0.18,
        onload: () => {
          states[index].loaded = true;
          states[index].trimDb = this.getSampleTrimDb(player);
        },
        onerror: (error) => {
          states[index].failed = true;
          console.error("sample failed to load:", path, error);
        },
      }).connect(gain);
      player.samplePath = path;
      player.sampleIndex = index;
      return player;
    });
    return { gain, highpass, lowpass, sampleDistortion, compressor, limiter, players, states, activeVoices: new Set(), loopPlayer: null, loopIndex: null, loopGridCell: null, loopStopTime: null };
  }

  async start() {
    await Tone.start();
    this.loopEngine.click.start();
    this.motionEngine.lfo.start();
    this.motionEngine.filterLfo.start();
    this.motionEngine.tick.start();
    this.motionEngine.tunedClick.start();
    this.textureEngine.hiss.start();
    this.textureEngine.crackle.start();
    this.textureEngine.click.start();
    this.spaceEngine.crackle.start();
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

  setAudioValue(param, value, rampTime = 0) {
    if (!param || !Number.isFinite(value)) return;
    try {
      if (rampTime > 0 && typeof param.rampTo === "function") {
        param.rampTo(value, rampTime);
      } else if (typeof param === "object" && "value" in param) {
        param.value = value;
      }
    } catch (error) {}
  }

  updateFromLayers(layerState) {
    const drone = getPlaybackParams("loopCreator") || defaultParams;
    const filterFrequency = map(selectedFilter, 0, 1, 70, 5200);
    this.setAudioValue(this.loopEngine.noteFilter.frequency, filterFrequency);
    this.setAudioValue(this.loopEngine.pluckFilter.frequency, filterFrequency);
    this.setAudioValue(this.memoryFilter.frequency, map(selectedFilter, 0, 1, 260, 6200));
    this.setAudioValue(this.reverb.wet, constrain(map(drone.chance || 0.1, 0, 1, 0.28, 0.72), 0.24, 0.76));
    if (this.loopEngine.droneChorus) {
      this.setAudioValue(this.loopEngine.droneChorus.wet, constrain(map(drone.chance || 0.1, 0, 1, 0.16, 0.58), 0.12, 0.62));
      this.loopEngine.droneChorus.depth = constrain(map(drone.variation || 0.1, 0, 1, 0.16, 0.68), 0.12, 0.72);
    }
    if (this.loopEngine.droneDelay) this.setAudioValue(this.loopEngine.droneDelay.wet, constrain(map(drone.chance || 0.1, 0, 1, 0.08, 0.34), 0.05, 0.38));
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
    this.setAudioValue(this.loopEngine.noteFilter.frequency, filterFrequency);
    this.setAudioValue(this.loopEngine.pluckFilter.frequency, filterFrequency);

    if (event.type === "chord") {
      this.playDroneChord(event, time, velocity);
      return;
    }

    if (event.type === "percussion") {
      if (random() > event.probability) return;
      const isInBetween = event.inBetween || event.random;
      const noteFreq = noteToFrequency(event.note || (isInBetween ? "G2" : "C2"));
      const brightness = event.filterValue || 0.5;
      const baseFreq = noteFreq * (event.accent ? 0.24 : 0.31);
      if (this.motionEngine.drumDistortion) this.motionEngine.drumDistortion.distortion = map(brightness, 0, 1, 0.018, 0.085);
      this.motionEngine.drumFilter.frequency.setValueAtTime(map(brightness, 0, 1, 360, 1500), time);
      this.motionEngine.tunedClickFilter.frequency.setValueAtTime(map(brightness, 0, 1, 620, 2600), time);
      if (isInBetween) {
        const ratio = event.harmonicRatio || random([1, 1.5, 2]);
        this.triggerGate(this.motionEngine.tunedClick, this.motionEngine.tunedClickGain, noteFreq * ratio, 0.018 + brightness * 0.018, time, velocity * 0.2);
        this.triggerGate(this.motionEngine.tick, this.motionEngine.tickGain, 0, 0.018 + brightness * 0.02, time + 0.004, velocity * 0.045);
      } else if (event.accent) {
        this.motionEngine.kick.triggerAttackRelease(baseFreq, "8n", time, velocity * 0.58);
        this.triggerGate(this.motionEngine.tunedClick, this.motionEngine.tunedClickGain, noteFreq * 0.5, 0.026, time + 0.012, velocity * 0.13);
      } else {
        this.triggerGate(this.motionEngine.tunedClick, this.motionEngine.tunedClickGain, noteFreq * random([0.75, 1, 1.5]), 0.022, time, velocity * 0.16);
      }
      return;
    }

    if (event.type === "clickPattern") {
      if (random() > event.probability) return;
      this.memoryDistortion.distortion = map(event.distortion || 0.2, 0, 1, 0.001, 0.022);
      this.textureEngine.clickFilter.frequency.setValueAtTime(map(event.filterValue || 0.5, 0, 1, 820, 3400), time);
      const clickFreq = noteToFrequency(event.note) * (event.harmonicRatio || 1);
      const clickDuration = event.durationSeconds || (0.024 + (event.distortion || 0) * 0.028);
      this.triggerGate(this.textureEngine.click, this.textureEngine.clickGain, clickFreq, clickDuration, time, velocity * 0.46);
      if (this.textureEngine.crackleGain) {
        const accent = event.noiseAccent ? 0.18 : 0.08;
        this.triggerGate(this.textureEngine.crackle, this.textureEngine.crackleGain, 0, clickDuration * 1.5, time + 0.004, velocity * accent);
      }
      return;
    }

    if (event.type === "lead") {
      this.playExperimentalLead(event, time, velocity);
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
    const loopParams = getPlaybackParams("loopCreator") || defaultParams;
    const movement = loopParams.variation || 0.18;
    const seconds = Number.isFinite(time) ? time : Tone.now();
    const slowA = (sin(seconds * 0.045) + 1) * 0.5;
    const slowB = (sin(seconds * 0.027 + 1.8) + 1) * 0.5;
    const filterFrequency = map(event.filterValue || 0.5, 0, 1, 70, 2600) * map(slowA, 0, 1, 0.66, 1.1 + movement * 0.2);
    this.setAudioValue(this.loopEngine.noteFilter.frequency, constrain(filterFrequency, 65, 3400), 1.4 + slowB * 2.4);
    if (this.loopEngine.droneChorus) {
      this.setAudioValue(this.loopEngine.droneChorus.wet, constrain(0.16 + slowB * 0.28 + movement * 0.12, 0.12, 0.62), 2.2);
      this.loopEngine.droneChorus.depth = constrain(0.22 + slowA * 0.34 + movement * 0.12, 0.16, 0.72);
    }
    if (this.loopEngine.droneDelay) {
      this.setAudioValue(this.loopEngine.droneDelay.feedback, constrain(0.12 + slowA * 0.18 + movement * 0.08, 0.08, 0.4), 2.4);
      this.setAudioValue(this.loopEngine.droneDelay.wet, constrain(0.08 + slowB * 0.18, 0.06, 0.32), 2.4);
    }
    for (let i = 0; i < chord.length; i++) {
      const relativeVelocity = constrain(velocity * random(0.58, 1.02 + movement * 0.34 + (event.velocitySpread || 0.1)), 0.04, 0.84);
      const delay = i * random(0.015, 0.08 + movement * 0.12);
      const lowFold = i > 1 && (slowA > 0.58 || movement > 0.42) ? -1 : 0;
      const note = transposeNoteOctaves(chord[i], lowFold);
      this.loopEngine.voice.triggerAttackRelease(note, random(["1m", "2m", "1m"]), time + delay, relativeVelocity * map(loopParams.density || 0.24, 0, 1, 0.34, 0.62));
    }
  }

  playExperimentalLead(event, time, velocity) {
    const instability = constrain(event.instability || 0, 0, 1);
    const speed = constrain(event.speed || 0, 0, 1);
    const cutoff = map(event.filterValue || 0.5, 0, 1, 220, 3200);
    this.spaceEngine.leadFilter.frequency.setValueAtTime(cutoff, time);
    if (this.spaceEngine.lead.modulationIndex) this.setAudioValue(this.spaceEngine.lead.modulationIndex, map(instability + speed * 0.75, 0, 1.75, 0.18, 1.55), 0.035);
    if (this.spaceEngine.leadDelay) {
      this.setAudioValue(this.spaceEngine.leadDelay.wet, map(instability + speed * 0.45, 0, 1.45, 0.26, 0.58), 0.03);
      this.setAudioValue(this.spaceEngine.leadDelay.feedback, map(instability + speed * 0.35, 0, 1.35, 0.26, 0.62), 0.03);
      this.setAudioValue(this.spaceEngine.leadDelay.delayTime, random(["16n", "8n", "8n.", "4n"]), 0.02);
    }
    if (this.spaceEngine.leadCrusher && this.spaceEngine.leadCrusher.bits) {
      const bits = floor(map(instability + speed * 0.4, 0, 1.4, 12, 6));
      if (typeof this.spaceEngine.leadCrusher.bits === "object" && "value" in this.spaceEngine.leadCrusher.bits) {
        this.spaceEngine.leadCrusher.bits.value = bits;
      } else {
        this.spaceEngine.leadCrusher.bits = bits;
      }
    }
    const repeats = constrain(event.repeatCount || 1, 1, 7);
    for (let i = 0; i < repeats; i++) {
      const jitter = i * map(speed, 0, 1, 0.062, 0.014) + random(-0.006, 0.01) * instability;
      const octave = i && random() < 0.42 + instability * 0.22 ? random([-1, 0, 0, 1]) : 0;
      const note = transposeNoteOctaves(event.note, octave);
      const dur = random(["64n", "32n", "32n", "16n"]);
      this.spaceEngine.lead.triggerAttackRelease(note, dur, time + jitter, velocity * map(i, 0, repeats - 1 || 1, 0.54, 0.14));
    }
    if (this.spaceEngine.crackleGain) {
      this.triggerGate(this.spaceEngine.crackle, this.spaceEngine.crackleGain, 0, 0.03 + speed * 0.08, time + 0.006, velocity * map(instability + speed * 0.7, 0, 1.7, 0.045, 0.24));
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
    const stateIndex = Number.isFinite(player.sampleIndex) ? player.sampleIndex : index;
    const trimDb = this.sampleEngine.states[stateIndex] ? this.sampleEngine.states[stateIndex].trimDb : 0;
    const volume = map(velocity, 0, 1, -16, -3) + trimDb;
    this.setSampleFilter(event, time);
    for (let i = 0; i < repeatCount; i++) {
      const startTime = time + i * 0.24;
      this.startSampleVoice(player, startTime, volume, event.playbackRate || 1);
    }
    return true;
  }

  getSampleTrimDb(player) {
    try {
      const buffer = player.buffer && (player.buffer._buffer || (typeof player.buffer.get === "function" ? player.buffer.get() : player.buffer));
      if (!buffer || !buffer.numberOfChannels) return 0;
      let peak = 0;
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const data = buffer.getChannelData(channel);
        const step = max(1, floor(data.length / 12000));
        for (let i = 0; i < data.length; i += step) peak = max(peak, abs(data[i]));
      }
      if (peak <= 0) return 0;
      return constrain(-12 - 20 * Math.log10(peak), -14, 4);
    } catch (error) {
      return 0;
    }
  }

  setSampleFilter(event, time) {
    const baseCutoff = map(event.filterValue || 0.5, 0, 1, 900, 3600);
    const occasionalDarkening = random() < 0.38 ? random(0.45, 0.82) : 1;
    const cutoff = constrain(baseCutoff * occasionalDarkening, 520, 4200);
    this.sampleEngine.lowpass.frequency.cancelScheduledValues(time);
    this.sampleEngine.lowpass.frequency.setValueAtTime(this.sampleEngine.lowpass.frequency.value || cutoff, time);
    this.sampleEngine.lowpass.frequency.rampTo(cutoff, 0.18);
    this.sampleEngine.highpass.frequency.setValueAtTime(random() < 0.25 ? 140 : 80, time);
    if (this.sampleEngine.sampleDistortion) this.sampleEngine.sampleDistortion.distortion = constrain(map(event.texture || 0.3, 0, 1, 0.004, 0.045), 0.004, 0.05);
  }

  startSampleVoice(sourcePlayer, time, volume, playbackRate) {
    const isTextSample = sourcePlayer.samplePath && sourcePlayer.samplePath.includes("/text/");
    if (isTextSample) this.stopTextSampleVoices(time);
    this.trimSampleVoices(time, this.sampleEngine.loopPlayer ? 1 : 2);
    if (isTextSample) this.trimSampleVoices(time, 0);
    const voice = new Tone.Player({
      url: sourcePlayer.buffer,
      fadeIn: 0.025,
      fadeOut: 0.18,
      loop: false,
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
    const naturalDuration = sourcePlayer.buffer && Number.isFinite(sourcePlayer.buffer.duration) ? sourcePlayer.buffer.duration / max(0.01, playbackRate) : 10;
    voice.stop(time + naturalDuration + 0.1);
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
    if (player.samplePath && player.samplePath.includes("/text/")) this.trimSampleVoices(time, 2);
    this.setSampleFilter(event, time);
    const loopPlayer = new Tone.Player({
      url: player.buffer,
      fadeIn: 0.03,
      fadeOut: 0.2,
      loop: true,
      playbackRate: 1,
    }).connect(this.sampleEngine.gain);
    const trimDb = this.sampleEngine.states[index] ? this.sampleEngine.states[index].trimDb : 0;
    loopPlayer.volume.value = map(velocity, 0, 1, -18, -5) + trimDb;
    loopPlayer.samplePath = player.samplePath || "";
    loopPlayer.isTextSample = loopPlayer.samplePath.includes("/text/");
    loopPlayer.start(time);
    this.sampleEngine.loopPlayer = loopPlayer;
    this.sampleEngine.loopIndex = index;
    this.sampleEngine.loopGridCell = Number.isFinite(event.gridCell) ? event.gridCell : index;
    const loopDuration = player.buffer && Number.isFinite(player.buffer.duration) ? player.buffer.duration : 1;
    this.sampleEngine.loopStopTime = time + constrain(loopDuration * 4.5, loopDuration + 0.25, 14);
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

  stopTransient(time) {
    this.stopSamples(time);
    try {
      this.spaceEngine.lead.triggerRelease(time);
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
