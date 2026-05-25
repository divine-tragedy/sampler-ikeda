function setup() {
  createCanvas(448, 256);
}

function draw() {
  background(220);
  line(0, 0, width, height);
  line(0, height, width, 0);
}

function keyPressed() {
  if (key === 'f' || key === 'F') {
    let fs = fullscreen();
    fullscreen(!fs);
  }
}