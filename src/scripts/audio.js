import { Howl } from "howler";

class AudioManager {
  constructor() {
    if (typeof window !== "undefined" && AudioManager._instance) {
      return AudioManager._instance;
    }

    AudioManager._instance = this;

    this.bgm = new Howl({
      src: ["audio/imok.ogg"],
      loop: true,
      volume: 0.0,
    });

    this.click = new Howl({
      src: ["audio/ui-click.wav"],
      volume: 1.0,
    });

    // Erhu hover sound - short melodic loop
    this.erhu = new Howl({
      src: ["audio/erhu-sample.mp3"], // Replace with your erhu audio file
      loop: true,
      volume: 0.0, // Start at 0 for fade in
    });

    this.erhuFadeInterval = null;
  }

  playBGM(volume = 1.0) {
    this.bgm.volume(volume);
    if (!this.bgm.playing()) this.bgm.play();
  }

  pauseBGM(volume = 1.0) {
    this.bgm.volume(volume);
    if (this.bgm.playing()) this.bgm.pause();
  }

  playClick(volume = 0.1) {
    this.click.volume(volume);
    this.click.play();
  }

  // Fade in erhu sound on hover
  playErhu(targetVolume = 0.3, fadeDuration = 300) {
    // Clear any existing fade
    if (this.erhuFadeInterval) {
      clearInterval(this.erhuFadeInterval);
    }

    // Start playing if not already
    if (!this.erhu.playing()) {
      this.erhu.volume(0);
      this.erhu.play();
    }

    // Fade in
    const steps = 20;
    const stepTime = fadeDuration / steps;
    const volumeStep = targetVolume / steps;
    let currentStep = 0;

    this.erhuFadeInterval = setInterval(() => {
      currentStep++;
      const newVolume = Math.min(volumeStep * currentStep, targetVolume);
      this.erhu.volume(newVolume);

      if (currentStep >= steps) {
        clearInterval(this.erhuFadeInterval);
        this.erhuFadeInterval = null;
      }
    }, stepTime);
  }

  // Fade out erhu sound on mouse leave
  stopErhu(fadeDuration = 300) {
    // Clear any existing fade
    if (this.erhuFadeInterval) {
      clearInterval(this.erhuFadeInterval);
    }

    const currentVolume = this.erhu.volume();
    const steps = 20;
    const stepTime = fadeDuration / steps;
    const volumeStep = currentVolume / steps;
    let currentStep = 0;

    this.erhuFadeInterval = setInterval(() => {
      currentStep++;
      const newVolume = Math.max(currentVolume - volumeStep * currentStep, 0);
      this.erhu.volume(newVolume);

      if (currentStep >= steps) {
        clearInterval(this.erhuFadeInterval);
        this.erhuFadeInterval = null;
        this.erhu.stop(); // Stop playback when fully faded
      }
    }, stepTime);
  }
}

const audioManagerInstance = new AudioManager();
export default audioManagerInstance;
