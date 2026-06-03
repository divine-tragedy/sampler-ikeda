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
    this.textMask = null;
    this.nextTextMask = null;
    this.threeTextMask = null;
    this.fourTextMask = null;
    this.paintMask = null;
    this.percussionTextMask = null;
    this.percussionPaintMask = null;
    this.maskSize = { width: 0, height: 0 };
    this.lastPaintPoint = null;
    this.lastPercussionPaintPoint = null;
    this.lastPercussionPaintPoints = { left: null, right: null, gesture: null };
    this.currentFingerPoint = null;
    this.fillProgress = 0;
    this.transitionProgress = 0;
    this.nextPromptActive = false;
    this.oneFingerStartedAt = null;
    this.percussionDots = [];
    this.twoFingerPoints = [];
    this.twoFingerStartedAt = null;
    this.percussionLoopCount = 0;
    this.threePromptReadyAt = null;
    this.threePromptProgress = 0;
    this.threePromptStartedAt = null;
    this.fourPromptProgress = 0;
    this.stageLevel = 1;
    this.spacing = 6;
    this.dotSize = 3.2;
    this.reactionRipples = [];
    this.clickDiffusionLayer = null;
    this.clickDiffusionFeedback = null;
    this.textDisplacementMemory = new Map();
    this.sampleHandTrails = { left: [], right: [] };
    this.leadVhsLayer = null;
    this.leadVhsParticles = [];
    this.lastLeadVhsPoint = null;
    this.leadVhsLagPoint = null;
    this.leadVhsTrail = [];
  }

  update(activeKey, layerState, analysis, gesturePoint, activeFinger) {
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
    this.updateActivatedStage(activeKey);

    if (activeKey === "loopCreator" && isFinitePoint(gesturePoint)) {
      this.updatePaintMask(gesturePoint);
      this.addReactionRipple(gesturePoint);
    } else {
      this.currentFingerPoint = null;
    }
    if (activeKey === "texture") this.updateClickDiffusion(gesturePoint);
    if (activeKey === "motion") this.updatePercussionFluidPaint(gesturePoint);
    this.twoFingerPoints = activeKey === "motion" && activeFinger && activeFinger.points ? activeFinger.points : [];
    if (activeKey === "motion" && this.twoFingerStartedAt === null) this.twoFingerStartedAt = millis();

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

  updateActivatedStage(activeKey) {
    const stageMap = { loopCreator: 1, motion: 2, texture: 3, space: 4, decay: 5 };
    const stage = stageMap[activeKey] || 0;
    if (stage > this.stageLevel) this.stageLevel = stage;
  }

  drawBackground(gridVisible) {
    this.drawOneFingerVisual();
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
    if (event.loopMemoryId) {
      const anchor = "loop-" + event.loopMemoryId;
      let object = this.audioObjects.find((item) => item.anchor === anchor);
      if (!object) {
        object = new ReactiveGestureVisual(key, point, anchor);
        this.audioObjects.push(object);
      }
      object.updateTarget(point);
      object.hold = constrain((event.velocity || 0.5) + this.globalAmp, 0.24, 1);
      object.life = object.maxLife;
      return;
    }
    const object = new ReactiveGestureVisual(key, point, event.type || "event");
    object.hold = constrain((event.velocity || 0.5) + this.globalAmp, 0.18, 1);
    object.life = event.type === "lead" ? 56 : 104;
    object.radius *= event.type === "chord" ? 1.55 : event.type === "sample" ? 1.3 : 1;
    this.audioObjects.push(object);
    while (this.audioObjects.length > 18) this.audioObjects.shift();
  }

  drawAudioReactiveLayer(analysis) {
    for (const object of this.audioObjects) {
      object.display(analysis || audioAnalysis);
    }
  }

  drawOneFingerVisual() {
    this.ensureOneFingerMasks();
    if (activeProcessKey === "motion") {
      this.drawPercussionFluidVisual();
      const drawn = this.drawStoredPercussionDots();
      if (!drawn) this.drawTwoFingerEchoes();
      return;
    }
    if (activeProcessKey === "space") {
      this.drawLeadVhsVisual();
      this.drawStoredPercussionDots();
      return;
    }
    this.updateOneFingerTransition();
    this.drawReactionDiffusionLayer();
    this.drawDottedFluidPattern();
    if (activeProcessKey === "texture") this.drawClickDiffusionLayer();
    const hasCurrentLoopDot = this.percussionDots.some((dot) => dot.key === activeProcessKey);
    if (activeProcessKey === "motion" || hasCurrentLoopDot) {
      const drawn = this.drawStoredPercussionDots();
      if (activeProcessKey === "motion" && !drawn) this.drawTwoFingerEchoes();
    } else {
      this.drawOneFingerEcho();
    }
    this.drawThreeFingerPrompt();
  }

  ensureOneFingerMasks() {
    if (this.textMask && this.paintMask && this.maskSize.width === width && this.maskSize.height === height) return;
    this.textMask = createGraphics(width, height);
    this.nextTextMask = createGraphics(width, height);
    this.threeTextMask = createGraphics(width, height);
    this.fourTextMask = createGraphics(width, height);
    this.paintMask = createGraphics(width, height);
    this.percussionTextMask = createGraphics(width, height);
    this.percussionPaintMask = createGraphics(width, height);
    this.clickDiffusionLayer = createGraphics(width, height);
    this.clickDiffusionFeedback = createGraphics(width, height);
    this.leadVhsLayer = createGraphics(width, height);
    this.textMask.pixelDensity(1);
    this.nextTextMask.pixelDensity(1);
    this.threeTextMask.pixelDensity(1);
    this.fourTextMask.pixelDensity(1);
    this.paintMask.pixelDensity(1);
    this.percussionTextMask.pixelDensity(1);
    this.percussionPaintMask.pixelDensity(1);
    this.clickDiffusionLayer.pixelDensity(1);
    this.clickDiffusionFeedback.pixelDensity(1);
    this.leadVhsLayer.pixelDensity(1);
    this.paintMask.background(0);
    this.percussionPaintMask.background(0);
    this.clickDiffusionLayer.clear();
    this.clickDiffusionFeedback.clear();
    this.leadVhsLayer.background(0);
    this.textDisplacementMemory.clear();
    this.sampleHandTrails = { left: [], right: [] };
    this.leadVhsParticles = [];
    this.lastLeadVhsPoint = null;
    this.leadVhsLagPoint = null;
    this.leadVhsTrail = [];
    this.maskSize = { width, height };
    this.lastPaintPoint = null;
    this.lastPercussionPaintPoint = null;
    this.lastPercussionPaintPoints = { left: null, right: null, gesture: null };
    this.currentFingerPoint = null;
    this.fillProgress = 0;
    this.transitionProgress = 0;
    this.nextPromptActive = false;
    this.oneFingerStartedAt = null;
    this.twoFingerStartedAt = null;
    this.threePromptReadyAt = null;
    this.threePromptStartedAt = null;
    this.threePromptProgress = 0;
    this.fourPromptProgress = 0;
    this.stageLevel = 1;
    this.drawStatementTextMask(this.textMask, "choose a", "box above");
    this.drawStatementTextMask(this.nextTextMask, "russia is a", "terrorist state");
    this.drawStatementTextMask(this.threeTextMask, "russia is a", "terrorist state");
    this.drawStatementTextMask(this.fourTextMask, "russia is a", "terrorist state");
    this.drawPercussionTextMask();
  }

  drawTextMask(mask, topLine, bottomLine) {
    mask.background(0);
    mask.fill(255);
    mask.noStroke();
    mask.textAlign(CENTER, CENTER);
    mask.textStyle(BOLD);
    if (bottomLine) {
      const longest = max(topLine.length, bottomLine.length);
      const fittedSize = min(width * 0.18, (width * 0.86) / max(1, longest) * 1.55, height * 0.22);
      mask.textSize(fittedSize);
      mask.text(topLine, width / 2, height / 2 - width * 0.07);
      mask.text(bottomLine, width / 2, height / 2 + width * 0.1);
    } else {
      mask.textSize(width * 0.115);
      mask.text(topLine, width / 2, height / 2);
    }
    mask.loadPixels();
  }

  drawStatementTextMask(mask, topLine, bottomLine) {
    mask.background(0);
    mask.fill(255);
    mask.noStroke();
    mask.textAlign(CENTER, CENTER);
    mask.textStyle(BOLD);
    const longest = max(topLine.length, bottomLine.length);
    const fittedSize = min(width * 0.27, (width * 0.94) / max(1, longest) * 1.92, height * 0.31);
    const gap = fittedSize * 0.78;
    mask.textSize(fittedSize);
    mask.text(topLine, width / 2, height / 2 - gap * 0.52);
    mask.text(bottomLine, width / 2, height / 2 + gap * 0.52);
    mask.loadPixels();
  }

  drawPercussionTextMask() {
    if (!this.percussionTextMask) return;
    const mask = this.percussionTextMask;
    mask.background(0);
    mask.fill(255);
    mask.noStroke();
    mask.textAlign(CENTER, CENTER);
    mask.textStyle(BOLD);
    const topLine = "russia is a";
    const bottomLine = "terrorist state";
    const longest = max(topLine.length, bottomLine.length);
    const fittedSize = min(width * 0.27, (width * 0.94) / max(1, longest) * 1.92, height * 0.31);
    const gap = fittedSize * 0.78;
    mask.textSize(fittedSize);
    mask.text(topLine, width / 2, height / 2 - gap * 0.52);
    mask.text(bottomLine, width / 2, height / 2 + gap * 0.52);
    mask.loadPixels();
  }

  updatePercussionFluidPaint(gesturePoint) {
    this.ensureOneFingerMasks();
    const points = [];
    if (typeof bodyLeftWrist !== "undefined" && isFinitePoint(bodyLeftWrist)) points.push({ point: bodyLeftWrist, key: "left" });
    if (typeof bodyRightWrist !== "undefined" && isFinitePoint(bodyRightWrist)) points.push({ point: bodyRightWrist, key: "right" });
    if (!points.length && isFinitePoint(gesturePoint)) points.push({ point: gesturePoint, key: "gesture" });
    for (const item of points) {
      const point = item.point;
      const previous = this.lastPercussionPaintPoints[item.key] || point;
      if (dist(point.x, point.y, previous.x, previous.y) > 1) {
        for (let i = 0; i < 8; i++) {
          const t = i / 7;
          this.drawPercussionFluidBrush(lerp(previous.x, point.x, t), lerp(previous.y, point.y, t));
        }
      } else {
        this.drawPercussionFluidBrush(point.x, point.y);
      }
      this.lastPercussionPaintPoints[item.key] = { x: point.x, y: point.y };
    }
    this.percussionPaintMask.filter(BLUR, 2);
    this.percussionPaintMask.loadPixels();
  }

  drawPercussionFluidBrush(cx, cy) {
    const mask = this.percussionPaintMask;
    if (!mask) return;
    mask.noStroke();
    for (let i = 0; i < 7; i++) {
      const angle = random(TWO_PI);
      const radius = random(10, 70);
      const x = cx + cos(angle) * radius;
      const y = cy + sin(angle) * radius;
      const w = random(70, 150);
      const h = random(35, 100);
      mask.push();
      mask.translate(x, y);
      mask.rotate(random(TWO_PI));
      mask.fill(255, 55);
      mask.ellipse(0, 0, w, h);
      mask.pop();
    }
  }

  drawPercussionFluidVisual() {
    this.ensureOneFingerMasks();
    background(255);
    this.drawPercussionTextMask();
    this.percussionTextMask.loadPixels();
    this.percussionPaintMask.loadPixels();
    noStroke();
    const spacing = 4;
    const dotSize = 2.7;
    for (let x = 0; x < width; x += spacing) {
      for (let y = 0; y < height; y += spacing) {
        const index = 4 * (x + y * width);
        const textValue = this.percussionTextMask.pixels[index];
        const paintValue = this.percussionPaintMask.pixels[index];
        const paintAmount = paintValue / 255;
        const insideText = textValue > 100;
        const insidePaint = paintAmount > 0.2;
        const weakPaint = paintAmount > 0.12 && paintAmount <= 0.2;
        const blink = (sin(frameCount * 0.12 + x * 0.07 + y * 0.041 + noise(x * 0.03, y * 0.03) * 9) + 1) * 0.5;
        const blinkingWeakPaint = weakPaint && blink > 0.38;
        const textWasTouched = insideText && insidePaint;
        const visibleShape = insidePaint || blinkingWeakPaint || (insideText && !textWasTouched);
        if (!visibleShape) continue;

        const packed = this.applyPercussionPacking(x, y);
        const flowA = noise(x * 0.006, y * 0.006, frameCount * 0.002);
        const flowB = noise(x * 0.014 + 200, y * 0.014 - 100, frameCount * 0.001);
        const wave = sin(flowA * 75 + flowB * 25 + x * 0.018 + y * 0.006 + frameCount * 0.025);
        const greyWave = sin(flowA * 60 + flowB * 20 + x * 0.014 - y * 0.01 + frameCount * 0.02);
        const paintEdge = paintAmount > 0.2 && paintAmount < 0.5;
        const drawBlackDot = wave > 0.18;
        const drawGreyDot = greyWave > 0.05 || paintEdge || blinkingWeakPaint;

        if (insideText && !insidePaint) {
          fill(0);
          circle(packed.x, packed.y, dotSize);
        } else if (drawBlackDot) {
          fill(0, blinkingWeakPaint ? 95 + blink * 110 : 255);
          circle(packed.x, packed.y, blinkingWeakPaint ? dotSize * 0.72 : dotSize);
        } else if (drawGreyDot) {
          fill(150, blinkingWeakPaint ? 75 + blink * 120 : 255);
          circle(packed.x, packed.y, blinkingWeakPaint ? dotSize * 0.62 : dotSize * 0.95);
        }
      }
    }
  }

  updatePaintMask(point) {
    this.ensureOneFingerMasks();
    if (this.oneFingerStartedAt === null) this.oneFingerStartedAt = millis();
    this.currentFingerPoint = { x: point.x, y: point.y };
    const previous = this.lastPaintPoint || point;
    if (dist(point.x, point.y, previous.x, previous.y) > 1) {
      for (let i = 0; i < 4; i++) {
        const t = i / 3;
        const x = lerp(previous.x, point.x, t);
        const y = lerp(previous.y, point.y, t);
        this.drawFluidBrush(x, y);
      }
    } else {
      this.drawFluidBrush(point.x, point.y);
    }
    this.lastPaintPoint = { x: point.x, y: point.y };
  }

  drawFluidBrush(cx, cy) {
    this.paintMask.noStroke();
    for (let i = 0; i < 5; i++) {
      const angle = random(TWO_PI);
      const radius = random(8, 43);
      const x = cx + cos(angle) * radius;
      const y = cy + sin(angle) * radius;
      const w = random(48, 95);
      const h = random(27, 66);
      this.paintMask.push();
      this.paintMask.translate(x, y);
      this.paintMask.rotate(random(TWO_PI));
      this.paintMask.fill(255, 55);
      this.paintMask.ellipse(0, 0, w, h);
      this.paintMask.pop();
    }
  }

  drawOneFingerEcho() {
    if (!isFinitePoint(this.currentFingerPoint)) return;
    this.drawUnifiedWobblyCircle(this.currentFingerPoint.x, this.currentFingerPoint.y, 30, this.getHandContrastColor("right"), 0.9, frameCount * 0.01);
  }

  drawTwoFingerEchoes() {
    const pulse = (sin(frameCount * 0.22) + 1) * 0.5;
    for (let i = 0; i < this.twoFingerPoints.length; i++) {
      const item = this.twoFingerPoints[i];
      if (!isFinitePoint(item.point)) continue;
      noFill();
      for (let echo = 0; echo < 3; echo++) {
        stroke(35, 112, 255, 125 - echo * 28);
        strokeWeight(max(1, 2.4 - echo * 0.35));
        circle(item.point.x, item.point.y, 20 + echo * 14 + pulse * 8);
      }
      noStroke();
      fill(35, 112, 255, 230);
      circle(item.point.x, item.point.y, 10 + pulse * 2);
    }

    if (!rightPinchActive) return;
    const point = this.getTwoFingerCenter();
    if (!isFinitePoint(point)) return;
    noFill();
    for (let i = 0; i < 4; i++) {
      stroke(35, 112, 255, 150 - i * 28);
      strokeWeight(max(1, 3 - i * 0.45));
      circle(point.x, point.y, 42 + i * 24 + pulse * 18);
    }
    noStroke();
    fill(35, 112, 255, 230);
    circle(point.x, point.y, 16 + pulse * 4);
  }

  getTwoFingerCenter() {
    if (!this.twoFingerPoints.length) return null;
    let x = 0;
    let y = 0;
    let count = 0;
    for (const item of this.twoFingerPoints) {
      if (!isFinitePoint(item.point)) continue;
      x += item.point.x;
      y += item.point.y;
      count++;
    }
    return count ? { x: x / count, y: y / count } : null;
  }

  updateOneFingerTransition() {
    if (this.stageLevel >= 2) this.nextPromptActive = true;
    if (this.stageLevel >= 3) {
      this.threePromptProgress = lerp(this.threePromptProgress, 1, 0.035);
      if (this.threePromptStartedAt === null && this.threePromptProgress > 0.92) this.threePromptStartedAt = millis();
    }
    const persistentStatementActive = activeProcessKey && activeProcessKey !== "loopCreator";
    if (persistentStatementActive || this.stageLevel >= 4) {
      this.fourPromptProgress = lerp(this.fourPromptProgress, 1, 0.035);
    }
    const target = this.nextPromptActive ? 1 : 0;
    this.transitionProgress = lerp(this.transitionProgress, target, 0.035);
    if (activeProcessKey === "texture") {
      background(220, 24, 24);
      return;
    }
    if (activeProcessKey === "space") {
      background(20, 64, 210);
      return;
    }
    const baseBg = lerp(255, 0, this.transitionProgress);
    const redBg = color(220, 24, 24);
    const fourBg = color(0);
    const stageBg = lerpColor(color(baseBg), redBg, this.threePromptProgress);
    background(lerpColor(stageBg, fourBg, this.fourPromptProgress));
  }

  measurePaintCoverage() {
    this.paintMask.loadPixels();
    let filled = 0;
    let total = 0;
    for (let x = 0; x < width; x += this.spacing * 3) {
      for (let y = 0; y < height; y += this.spacing * 3) {
        const index = 4 * (x + y * width);
        if (this.paintMask.pixels[index] > 35) filled++;
        total++;
      }
    }
    return total ? filled / total : 0;
  }

  drawDottedFluidPattern() {
    this.textMask.loadPixels();
    this.nextTextMask.loadPixels();
    this.paintMask.loadPixels();
    noStroke();

    for (let x = 0; x < width; x += this.spacing) {
      for (let y = 0; y < height; y += this.spacing) {
        const index = 4 * (x + y * width);
        const textValue = this.textMask.pixels[index];
        const nextTextValue = this.nextTextMask.pixels[index];
        const paintValue = this.paintMask.pixels[index];
        const insideText = textValue > 100;
        const insideNextText = nextTextValue > 100;
        const insidePaint = paintValue > 35;
        const textWasTouched = insideText && insidePaint;
        const statementAlpha = constrain(this.fourPromptProgress, 0, 1);
        const nextTextAlpha = 1 - statementAlpha;
        const showNextText = insideNextText && this.transitionProgress > 0.02 && nextTextAlpha > 0.03;
        const previousAlpha = (1 - this.threePromptProgress * 0.32) * nextTextAlpha;
        const visibleShape = insidePaint || (insideText && !textWasTouched) || showNextText;
        if (!visibleShape) continue;
        const displaced = this.applyHandTextDisplacement(this.applyPercussionPacking(x, y));
        if (showNextText) {
          const nextColor = this.getModeDotColor("next");
          fill(nextColor[0], nextColor[1], nextColor[2], 255 * previousAlpha);
          circle(displaced.x, displaced.y, this.dotSize * 1.35);
          continue;
        }
        if (insideText && !insidePaint) {
          const textColor = this.getModeDotColor("text");
          fill(textColor[0], textColor[1], textColor[2], 255 * (1 - this.transitionProgress) * previousAlpha);
          circle(displaced.x, displaced.y, this.dotSize);
          continue;
        }

        const glitchBoost = activeProcessKey === "texture" ? 1.75 : 1;
        const flowA = noise(x * 0.006 * glitchBoost, y * 0.006, frameCount * 0.002 * glitchBoost);
        const flowB = noise(x * 0.014 * glitchBoost + 200, y * 0.014 - 100, frameCount * 0.001 * glitchBoost);
        const wave = sin(flowA * 75 + flowB * 25 + x * 0.018 * glitchBoost + y * 0.006 + frameCount * 0.025 * glitchBoost);
        const greyWave = sin(flowA * 60 + flowB * 20 + x * 0.014 * glitchBoost - y * 0.01 + frameCount * 0.02 * glitchBoost);
        const paintEdge = paintValue > 35 && paintValue < 125;
        const drawBlackDot = wave > 0.18;
        const drawGreyDot = greyWave > 0.05 || paintEdge;

        if (drawBlackDot) {
          const c = this.getModeDotColor("text");
          fill(c[0], c[1], c[2], 255 * previousAlpha);
          circle(displaced.x, displaced.y, this.dotSize);
        } else if (drawGreyDot) {
          const c = this.getModeDotColor("grey");
          fill(c[0], c[1], c[2], 255 * previousAlpha);
          circle(displaced.x, displaced.y, this.dotSize * 0.95);
        }
      }
    }
  }

  getModeDotColor(kind) {
    if (activeProcessKey === "texture") return kind === "grey" ? [45, 0, 0] : [0, 0, 0];
    if (activeProcessKey === "space") return [255, 214, 26];
    const v = kind === "grey" ? lerp(150, 105, this.transitionProgress) : lerp(0, 255, this.transitionProgress);
    return [v, v, v];
  }

  applyHandTextDisplacement(point) {
    const key = floor(point.x / 6) + ":" + floor(point.y / 6);
    let memory = this.textDisplacementMemory.get(key);
    if (!memory) {
      memory = { dx: 0, dy: 0, seen: 0 };
      this.textDisplacementMemory.set(key, memory);
    }
    let targetDx = 0;
    let targetDy = 0;
    const hands = [];
    if (typeof bodyLeftWrist !== "undefined" && isFinitePoint(bodyLeftWrist)) hands.push(bodyLeftWrist);
    if (typeof bodyRightWrist !== "undefined" && isFinitePoint(bodyRightWrist)) hands.push(bodyRightWrist);
    for (const hand of hands) {
      const distance = dist(point.x, point.y, hand.x, hand.y);
      const radius = 155;
      if (distance <= 0 || distance > radius) continue;
      const force = pow(1 - distance / radius, 2.1) * 34;
      targetDx += ((point.x - hand.x) / distance) * force;
      targetDy += ((point.y - hand.y) / distance) * force;
    }
    const hasPush = abs(targetDx) + abs(targetDy) > 0.01;
    memory.dx = lerp(memory.dx, targetDx, hasPush ? 0.12 : 0.012);
    memory.dy = lerp(memory.dy, targetDy, hasPush ? 0.12 : 0.012);
    memory.seen = frameCount;
    if (frameCount % 180 === 0 && this.textDisplacementMemory.size > 9000) {
      for (const [memoryKey, item] of this.textDisplacementMemory) {
        if (frameCount - item.seen > 240) this.textDisplacementMemory.delete(memoryKey);
      }
    }
    return { x: point.x + memory.dx, y: point.y + memory.dy };
  }

  addReactionRipple(point) {
    if (!isFinitePoint(point) || frameCount % 6 !== 0) return;
    this.reactionRipples.push({
      x: point.x,
      y: point.y,
      age: 0,
      life: 220,
      radius: random(16, 34),
      seed: random(1000),
    });
    while (this.reactionRipples.length > 28) this.reactionRipples.shift();
  }

  drawReactionDiffusionLayer() {
    if (!this.reactionRipples.length) return;
    noFill();
    blendMode(ADD);
    for (let i = this.reactionRipples.length - 1; i >= 0; i--) {
      const ripple = this.reactionRipples[i];
      ripple.age++;
      const life = 1 - ripple.age / ripple.life;
      if (life <= 0) {
        this.reactionRipples.splice(i, 1);
        continue;
      }
      const rings = 5;
      for (let r = 0; r < rings; r++) {
        const radius = ripple.radius + ripple.age * (0.18 + r * 0.035) + r * 17;
        const alpha = 48 * life * (1 - r / rings);
        stroke(255, 255, 255, alpha);
        strokeWeight(0.7 + life * 0.8);
        beginShape();
        for (let a = 0; a <= TWO_PI + 0.12; a += 0.16) {
          const wobble = (noise(cos(a) * 0.8 + ripple.seed, sin(a) * 0.8, frameCount * 0.006 + r) - 0.5) * 18 * life;
          vertex(ripple.x + cos(a) * (radius + wobble), ripple.y + sin(a) * (radius + wobble));
        }
        endShape();
      }
    }
    blendMode(BLEND);
  }

  updateClickDiffusion(gesturePoint) {
    this.ensureOneFingerMasks();
    const g = this.clickDiffusionLayer;
    const feedback = this.clickDiffusionFeedback;
    if (!g || !feedback) return;

    feedback.clear();
    feedback.push();
    feedback.tint(255, 242);
    feedback.image(g, -2.6, -2.2, width + 5.2, height + 4.4);
    feedback.tint(255, 78);
    for (let i = 0; i < 7; i++) {
      const stripY = floor(noise(i * 13.7, frameCount * 0.035) * height);
      const stripH = 4 + floor(noise(i * 9.1, frameCount * 0.02) * 18);
      const shift = (noise(i * 19.3, frameCount * 0.05) - 0.5) * 46;
      feedback.copy(g, 0, stripY, width, stripH, shift, stripY, width, stripH);
    }
    feedback.pop();

    g.clear();
    g.push();
    g.image(feedback, 0, 0);
    g.drawingContext.globalCompositeOperation = "destination-out";
    g.noStroke();
    g.fill(0, 0, 0, 7);
    g.rect(0, 0, width, height);
    g.drawingContext.globalCompositeOperation = "source-over";
    g.pop();

    const hands = [];
    if (typeof bodyLeftWrist !== "undefined" && isFinitePoint(bodyLeftWrist)) hands.push({ ...bodyLeftWrist, seed: 13 });
    if (typeof bodyRightWrist !== "undefined" && isFinitePoint(bodyRightWrist)) hands.push({ ...bodyRightWrist, seed: 71 });
    if (!hands.length && isFinitePoint(gesturePoint)) hands.push({ ...gesturePoint, seed: 37 });
    for (const hand of hands) this.addClickDiffusionMark(hand.x, hand.y, 0.68, hand.seed);
  }

  addClickDiffusionBurst(x, y, strength = 1) {
    this.ensureOneFingerMasks();
    this.addClickDiffusionMark(x, y, strength, random(1000));
  }

  addClickDiffusionMark(x, y, strength = 1, seed = 0) {
    const g = this.clickDiffusionLayer;
    if (!g || !Number.isFinite(x) || !Number.isFinite(y)) return;
    const pulse = 0.86 + this.globalAmp * 2.1;
    const scale = strength * pulse;
    g.push();
    g.noStroke();
    g.blendMode(MULTIPLY);
    for (let i = 0; i < 22; i++) {
      const glitch = noise(seed + 31, i * 0.61, frameCount * 0.06) > 0.72 ? random(-34, 34) : 0;
      const angle = noise(seed + i * 0.17, frameCount * 0.018) * TWO_PI * 2;
      const radius = pow(noise(seed + 4, i * 0.23, frameCount * 0.014), 1.45) * 118 * scale;
      const px = x + cos(angle) * radius + glitch;
      const py = y + sin(angle) * radius;
      const w = (12 + noise(seed + 9, i, frameCount * 0.012) * 42) * scale;
      const h = (5 + noise(seed + 15, i, frameCount * 0.012) * 22) * scale;
      const alpha = (8 + noise(seed + 22, i) * 26) * constrain(strength, 0.25, 1.6);
      g.fill(0, 0, 0, alpha);
      g.push();
      g.translate(px, py);
      g.rotate(angle + frameCount * 0.004);
      if (i % 3 === 0) {
        g.noFill();
        g.stroke(0, 0, 0, alpha * 1.6);
        g.strokeWeight(0.9 + scale * 0.18);
        g.ellipse(0, 0, w * 1.2, h * 1.4);
        g.noStroke();
      } else {
        g.fill(0, 0, 0, alpha);
        g.ellipse(0, 0, w, h);
      }
      g.pop();
    }
    for (let r = 0; r < 4; r++) {
      g.noFill();
      g.stroke(0, 0, 0, 42 * strength);
      g.strokeWeight(1.1 + r * 0.12);
      g.beginShape();
      const baseRadius = (30 + r * 23) * scale;
      for (let a = 0; a <= TWO_PI + 0.12; a += 0.16) {
        const wobble = (noise(cos(a) + seed, sin(a) - seed, frameCount * 0.026 + r) - 0.5) * 42 * scale;
        const glitch = noise(seed + r * 8, a * 2.5, frameCount * 0.035) > 0.82 ? random(-18, 18) : 0;
        g.vertex(x + cos(a) * (baseRadius + wobble) + glitch, y + sin(a) * (baseRadius + wobble));
      }
      g.endShape(CLOSE);
    }
    g.pop();
  }

  drawClickDiffusionLayer() {
    if (!this.clickDiffusionLayer) return;
    push();
    tint(255, 220);
    image(this.clickDiffusionLayer, 0, 0);
    pop();
  }

  ensureLeadVhsParticles() {
    this.ensureOneFingerMasks();
    if (this.leadVhsParticles.length) return;
    for (let i = 0; i < 70; i++) {
      this.leadVhsParticles.push({
        index: i,
        seed: random(1000),
        x: random(width),
        y: random(height),
        vx: random(-1, 1),
        vy: random(-1, 1),
        angle: random(TWO_PI),
        size: random(3, 14),
        orbitRadius: random(18, 86),
      });
    }
  }

  getLeadVhsTarget() {
    if (typeof bodyRightWrist !== "undefined" && isFinitePoint(bodyRightWrist)) return bodyRightWrist;
    if (typeof bodyLeftWrist !== "undefined" && isFinitePoint(bodyLeftWrist)) return bodyLeftWrist;
    return this.lastLeadVhsPoint || { x: width / 2, y: height / 2 };
  }

  drawLeadVhsVisual() {
    this.ensureLeadVhsParticles();
    const pg = this.leadVhsLayer;
    if (!pg) return;
    const target = this.getLeadVhsTarget();
    const previous = this.lastLeadVhsPoint || target;
    const handSpeed = dist(target.x, target.y, previous.x, previous.y);
    this.lastLeadVhsPoint = { x: target.x, y: target.y };
    if (!this.leadVhsLagPoint) this.leadVhsLagPoint = { x: target.x, y: target.y };
    const lagAmount = constrain(map(handSpeed, 0, 42, 0.045, 0.16), 0.045, 0.16);
    this.leadVhsLagPoint.x = lerp(this.leadVhsLagPoint.x, target.x, lagAmount);
    this.leadVhsLagPoint.y = lerp(this.leadVhsLagPoint.y, target.y, lagAmount);
    this.leadVhsTrail.push({ x: target.x, y: target.y, lagX: this.leadVhsLagPoint.x, lagY: this.leadVhsLagPoint.y, speed: handSpeed, life: 1 });
    while (this.leadVhsTrail.length > 42) this.leadVhsTrail.shift();
    const fluidTarget = this.leadVhsLagPoint;

    const feedback = 0.86;
    const blurAmount = 2;
    const redShift = 6 + constrain(handSpeed * 0.06, 0, 8);
    const speed = 0.72 + constrain(handSpeed * 0.01, 0, 1.25);
    const distortion = 8 + constrain(handSpeed * 0.24, 0, 34);
    const vhsNoise = 0.24 + constrain(handSpeed * 0.007, 0, 0.28);

    pg.push();
    pg.noStroke();
    pg.fill(0, 0, 0, 255 * (1 - feedback));
    pg.rect(0, 0, width, height);
    pg.tint(255, 30);
    pg.image(pg, -blurAmount, -blurAmount, width + blurAmount * 2, height + blurAmount * 2);
    pg.noTint();
    pg.blendMode(ADD);
    this.drawLeadSoftField(pg, fluidTarget, redShift);
    this.drawLeadDelayedTraces(pg, redShift);
    this.drawLeadDragTrail(pg, previous, target, redShift);
    for (const particle of this.leadVhsParticles) {
      this.updateLeadVhsParticle(particle, fluidTarget, speed);
      this.drawLeadVhsParticle(pg, particle, fluidTarget, redShift);
    }
    pg.blendMode(BLEND);
    pg.pop();

    this.renderLeadVhsRedshift(pg, fluidTarget, redShift, distortion, vhsNoise);
  }

  drawLeadSoftField(g, target, redShift) {
    const cell = 84;
    for (let y = cell / 2; y < height; y += cell) {
      for (let x = cell / 2; x < width; x += cell) {
        const d = dist(x, y, target.x, target.y);
        const influence = map(constrain(d, 0, 250), 250, 0, 0, 1);
        const n = noise(x * 0.004, y * 0.004, frameCount * 0.01);
        const pulse = sin(frameCount * 0.03 + x * 0.01 + y * 0.01) * 0.5 + 0.5;
        if (influence + n * 0.28 <= 0.62) continue;
        const s = cell * (0.06 + influence * 0.12 + pulse * 0.055);
        const a = 4 + influence * 18;
        g.noStroke();
        g.fill(255, 30, 15, a * 0.7);
        g.circle(x, y, s);
        g.fill(255, 120, 35, a * 0.25);
        g.circle(x, y, s * 2.2);
        g.fill(70, 220, 255, a * 0.18);
        g.circle(x - redShift * 1.4, y, s * 1.3);
      }
    }
  }

  drawLeadDragTrail(g, previous, target, redShift) {
    const d = dist(target.x, target.y, previous.x, previous.y);
    const steps = max(1, floor(d / 4));
    g.blendMode(ADD);
    for (let i = 0; i <= steps; i++) {
      const x = lerp(previous.x, target.x, i / steps);
      const y = lerp(previous.y, target.y, i / steps);
      g.noStroke();
      const wobbleX = (noise(x * 0.015, y * 0.015, frameCount * 0.02) - 0.5) * 12;
      const wobbleY = (noise(x * 0.015 + 20, y * 0.015, frameCount * 0.02) - 0.5) * 12;
      g.fill(255, 35, 15, 88);
      g.circle(x + wobbleX, y + wobbleY, 10);
      g.fill(255, 120, 35, 32);
      g.circle(x + wobbleX * 0.6, y + wobbleY * 0.6, 28);
      g.fill(80, 220, 255, 28);
      g.circle(x - redShift * 2 + wobbleX, y + wobbleY, 18);
      g.noFill();
      g.stroke(255, 180, 100, 70);
      g.strokeWeight(1.2);
      g.circle(x + wobbleX, y + wobbleY, 15);
      g.noStroke();
      g.fill(255, 240, 210, 150);
      g.circle(x + wobbleX, y + wobbleY, 3.2);
    }
  }

  drawLeadDelayedTraces(g, redShift) {
    if (!this.leadVhsTrail.length) return;
    g.blendMode(ADD);
    for (let i = 0; i < this.leadVhsTrail.length; i++) {
      const p = this.leadVhsTrail[i];
      const age = i / max(1, this.leadVhsTrail.length - 1);
      const lag = 1 - age;
      const x = lerp(p.x, p.lagX, 0.72);
      const y = lerp(p.y, p.lagY, 0.72);
      const drift = (noise(i * 0.13, frameCount * 0.018) - 0.5) * 24 * lag;
      const s = 5 + age * 10 + constrain(p.speed * 0.08, 0, 5);
      const alpha = 18 + age * 48;
      g.noStroke();
      g.fill(255, 45, 18, alpha * 0.62);
      g.circle(x + drift, y, s);
      g.fill(255, 130, 42, alpha * 0.22);
      g.circle(x + drift * 0.4, y, s * 2.1);
      g.fill(80, 220, 255, alpha * 0.18);
      g.circle(x - redShift * 1.8 + drift, y, s * 1.35);
    }
    g.noFill();
    for (let pass = 0; pass < 3; pass++) {
      g.stroke(pass === 2 ? 80 : 255, pass === 2 ? 220 : 95, pass === 2 ? 255 : 38, 24 - pass * 5);
      g.strokeWeight(0.8 + pass * 0.34);
      g.beginShape();
      for (const p of this.leadVhsTrail) {
        const wobble = (noise(p.lagX * 0.02 + pass, p.lagY * 0.02, frameCount * 0.014) - 0.5) * 18;
        curveVertex(p.lagX + wobble, p.lagY - wobble * 0.35);
      }
      g.endShape();
    }
  }

  updateLeadVhsParticle(particle, target, speed) {
    const t = frameCount * 0.008 * speed;
    const n1 = noise(particle.seed, t);
    const n2 = noise(particle.seed + 100, t);
    const n3 = noise(particle.seed + 200, t);
    particle.angle += map(n1, 0, 1, -0.045, 0.045) * speed;
    const orbitX = target.x + cos(particle.angle + particle.index * 0.16) * particle.orbitRadius * map(n2, 0, 1, 0.35, 1.2);
    const orbitY = target.y + sin(particle.angle * 1.35 + particle.index * 0.11) * particle.orbitRadius * map(n3, 0, 1, 0.35, 1.2);
    particle.vx += (orbitX - particle.x) * 0.045;
    particle.vy += (orbitY - particle.y) * 0.045;
    particle.vx += map(noise(particle.seed + 300, t), 0, 1, -0.22, 0.22);
    particle.vy += map(noise(particle.seed + 400, t), 0, 1, -0.22, 0.22);
    particle.vx *= 0.86;
    particle.vy *= 0.86;
    particle.x += particle.vx * speed;
    particle.y += particle.vy * speed;
    if (particle.x < -120) particle.x = width + 120;
    if (particle.x > width + 120) particle.x = -120;
    if (particle.y < -120) particle.y = height + 120;
    if (particle.y > height + 120) particle.y = -120;
  }

  drawLeadVhsParticle(g, particle, target, redShift) {
    const pulse = sin(frameCount * 0.05 + particle.index) * 0.5 + 0.5;
    const d = dist(particle.x, particle.y, target.x, target.y);
    const closeBoost = map(constrain(d, 0, 190), 190, 0, 0, 1);
    const s = particle.size + pulse * 5 + closeBoost * 7;
    const alpha = 14 + pulse * 40 + closeBoost * 56;
    g.noStroke();
    g.fill(255, 35, 15, alpha);
    g.circle(particle.x, particle.y, s);
    g.fill(255, 120, 30, alpha * 0.28);
    g.circle(particle.x, particle.y, s * 2.8);
    g.fill(80, 220, 255, alpha * 0.2);
    g.circle(particle.x - redShift * 1.8, particle.y, s * 1.5);
    g.noFill();
    g.stroke(255, 170, 80, alpha * 0.35);
    g.strokeWeight(1.5);
    g.circle(particle.x, particle.y, s * 1.1);
    g.noStroke();
    g.fill(255, 235, 200, alpha * 0.6);
    g.circle(particle.x, particle.y, max(4, s * 0.2));
  }

  renderLeadVhsRedshift(pg, target, redShift, distortion, vhsNoise) {
    background(0);
    const sliceH = 3;
    for (let y = 0; y < height; y += sliceH) {
      const tracking = sin(y * 0.03 + frameCount * 0.04) * distortion;
      const n = noise(y * 0.012, frameCount * 0.018);
      const tapeJitter = map(n, 0, 1, -distortion, distortion);
      let handWarp = 0;
      const d = abs(y - target.y);
      if (d < 180) {
        handWarp = map(d, 0, 180, distortion * 1.1, 0);
        handWarp *= sin(frameCount * 0.08 + y * 0.05);
      }
      const offset = tracking * 0.35 + tapeJitter * 0.65 + handWarp;
      tint(255, 30, 18, 230);
      image(pg, redShift + offset, y, width, sliceH, 0, y, width, sliceH);
      tint(255, 120, 45, 135);
      image(pg, redShift * 0.35 + offset * 0.35, y, width, sliceH, 0, y, width, sliceH);
      tint(40, 220, 255, 95);
      image(pg, -redShift * 0.8 - offset * 0.45, y, width, sliceH, 0, y, width, sliceH);
      tint(255, 220);
      image(pg, offset * 0.08, y, width, sliceH, 0, y, width, sliceH);
    }
    noTint();
    this.drawLeadVhsNoise(vhsNoise);
  }

  drawLeadVhsNoise(vhsNoise) {
    push();
    if (random() < 0.2 * vhsNoise) {
      const y = random(height);
      const h = random(5, 28);
      const shift = random(-90, 90) * vhsNoise;
      copy(0, y, width, h, shift, y + random(-8, 8), width, h);
    }
    noStroke();
    for (let i = 0; i < 14 * vhsNoise; i++) {
      const y = floor(random(height) / 6) * 6;
      const x = floor(random(width) / 12) * 12;
      fill(random() < 0.5 ? color(255, 40, 25, random(18, 65)) : color(80, 230, 255, random(12, 50)));
      rect(x, y, random(20, 180), random(2, 8));
    }
    strokeWeight(1);
    for (let y = 0; y < height; y += 3) {
      stroke(0, 70);
      line(0, y, width, y);
    }
    for (let y = 1; y < height; y += 6) {
      stroke(255, 10);
      line(0, y, width, y);
    }
    for (let i = 0; i < 20 * vhsNoise; i++) {
      stroke(255, random(8, 30));
      const x = random(width);
      line(x, random(height), x + random(-8, 8), random(height));
    }
    noStroke();
    fill(255, 255, 255, 15 * vhsNoise);
    rect(0, 22 + sin(frameCount * 0.08) * 6, width, 4);
    fill(0, 0, 0, 90);
    rect(0, height - 20, width, 20);
    noFill();
    for (let i = 0; i < 120; i++) {
      stroke(0, map(i, 0, 120, 0, 13));
      rect(i, i, width - i * 2, height - i * 2);
    }
    pop();
  }

  getHandContrastColor(side) {
    if (activeProcessKey === "space") return [255, 36, 30];
    if (activeProcessKey === "texture") return side === "left" ? [35, 112, 255] : [255, 255, 255];
    return side === "left" ? [35, 112, 255] : [255, 214, 26];
  }

  drawUnifiedWobblyCircle(x, y, baseRadius, rgb, strength, seed) {
    noFill();
    for (let echo = 0; echo < 4; echo++) {
      const alpha = (140 - echo * 26) * strength;
      stroke(rgb[0], rgb[1], rgb[2], alpha);
      strokeWeight(max(0.7, 1.8 - echo * 0.22));
      beginShape();
      const radius = baseRadius + echo * 14 + sin(frameCount * 0.025 + seed + echo) * 4;
      for (let a = 0; a <= TWO_PI + 0.14; a += 0.18) {
        const wobble = (noise(cos(a) + seed, sin(a) + echo, frameCount * 0.01) - 0.5) * (10 + echo * 4);
        vertex(x + cos(a) * (radius + wobble), y + sin(a) * (radius + wobble));
      }
      endShape(CLOSE);
    }
  }

  applyPercussionPacking(x, y) {
    const activeDots = this.percussionDots.filter((dot) => dot.fromPinch);
    if (!activeDots.length) return { x, y };
    let dx = 0;
    let dy = 0;
    for (const dot of activeDots) {
      const wobble = sin(frameCount * 0.035 + dot.seed) * 10;
      const radius = dot.radius * 2.7 + wobble + min(185, dot.age * 0.52);
      const distance = dist(x, y, dot.x, dot.y);
      if (distance <= 0 || distance > radius) continue;
      const force = pow(1 - distance / radius, 1.7) * radius * 0.72;
      dx += ((x - dot.x) / distance) * force;
      dy += ((y - dot.y) / distance) * force;
    }
    return { x: x + dx, y: y + dy };
  }

  addPercussionDots(memory) {
    const loopVisualKeys = ["loopCreator", "motion", "texture", "space"];
    if (!memory || !loopVisualKeys.includes(memory.key)) return;
    this.percussionLoopCount++;
    const event = memory.events[0] || {};
    const baseX = Number.isFinite(event.visualX) ? event.visualX : width * 0.5;
    const baseY = Number.isFinite(event.visualY) ? event.visualY : height * 0.5;
    const settings = this.getLoopDotSettings(memory.key);
    this.percussionDots = this.percussionDots.filter((dot) => dot.key !== memory.key);
    this.percussionDots.push({
      id: memory.id,
      key: memory.key,
      x: baseX,
      y: baseY,
      seed: random(1000),
      age: 0,
      life: 1,
      pulse: 1,
      fromPinch: true,
      radius: settings.radius,
      color: settings.color,
    });
    while (this.percussionDots.length > 12) this.percussionDots.shift();
  }

  getLoopDotSettings(key) {
    if (key === "loopCreator") return { color: [255, 228, 92], radius: 36 };
    if (key === "texture") return { color: [255, 255, 255], radius: 48 };
    if (key === "space") return { color: [255, 36, 30], radius: 46 };
    return { color: [35, 112, 255], radius: 42 };
  }

  drawStoredPercussionDots() {
    noFill();
    let drawn = 0;
    for (const dot of this.percussionDots) {
      if (dot.key !== activeProcessKey) continue;
      dot.age++;
      dot.life = max(0.32, dot.life * 0.9985);
      dot.pulse = max(0, (dot.pulse || 0) * 0.86);
      const pulseSize = dot.pulse * 18;
      const alpha = 190 * dot.life * (1 - this.threePromptProgress * 0.35);
      const c = dot.color || this.getLoopDotSettings(dot.key || "motion").color;
      this.drawUnifiedWobblyCircle(dot.x, dot.y, dot.radius + pulseSize, c, alpha / 190, dot.seed);
      drawn++;
    }
    return drawn;
  }

  drawThreeFingerPrompt() {
    if (this.threePromptProgress <= 0.01) return;
    this.drawStagePromptMask(this.threeTextMask, color(255, 214, 26), this.threePromptProgress * (1 - this.fourPromptProgress));
    const statementColor = activeProcessKey === "space" ? color(255, 214, 26) : activeProcessKey === "texture" ? color(0) : color(255);
    this.drawStagePromptMask(this.fourTextMask, statementColor, this.fourPromptProgress, true);
  }

  drawStagePromptMask(mask, dotColor, alphaScale, dense = false) {
    if (alphaScale <= 0.01) return;
    mask.loadPixels();
    noStroke();
    const step = dense ? 4 : 4;
    for (let x = 0; x < width; x += step) {
      for (let y = 0; y < height; y += step) {
        const index = 4 * (x + y * width);
        const maskValue = mask.pixels[index];
        if (maskValue <= 70) {
          if (!dense || !this.isNearMaskPixel(mask, x, y, 24)) continue;
          const speckleNoise = noise(x * 0.042 + 91, y * 0.042 - 23, frameCount * 0.009);
          if (speckleNoise < 0.6) continue;
          const blink = (sin(frameCount * 0.075 + speckleNoise * 28 + x * 0.01) + 1) * 0.5;
          if (speckleNoise > 0.88 && blink < 0.35) continue;
          const moved = this.applyHandTextDisplacement({ x, y });
          const alpha = 255 * alphaScale * map(speckleNoise, 0.6, 1, 0.16, 0.64) * map(blink, 0, 1, 0.42, 1);
          fill(red(dotColor), green(dotColor), blue(dotColor), alpha);
          circle(moved.x, moved.y, map(speckleNoise, 0.6, 1, 0.85, 2.55));
          continue;
        }
        const flowA = noise(x * 0.006, y * 0.006, frameCount * 0.002);
        const flowB = noise(x * 0.014 + 200, y * 0.014 - 100, frameCount * 0.001);
        const wave = sin(flowA * 75 + flowB * 25 + x * 0.018 + y * 0.006 + frameCount * 0.025);
        if (!dense && wave <= -0.24) continue;
        if (dense && wave <= -0.82) continue;
        const blinkSeed = noise(x * 0.045 + 18, y * 0.045 - 7);
        const blink = dense && blinkSeed > 0.68 ? (sin(frameCount * 0.09 + blinkSeed * 18) + 1) * 0.5 : 1;
        if (dense && blinkSeed > 0.78 && blink < 0.28) continue;
        const edge = constrain(abs(maskValue - 150) / 150, 0, 1);
        const size = dense
          ? map(maskValue, 70, 255, 1.6, 3.45) * map(edge, 0, 1, 1.04, 0.78) * map(blink, 0, 1, 0.55, 1.1)
          : 3.8;
        const moved = this.applyHandTextDisplacement({ x, y });
        fill(red(dotColor), green(dotColor), blue(dotColor), 255 * alphaScale * (dense ? map(blink, 0, 1, 0.48, 1) : 1));
        circle(moved.x, moved.y, size);
      }
    }
  }

  isNearMaskPixel(mask, x, y, radius) {
    const checks = [
      [radius, 0],
      [-radius, 0],
      [0, radius],
      [0, -radius],
      [radius * 0.7, radius * 0.7],
      [-radius * 0.7, radius * 0.7],
      [radius * 0.7, -radius * 0.7],
      [-radius * 0.7, -radius * 0.7],
    ];
    for (const offset of checks) {
      const sx = floor(constrain(x + offset[0], 0, width - 1));
      const sy = floor(constrain(y + offset[1], 0, height - 1));
      const index = 4 * (sx + sy * width);
      if (mask.pixels[index] > 80) return true;
    }
    return false;
  }

  drawSampleGrid(visible, point) {
    if (!visible) return;
    const top = typeof sampleGridTop !== "undefined" ? sampleGridTop : typeof performanceTop !== "undefined" ? performanceTop : 0;
    const layout = typeof getSampleGridLayout === "function" ? getSampleGridLayout() : [];
    const activeCells = [];
    if (typeof selectedSampleGridCells !== "undefined") {
      for (const cell of Object.values(selectedSampleGridCells)) {
        if (cell !== null && !activeCells.includes(cell)) activeCells.push(cell);
      }
    }
    const activeCell = activeCells.length
      ? null
      : selectedSampleGridCell !== null
        ? selectedSampleGridCell
        : isFinitePoint(point) && typeof getSampleGridCell === "function"
          ? getSampleGridCell(point)
          : null;
    const loopingCell = getLoopingSampleGridCell();

    push();
    noStroke();
    fill(246, 246, 244, 245);
    rect(0, top, width, height - top);
    pop();

    if (layout.length) {
      for (const cell of layout) {
        const sampleIndex = cell.sampleIndex;
        const isSampleCell = sampleIndex !== null && sampleIndex !== undefined;
        const isActive = isSampleCell && (activeCells.includes(sampleIndex) || activeCell === sampleIndex);
        const isLooping = isSampleCell && loopingCell === sampleIndex;
        this.drawIrregularSampleCell(cell, isActive, isLooping);
      }
    } else {
      noFill();
      stroke(255);
      rect(0, top, width, height - top);
    }

  }

  drawIrregularSampleCell(cell, isActive, isLooping) {
    const pulse = (sin(frameCount * 0.08 + cell.seed) + 1) * 0.5;
    const isSampleCell = cell.sampleIndex !== null && cell.sampleIndex !== undefined;
    if (!isSampleCell) return;

    const gap = 1.15;
    const activeAlpha = isActive ? 34 + pulse * 24 : 0;
    const loopAlpha = isLooping ? 34 + this.globalAmp * 36 : 0;
    noStroke();
    fill(0);
    rect(cell.x + gap, cell.y + gap, cell.w - gap * 2, cell.h - gap * 2);
    if (isActive) {
      fill(255, 255, 255, activeAlpha);
      rect(cell.x + gap, cell.y + gap, cell.w - gap * 2, cell.h - gap * 2);
    }
    if (isLooping) {
      fill(210, 226, 255, loopAlpha);
      rect(cell.x + gap, cell.y + gap, cell.w - gap * 2, cell.h - gap * 2);
    }

    this.drawRecursiveSampleSquares(cell, isActive, isLooping);

    noFill();
    stroke(isLooping ? color(210, 226, 255, 235) : isActive ? color(255, 255, 255, 245) : color(238, 238, 236, 210));
    strokeWeight(isActive || isLooping ? 1.65 : 0.9);
    rect(cell.x + gap, cell.y + gap, cell.w - gap * 2, cell.h - gap * 2);

  }

  drawRecursiveSampleSquares(cell, isActive, isLooping) {
    const minSide = min(cell.w, cell.h);
    const depthBoost = minSide > 54 ? 1 : 0;
    const baseCols = max(2, floor(cell.w / max(18, minSide * 0.42)));
    const baseRows = max(2, floor(cell.h / max(18, minSide * 0.42)));
    const tile = min(cell.w / baseCols, cell.h / baseRows);
    const usedW = tile * baseCols;
    const usedH = tile * baseRows;
    const startX = cell.x + (cell.w - usedW) * 0.5;
    const startY = cell.y + (cell.h - usedH) * 0.5;

    for (let row = 0; row < baseRows; row++) {
      for (let col = 0; col < baseCols; col++) {
        const x = startX + col * tile;
        const y = startY + row * tile;
        const n = this.sampleSquareNoise(cell, col, row, 0);
        const depth = n > 0.74 ? 3 + depthBoost : n > 0.42 ? 2 + depthBoost : 1;
        this.drawSampleSquareTile(x, y, tile, depth, cell, col, row, isActive, isLooping);
      }
    }
  }

  drawSampleSquareTile(x, y, size, depth, cell, col, row, isActive, isLooping) {
    if (size < 5 || depth <= 0) return;
    const n = this.sampleSquareNoise(cell, col, row, depth);
    const gap = size > 22 ? 1.15 : 0.75;
    const drawHole = depth > 1 && n > 0.86 && size > 16;

    if (drawHole) {
      noStroke();
      fill(246, 246, 244, 246);
      rect(x + gap, y + gap, size - gap * 2, size - gap * 2);
    } else {
      noStroke();
      fill(0, isActive ? 232 : 255);
      rect(x + gap, y + gap, size - gap * 2, size - gap * 2);
      noFill();
      stroke(isLooping ? color(205, 224, 255, 210) : color(238, 238, 236, isActive ? 235 : 190));
      strokeWeight(size > 24 ? 0.82 : 0.62);
      rect(x + gap, y + gap, size - gap * 2, size - gap * 2);
    }

    if (depth <= 1) return;
    const subdivisions = n > 0.58 ? 3 : 2;
    const child = size / subdivisions;
    for (let yy = 0; yy < subdivisions; yy++) {
      for (let xx = 0; xx < subdivisions; xx++) {
        const childNoise = this.sampleSquareNoise(cell, col * 5 + xx, row * 5 + yy, depth + 7);
        if (childNoise < 0.18 && depth < 3) continue;
        this.drawSampleSquareTile(x + xx * child, y + yy * child, child, depth - 1, cell, col * subdivisions + xx, row * subdivisions + yy, isActive, isLooping);
      }
    }
  }

  sampleSquareNoise(cell, col, row, pass) {
    if (typeof deterministicGridNoise === "function") {
      return deterministicGridNoise(cell.seed + col * 11.7, row * 19.3 + cell.index, cell.w + cell.h, pass);
    }
    const value = sin((cell.seed + col * 13.17) * 12.9898 + (row * 17.31 + pass) * 78.233) * 43758.5453;
    return value - floor(value);
  }

  drawSampleSubCells(cell, isActive, isLooping) {
    const cols = cell.w > width * 0.26 ? 4 : 2;
    const rows = cell.h > (height - cell.y) * 0.22 || cell.h > 82 ? 4 : 2;
    const subW = cell.w / cols;
    const subH = cell.h / rows;
    noFill();
    stroke(isLooping ? color(90, 160, 255, 130) : isActive ? color(255, 80, 60, 125) : color(255, 255, 255, 155));
    strokeWeight(0.9);
    for (let x = 1; x < cols; x++) line(cell.x + subW * x, cell.y, cell.x + subW * x, cell.y + cell.h);
    for (let y = 1; y < rows; y++) line(cell.x, cell.y + subH * y, cell.x + cell.w, cell.y + subH * y);
    noStroke();
    fill(255, 245);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        circle(cell.x + subW * (x + 0.5), cell.y + subH * (y + 0.5), 3.2);
      }
    }
  }

  drawSampleHandTrackingEffect(top) {
    const hands = [];
    if (typeof bodyLeftWrist !== "undefined" && isFinitePoint(bodyLeftWrist)) hands.push({ side: "left", point: bodyLeftWrist, color: [255, 255, 255], phase: 0 });
    if (typeof bodyRightWrist !== "undefined" && isFinitePoint(bodyRightWrist)) hands.push({ side: "right", point: bodyRightWrist, color: [35, 112, 255], phase: 4.2 });
    for (const hand of hands) {
      if (hand.point.y < top) continue;
      const trail = this.sampleHandTrails[hand.side] || [];
      const previous = trail.length ? trail[trail.length - 1] : null;
      const speed = previous ? dist(hand.point.x, hand.point.y, previous.x, previous.y) : 0;
      trail.push({ x: hand.point.x, y: hand.point.y, speed, life: 1, seed: noise(hand.point.x * 0.01, hand.point.y * 0.01, frameCount * 0.01) * 1000 });
      while (trail.length > 28) trail.shift();
      this.sampleHandTrails[hand.side] = trail;
      this.drawCableHandTrail(trail, hand.color, hand.phase);
      this.drawCableHandCore(hand.point, hand.color, speed, hand.phase);
    }
  }

  drawCableHandTrail(trail, rgb, phase) {
    if (!trail || trail.length < 2) return;
    noFill();
    blendMode(ADD);
    for (let pass = 0; pass < 3; pass++) {
      const alpha = 34 - pass * 8;
      stroke(rgb[0], rgb[1], rgb[2], alpha);
      strokeWeight(0.8 + pass * 0.42);
      beginShape();
      for (let i = 0; i < trail.length; i++) {
        const p = trail[i];
        const age = i / max(1, trail.length - 1);
        const wobble = (noise(p.x * 0.016 + pass, p.y * 0.016 - phase, frameCount * 0.02) - 0.5) * (18 + p.speed * 0.22) * age;
        const angle = noise(p.seed, pass, frameCount * 0.015) * TWO_PI;
        curveVertex(p.x + cos(angle) * wobble, p.y + sin(angle) * wobble);
      }
      endShape();
    }
    noStroke();
    for (let i = 0; i < trail.length; i += 2) {
      const p = trail[i];
      const age = i / max(1, trail.length - 1);
      const blink = (sin(frameCount * 0.2 + p.seed + phase) + 1) * 0.5;
      fill(rgb[0], rgb[1], rgb[2], 18 + age * 88 * blink);
      circle(p.x, p.y, 1.2 + age * 3.8 + p.speed * 0.012);
    }
    blendMode(BLEND);
  }

  drawCableHandCore(point, rgb, speed, phase) {
    blendMode(ADD);
    noFill();
    const intensity = constrain(map(speed, 0, 34, 0.72, 1.45), 0.72, 1.45);
    for (let ring = 0; ring < 8; ring++) {
      const radius = (10 + ring * 7.5 + sin(frameCount * 0.08 + ring + phase) * 2.5) * intensity;
      const alpha = (94 - ring * 9) * intensity;
      stroke(rgb[0], rgb[1], rgb[2], alpha);
      strokeWeight(1.4 - ring * 0.08);
      beginShape();
      for (let a = 0; a <= TWO_PI + 0.14; a += 0.14) {
        const warp = (noise(cos(a) * 1.3 + phase, sin(a) * 1.3 + ring, frameCount * 0.018) - 0.5) * (9 + ring * 2.4 + speed * 0.08);
        const glitch = noise(ring * 8.1, a * 3.1, frameCount * 0.035) > 0.88 ? random(-7, 7) : 0;
        vertex(point.x + cos(a) * (radius + warp) + glitch, point.y + sin(a) * (radius + warp));
      }
      endShape(CLOSE);
    }
    noStroke();
    fill(rgb[0], rgb[1], rgb[2], 230);
    circle(point.x, point.y, 5.5 + intensity * 2.6);
    blendMode(BLEND);
  }

  drawFluidSampleCell(cell, fillColor, alpha) {
    const layoutCell = typeof getSampleGridLayout === "function" ? getSampleGridLayout().find((item) => item.sampleIndex === cell) : null;
    const col = cell % sampleGridCols;
    const row = floor(cell / sampleGridCols) % sampleGridRows;
    const fallbackTop = typeof sampleGridTop !== "undefined" ? sampleGridTop : typeof performanceTop !== "undefined" ? performanceTop : 0;
    const w = layoutCell ? layoutCell.w : width / sampleGridCols;
    const h = layoutCell ? layoutCell.h : (height - fallbackTop) / sampleGridRows;
    const x = layoutCell ? layoutCell.x : col * w;
    const y = layoutCell ? layoutCell.y : fallbackTop + row * h;
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
    const loopVisualKeys = ["loopCreator", "motion", "texture", "space"];
    if (loopVisualKeys.includes(event.soundEngine) && event.loopMemoryId) {
      const dot = this.percussionDots.find((item) => item.id === event.loopMemoryId);
      if (dot) dot.pulse = 1;
      return;
    }
    if (event.loopPlayback && loopVisualKeys.includes(event.soundEngine)) return;
    this.pulseAudioObject(event);
    if (event.loopPlayback) return;
    const key = event.soundEngine || event.key || activeProcessKey || "loopCreator";
    const c = processColors[key] || processColors.loopCreator;
    const x = Number.isFinite(event.visualX) ? event.visualX : width * 0.5;
    const y = Number.isFinite(event.visualY) ? event.visualY : height * 0.5;
    if (key === "texture") this.addClickDiffusionBurst(x, y, constrain((event.velocity || 0.45) * 1.3, 0.35, 1.25));
    particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
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
    this.addPercussionDots(memory);
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

  drawTrackingStatus(sortedHands, activeFinger) {
    const cameraReady = video && video.elt && video.elt.readyState >= 2;
    const message = handPoseError
      ? "tracking error: " + handPoseError
      : !cameraReady
        ? "allow camera / camera starting"
      : handPoseLoading
        ? "tracking model loading"
        : handPoseStarted
          ? (sortedHands.length ? sortedHands.length + " hand detected" : "show your hand")
          : "tracking starting";
    const active = activeFinger ? activeFinger.openFingers.join(" + ") : "";
    noStroke();
    fill(this.transitionProgress > 0.5 ? 255 : 0, 150);
    textSize(13);
    text(message + (active ? " / " + active : ""), 26, height - 34);
  }

  drawGestureInstruction(activeFinger) {
    const label = this.gestureInstructionLabel(activeFinger);
    noStroke();
    fill(255, 235);
    rect(0, 0, width, 22);
    fill(0);
    textAlign(CENTER, CENTER);
    textSize(11);
    text(label, width / 2, 11);
    textAlign(LEFT, BASELINE);
  }

  gestureInstructionLabel(activeFinger) {
    if (!activeFinger) return "show right hand";
    if (activeFinger.count === 1) return "index finger";
    if (activeFinger.count === 2) return "thumb + index + pinch";
    if (activeFinger.count === 3) return "thumb + index + middle";
    if (activeFinger.count === 4) return "thumb + index + middle + ring";
    if (activeFinger.count === 5) return "all fingers / samples";
    return "show right hand";
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
    this.seed = gestureVisualSeed(key, point, anchor);
    this.clock = this.seed % 100;
    this.hold = 0.08;
    this.life = anchor === "gesture" ? 160 : anchor.startsWith("loop-") ? 220 : 96;
    this.maxLife = this.life;
    this.radius = this.baseRadius();
    this.aspect = key === "space" ? 0.58 : key === "motion" ? 0.74 : 0.92;
    this.spin = (((this.seed % 200) - 100) / 100) * 0.004;
  }

  baseRadius() {
    if (this.key === "loopCreator") return 104;
    if (this.key === "motion") return 58;
    if (this.key === "texture") return 42;
    if (this.key === "space") return 92;
    if (this.key === "decay") return 74;
    return 62;
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

function gestureVisualSeed(key, point, anchor) {
  const text = key + ":" + anchor + ":" + round(point.x) + ":" + round(point.y);
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) % 10000;
  }
  return hash;
}
