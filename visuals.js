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
    this.oneFingerTrail = [];
    this.oneFingerTextLayer = null;
    this.oneFingerLayerSize = { width: 0, height: 0 };
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

    if (activeKey === "loopCreator" && isFinitePoint(gesturePoint)) {
      this.addOneFingerTrail(gesturePoint);
    }

    if (activeKey && activeKey !== "loopCreator" && isFinitePoint(gesturePoint)) {
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
    if (activeProcessKey === "loopCreator") {
      this.drawOneFingerVisual();
      return;
    }

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
    if (key === "loopCreator") return;
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
    if (activeProcessKey === "loopCreator") return;
    for (const object of this.audioObjects) {
      object.display(analysis || audioAnalysis);
    }
  }

  addOneFingerTrail(point) {
    this.oneFingerTrail.push({
      x: point.x,
      y: point.y,
      hue: frameCount * 4.5,
      life: 1,
    });

    while (this.oneFingerTrail.length > 33) this.oneFingerTrail.shift();
  }

  ensureOneFingerTextLayer() {
    if (this.oneFingerTextLayer && this.oneFingerLayerSize.width === width && this.oneFingerLayerSize.height === height) return;
    this.oneFingerTextLayer = createGraphics(width, height);
    this.oneFingerLayerSize = { width, height };
    this.drawOneFingerTextLayer();
  }

  drawOneFingerTextLayer() {
    if (!this.oneFingerTextLayer) return;
    this.oneFingerTextLayer.clear();
    this.oneFingerTextLayer.textAlign(CENTER, CENTER);
    this.oneFingerTextLayer.textFont("monospace");
    this.oneFingerTextLayer.textStyle(BOLD);
    this.oneFingerTextLayer.textSize(min(width, height) * 0.12);
    this.oneFingerTextLayer.fill(255, 90);
    this.oneFingerTextLayer.noStroke();
    this.oneFingerTextLayer.text("ONLY THUMB", width / 2, height / 2);
  }

  eraseOneFingerText() {
    this.ensureOneFingerTextLayer();
    this.drawOneFingerTextLayer();
    this.oneFingerTextLayer.erase();

    const eraseSize = min(width, height) * 0.18;
    for (let i = 0; i < this.oneFingerTrail.length; i++) {
      const p = this.oneFingerTrail[i];
      const age = (i + 1) / max(1, this.oneFingerTrail.length);
      this.oneFingerTextLayer.ellipse(p.x, p.y, eraseSize * age, eraseSize * age);
    }

    this.oneFingerTextLayer.noErase();
  }

  drawOneFingerLightTrail() {
    blendMode(ADD);
    colorMode(HSB, 360, 100, 100, 100);

    const maxSize = min(width, height) * 0.18;
    for (let i = 0; i < this.oneFingerTrail.length; i++) {
      const p = this.oneFingerTrail[i];
      const age = (i + 1) / max(1, this.oneFingerTrail.length);
      const size = maxSize * age;
      const opacity = age * 25;
      p.life *= 0.96;

      for (let r = size; r > 0; r -= 8) {
        const fade = pow(r / max(1, size), 2.2);
        const alpha = opacity * (1 - fade) * p.life;
        const wobbleX = noise(i * 0.2, frameCount * 0.01) * 30 - 15;
        const wobbleY = noise(i * 0.2 + 100, frameCount * 0.01) * 30 - 15;

        fill((p.hue + r * 0.8 + i * 8) % 360, 70, 100, alpha);
        ellipse(p.x + wobbleX, p.y + wobbleY, r * 1.15, r);
      }
    }

    colorMode(RGB, 255, 255, 255, 255);
    blendMode(BLEND);
  }

  drawOneFingerVisual() {
    background(5, 5, 6);
    this.eraseOneFingerText();
    this.drawOneFingerLightTrail();
    image(this.oneFingerTextLayer, 0, 0);
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
        const point = getOpenFingerPoint(leftHand, key);
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
