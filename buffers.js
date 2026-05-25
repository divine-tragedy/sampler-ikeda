let buffer1, buffer2, buffer3, buffer4, buffer5;

buffer1 = new Tone.ToneAudioBuffer("sounds/loop1.wav", () => {
  console.log('buffer loaded');
});
buffer2 = new Tone.ToneAudioBuffer("sounds/loop2.wav");
buffer3 = new Tone.ToneAudioBuffer("sounds/loop3.wav");
buffer4 = new Tone.ToneAudioBuffer("sounds/loop4.wav");
buffer5 = new Tone.ToneAudioBuffer("sounds/loop5.wav");
