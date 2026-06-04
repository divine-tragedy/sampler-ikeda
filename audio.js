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
    const droneChorus = new Tone.Chorus({ frequency: 0.08, delayTime: 4.5, depth: 0.28, wet: 0.22 }).connect(this.mainGain);
    const droneDelay = new Tone.FeedbackDelay({ delayTime: "2n", feedback: 0.18, wet: 0.12 }).connect(this.reverb);
    noteFilter.connect(droneChorus);
    noteFilter.connect(droneDelay);
    const droneCrusher = new Tone.BitCrusher(12).connect(noteFilter);
    const noteGain = new Tone.Gain(0.34).connect(droneCrusher);
    const voice = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 0.62,
      modulationIndex: 0.22,
      oscillator: { type: "sine" },
      envelope: { attack: 0.55, decay: 1.6, sustain: 0.62, release: 6.4 },
      modulationEnvelope: { attack: 0.7, decay: 1.4, sustain: 0.14, release: 4.8 },
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
    return { voice, noteGain, noteFilter, pluck, pluckGain, pluckFilter, click, clickGain, droneChorus, droneDelay, droneCrusher, activeDroneNotes: [] };
  }

  createMotionEngine() {
    const lfo = new Tone.LFO({ frequency: 0.08, min: -18, max: 18 });
    const filterLfo = new Tone.LFO({ frequency: 0.05, min: 520, max: 2200 });
    filterLfo.connect(this.loopEngine.noteFilter.frequency);
    const drumDistortion = new Tone.Distortion(0.035).connect(this.mainGain);
    const drumFilter = new Tone.Filter(980, "lowpass").connect(drumDistortion);
    const drumGain = new Tone.Gain(0.82).connect(drumFilter);
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
    const limiter = new Tone.Limiter(-8).connect(this.mainGain);
    const compressor = new Tone.Compressor({
      threshold: -30,
      ratio: 8,
      attack: 0.006,
      release: 0.18,
    }).connect(limiter);
    const sampleDistortion = new Tone.Distortion(0.01).connect(compressor);
    const sampleCrusher = new Tone.BitCrusher(12).connect(sampleDistortion);
    const lowpass = new Tone.Filter(2600, "lowpass").connect(sampleCrusher);
    const highpass = new Tone.Filter(80, "highpass").connect(lowpass);
    const gain = new Tone.Gain(0.82).connect(highpass);
    const delaySend = new Tone.Gain(0).connect(this.pingDelay);
    gain.connect(delaySend);
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
    return { gain, highpass, lowpass, sampleCrusher, sampleDistortion, compressor, limiter, delaySend, players, states, activeVoices: new Set(), loopPlayer: null, loopIndex: null, loopGridCell: null, loopStopTime: null };
  }

  async start() {
    await Tone.start();
    this.loopEngine.click.start();
    if (this.loopEngine.droneChorus && typeof this.loopEngine.droneChorus.start === "function") this.loopEngine.droneChorus.start();
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
      const velocity = constrain((event.velocity || 0.58) * fade, 0.04, 1);
    const filterFrequency = map(event.filterValue || 0.5, 0, 1, 180, 1800);
    this.setAudioValue(this.loopEngine.noteFilter.frequency, filterFrequency);
    this.setAudioValue(this.loopEngine.pluckFilter.frequency, filterFrequency);

    if (event.type === "chord") {
      this.playDroneChord(event, time, velocity);
      return;
    }

    if (event.type === "percussion") {
      if (random() > event.probability) return;
      this.duckDrone(time, 0.22, 0.42);
      const isInBetween = event.inBetween || event.random;
      const noteFreq = noteToFrequency(event.note || (isInBetween ? "G2" : "C2"));
      const brightness = event.filterValue || 0.5;
      const baseFreq = noteFreq * (event.accent ? 0.24 : 0.31);
      const tone = constrain(event.tone ?? brightness, 0, 1);
      const noiseMix = constrain(event.noiseMix || 0, 0, 1);
      const pressure = constrain(event.pressure ?? brightness, 0, 1);
      if (this.motionEngine.drumDistortion) this.motionEngine.drumDistortion.distortion = map(max(tone, noiseMix), 0, 1, 0.025, 0.2);
      this.motionEngine.drumFilter.frequency.setValueAtTime(map(pressure, 0, 1, 220, 4200), time);
      this.motionEngine.tunedClickFilter.frequency.setValueAtTime(map(tone, 0, 1, 520, 3600), time);
      if (isInBetween) {
        const ratio = event.harmonicRatio || random([1, 1.5, 2, 3]);
        this.triggerGate(this.motionEngine.tunedClick, this.motionEngine.tunedClickGain, noteFreq * ratio, 0.018 + tone * 0.05, time, velocity * map(noiseMix, 0, 1, 0.12, 0.54));
        this.triggerGate(this.motionEngine.tick, this.motionEngine.tickGain, 0, 0.014 + tone * 0.048, time + 0.004, velocity * map(noiseMix, 0, 1, 0.08, 0.42));
      } else if (event.accent) {
        this.motionEngine.kick.triggerAttackRelease(baseFreq * map(tone, 0, 1, 0.68, 1.32), noiseMix < 0.35 ? "4n" : "8n", time, velocity * map(noiseMix, 0, 1, 0.92, 0.36));
        this.triggerGate(this.motionEngine.tunedClick, this.motionEngine.tunedClickGain, noteFreq * random([0.5, 1, 1.5]), 0.02 + tone * 0.04, time + 0.012, velocity * map(noiseMix, 0, 1, 0.08, 0.42));
        this.triggerGate(this.motionEngine.tick, this.motionEngine.tickGain, 0, 0.012 + noiseMix * 0.04, time + 0.018, velocity * map(noiseMix, 0, 1, 0.02, 0.28));
      } else {
        this.triggerGate(this.motionEngine.tunedClick, this.motionEngine.tunedClickGain, noteFreq * random([0.75, 1, 1.5, 2]), 0.018 + tone * 0.04, time, velocity * map(noiseMix, 0, 1, 0.12, 0.46));
        if (noiseMix > 0.45) this.triggerGate(this.motionEngine.tick, this.motionEngine.tickGain, 0, 0.018 + noiseMix * 0.045, time + 0.004, velocity * map(noiseMix, 0.45, 1, 0.12, 0.38));
      }
      return;
    }

    if (event.type === "clickPattern") {
      if (random() > event.probability) return;
      this.duckDrone(time, 0.28, 0.32);
      const space = constrain(event.space || 0, 0, 1);
      this.memoryDistortion.distortion = map(event.distortion || 0.2, 0, 1, 0.001, 0.045);
      this.textureEngine.clickFilter.frequency.setValueAtTime(map(event.filterValue || 0.5, 0, 1, 520, 6200), time);
      const clickFreq = noteToFrequency(event.note) * (event.harmonicRatio || 1);
      const clickDuration = event.durationSeconds || (0.026 + (event.distortion || 0) * 0.04);
      this.triggerGate(this.textureEngine.click, this.textureEngine.clickGain, clickFreq, clickDuration, time, velocity * map(event.distortion || 0.2, 0, 1, 0.5, 0.82));
      if (this.pingDelay && this.pingDelay.wet) this.setAudioValue(this.pingDelay.wet, map(space, 0, 1, 0.04, 0.38), 0.04);
      if (this.textureEngine.crackleGain) {
        const accent = event.noiseAccent ? 0.28 : 0.075;
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
    const movement = constrain(loopParams.variation || 0.18, 0, 1);
    const timbre = constrain(event.instability ?? loopParams.variation ?? 0.18, 0, 1);
    const space = constrain(event.space ?? loopParams.chance ?? 0.12, 0, 1);
    const density = constrain(loopParams.density || 0.24, 0, 1);
    const seconds = Number.isFinite(time) ? time : Tone.now();
    const slowA = (sin(seconds * 0.045) + 1) * 0.5;
    const slowB = (sin(seconds * 0.027 + 1.8) + 1) * 0.5;
    const filterFrequency = map(event.filterValue || 0.5, 0, 1, 180, 5400) * map(slowA, 0, 1, 0.72, 1.18 + timbre * 0.2);
    const warmPulse = (sin(seconds * 0.19) + 1) * 0.5;
    this.setAudioValue(this.loopEngine.noteGain.gain, constrain(0.22 + density * 0.08 + space * 0.04 + warmPulse * 0.035, 0.2, 0.38), 0.8);
    this.setAudioValue(this.loopEngine.noteFilter.frequency, constrain(filterFrequency, 180, 6200), 0.7 + slowB * 1.2);
    if (this.loopEngine.voice && typeof this.loopEngine.voice.set === "function") {
      this.loopEngine.voice.set({
        harmonicity: constrain(0.44 + movement * 0.34 + timbre * 0.28 + slowA * 0.08, 0.38, 1.15),
        modulationIndex: constrain(0.1 + timbre * 1.75 + movement * 0.24 + slowB * 0.16, 0.08, 2.25),
      });
    }
    if (this.loopEngine.droneCrusher) this.loopEngine.droneCrusher.bits = floor(constrain(map(timbre, 0, 1, 12, 7), 7, 12));
    if (this.loopEngine.droneChorus) {
      this.setAudioValue(this.loopEngine.droneChorus.wet, constrain(0.06 + slowB * 0.1 + space * 0.42, 0.05, 0.68), 0.9);
      this.loopEngine.droneChorus.depth = constrain(0.1 + slowA * 0.14 + space * 0.54, 0.08, 0.86);
    }
    if (this.loopEngine.droneDelay) {
      this.setAudioValue(this.loopEngine.droneDelay.feedback, constrain(0.04 + slowA * 0.08 + space * 0.28, 0.035, 0.48), 0.9);
      this.setAudioValue(this.loopEngine.droneDelay.wet, constrain(0.025 + slowB * 0.06 + space * 0.34, 0.02, 0.46), 0.9);
    }
    const heldNotes = [];
    for (let i = 0; i < chord.length; i++) {
      const lowFold = i > 1 && (slowA > 0.58 || movement > 0.42) ? -1 : 0;
      const note = transposeNoteOctaves(chord[i], lowFold);
      if (!heldNotes.includes(note)) heldNotes.push(note);
    }
    const previousNotes = this.loopEngine.activeDroneNotes || [];
    for (const oldNote of previousNotes) {
      if (!heldNotes.includes(oldNote)) this.loopEngine.voice.triggerRelease(oldNote, time + 0.02);
    }
    for (let i = 0; i < heldNotes.length; i++) {
      const note = heldNotes[i];
      if (previousNotes.includes(note)) continue;
      const relativeVelocity = constrain(max(velocity, 0.34) * random(0.72, 1.02 + movement * 0.22 + (event.velocitySpread || 0.1)), 0.24, 0.78);
      this.loopEngine.voice.triggerAttack(note, time + i * 0.012, relativeVelocity * map(density, 0, 1, 0.5, 0.72));
    }
    this.loopEngine.activeDroneNotes = heldNotes;
    if (random() < 0.14 + movement * 0.16 + space * 0.08) {
      const melodicNote = transposeNoteOctaves(random(chord), random([0, 0, 1]));
      this.loopEngine.pluckFilter.frequency.setValueAtTime(constrain(filterFrequency * 0.72, 340, 2400), time);
      this.loopEngine.pluck.triggerAttackRelease(melodicNote, random(["4n", "2n", "2n."]), time + random(0.02, 0.18), velocity * random(0.08, 0.18));
    }
    if (timbre > 0.62 && random() < map(timbre, 0.62, 1, 0.06, 0.2)) {
      const dirtNote = random(chord);
      const dirtFreq = noteToFrequency(dirtNote) * random([1, 1.5]);
      this.triggerGate(this.loopEngine.click, this.loopEngine.clickGain, dirtFreq, random(0.01, 0.026), time + random(0.01, 0.14), velocity * map(timbre, 0.62, 1, 0.018, 0.055));
    }
  }

  duckDrone(time, amount = 0.25, release = 0.35) {
    if (!this.loopEngine || !this.loopEngine.noteGain || !this.loopEngine.noteGain.gain) return;
    const current = this.loopEngine.noteGain.gain.value || 0.3;
    const ducked = constrain(current * amount, 0.08, 0.24);
    try {
      this.loopEngine.noteGain.gain.cancelScheduledValues(time);
      this.loopEngine.noteGain.gain.setValueAtTime(current, time);
      this.loopEngine.noteGain.gain.linearRampToValueAtTime(ducked, time + 0.025);
      this.loopEngine.noteGain.gain.linearRampToValueAtTime(current, time + release);
    } catch (error) {
      this.setAudioValue(this.loopEngine.noteGain.gain, ducked);
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
    const variation = this.getSamplePlaybackVariation(event, player);
    const volume = constrain(map(velocity, 0, 1, -20, -8) + trimDb + variation.gainDb, -28, -8.5);
    this.setSampleFilter({ ...event, filterValue: variation.filterValue, texture: variation.texture }, time);
    this.setSampleOrganismFx(variation, time);
    for (let i = 0; i < repeatCount; i++) {
      const startTime = time + i * 0.24;
      this.startSampleVoice(player, startTime, volume, variation.playbackRate, variation.offset, variation.duration, variation.reverse);
      for (let s = 1; s < variation.stutterCount; s++) {
        this.startSampleVoice(
          player,
          startTime + s * variation.stutterSpacing,
          volume - 3 - s * 1.25,
          variation.playbackRate * random(0.985, 1.018),
          variation.offset + s * 0.011,
          min(variation.duration || 0.18, 0.065 + s * 0.025),
          variation.reverse,
          true
        );
      }
    }
    return true;
  }

  getSamplePlaybackVariation(event, player) {
    const duration = player && player.buffer && Number.isFinite(player.buffer.duration) ? player.buffer.duration : 1;
    const looped = !!event.loopPlayback || !!event.loopMemoryId;
    const texture = constrain(event.texture || 0.5, 0, 1);
    if (event.liveSample && !looped) {
      return {
        offset: 0,
        duration: "full",
        playbackRate: constrain(event.playbackRate || 1, 0.75, 1.2),
        reverse: false,
        stutterCount: 1,
        stutterSpacing: 0.08,
        filterValue: constrain(event.filterValue || 0.65, 0, 1),
        texture,
        pan: constrain(event.pan || 0, -0.95, 0.95),
        gainDb: -3.5,
        delaySend: 0.02,
        crusherBits: 12,
      };
    }
    const offsetRange = duration * random(looped ? 0.05 : 0.012, looped ? 0.15 : 0.045);
    const centerOffset = constrain((event.startOffset || 0) * duration, 0, max(0, duration - 0.05));
    const offset = constrain(centerOffset + random(-offsetRange, offsetRange), 0, max(0, duration - 0.08));
    const minPlayDuration = min(duration - offset, 3);
    const sliceChance = looped ? 0.08 : 0.12;
    const useSlice = duration - offset > 3.4 && random() < sliceChance;
    const maxSlice = constrain(duration - offset, minPlayDuration, looped ? max(3, min(5.5, duration - offset)) : max(3, min(6, duration - offset)));
    const durationSeconds = useSlice ? random(minPlayDuration, maxSlice) : null;
    const rateBase = event.playbackRate || 1;
    const playbackRate = constrain(rateBase * random(looped ? 0.85 : 0.92, looped ? 1.2 : 1.08), 0.72, 1.28);
    const reverse = durationSeconds !== null && random() < (looped ? 0.13 : 0.045);
    const stutterCount = random() < (looped ? 0.06 : 0.08) ? 2 : 1;
    return {
      offset,
      duration: durationSeconds,
      playbackRate,
      reverse,
      stutterCount,
      stutterSpacing: random(0.045, 0.105),
      filterValue: constrain((event.filterValue || 0.5) + random(-0.1, 0.12), 0, 1),
      texture: constrain(texture + random(-0.12, 0.16), 0, 1),
      pan: constrain((event.pan || 0) + random(-0.18, 0.18), -0.95, 0.95),
      gainDb: random(looped ? -5 : -4, looped ? -1.5 : -2),
      delaySend: looped ? random(0.015, 0.11) : random(0, 0.05),
      crusherBits: floor(random(looped ? 8 : 10, 13)),
    };
  }

  setSampleOrganismFx(variation, time) {
    this.setPanValue(variation.pan, 0.035);
    if (this.sampleEngine.delaySend && this.sampleEngine.delaySend.gain) {
      this.sampleEngine.delaySend.gain.cancelScheduledValues(time);
      this.sampleEngine.delaySend.gain.setValueAtTime(this.sampleEngine.delaySend.gain.value || 0, time);
      this.sampleEngine.delaySend.gain.rampTo(variation.delaySend, 0.08);
    }
    if (this.sampleEngine.sampleCrusher) this.sampleEngine.sampleCrusher.bits = variation.crusherBits;
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
      return constrain(-16 - 20 * Math.log10(peak), -18, 1);
    } catch (error) {
      return 0;
    }
  }

  setSampleFilter(event, time) {
    const baseCutoff = map(event.filterValue || 0.5, 0, 1, 560, 2850);
    const occasionalDarkening = random() < 0.5 ? random(0.55, 0.9) : 1;
    const cutoff = constrain(baseCutoff * occasionalDarkening, 420, 3200);
    this.sampleEngine.lowpass.frequency.cancelScheduledValues(time);
    this.sampleEngine.lowpass.frequency.setValueAtTime(this.sampleEngine.lowpass.frequency.value || cutoff, time);
    this.sampleEngine.lowpass.frequency.rampTo(cutoff, 0.18);
    this.sampleEngine.highpass.frequency.setValueAtTime(random() < 0.25 ? 120 : 70, time);
    if (this.sampleEngine.sampleDistortion) this.sampleEngine.sampleDistortion.distortion = constrain(map(event.texture || 0.3, 0, 1, 0.003, 0.028), 0.003, 0.032);
  }

  startSampleVoice(sourcePlayer, time, volume, playbackRate, offset = 0, duration = null, reverse = false, skipTrim = false) {
    const isTextSample = sourcePlayer.samplePath && sourcePlayer.samplePath.includes("/text/");
    if (isTextSample) this.stopTextSampleVoices(time);
    if (!skipTrim) this.trimSampleVoices(time, 5);
    if (isTextSample) this.trimSampleVoices(time, 0);
    const voice = new Tone.Player({
      url: sourcePlayer.buffer,
      fadeIn: 0.025,
      fadeOut: 0.18,
      loop: false,
      playbackRate,
      reverse,
      onstop: () => {
        this.sampleEngine.activeVoices.delete(voice);
        voice.dispose();
      },
    }).connect(this.sampleEngine.gain);
    voice.volume.value = constrain(volume, -32, -8.5);
    voice.samplePath = sourcePlayer.samplePath || "";
    voice.isTextSample = isTextSample;
    this.sampleEngine.activeVoices.add(voice);
    const sourceDuration = sourcePlayer.buffer && Number.isFinite(sourcePlayer.buffer.duration) ? sourcePlayer.buffer.duration : 10;
    const safeOffset = constrain(offset || 0, 0, max(0, sourceDuration - 0.04));
    const remaining = max(0.04, sourceDuration - safeOffset);
    const safeDuration = duration === "full"
      ? remaining
      : duration === null
        ? min(remaining, max(3, min(remaining, 8)))
        : constrain(duration, min(3, remaining), remaining);
    voice.start(time, safeOffset, safeDuration);
    voice.stop(time + safeDuration / max(0.01, playbackRate) + 0.12);
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
      this.loopEngine.activeDroneNotes = [];
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
