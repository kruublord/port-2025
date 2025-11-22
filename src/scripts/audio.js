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
      volume: 1,
    });

    this.click = new Howl({
      src: ["audio/ui-click.wav"],
      volume: 1.0,
    });

    // Erhu hover sound - short melodic loop
    this.erhu = new Howl({
      src: ["audio/erhu.mp3"],
      loop: true,
      volume: 0.0, // Start at 0 for fade in
    });

    this.erhuFadeInterval = null;
    this.bgmFadeInterval = null;
    this.originalBGMVolume = 1.0; // Store original BGM volume
  }

  playBGM(volume = 1.0) {
    this.originalBGMVolume = volume; // Remember the volume we want
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

  // Fade BGM to a target volume
  fadeBGM(targetVolume, fadeDuration = 500) {
    // Clear any existing BGM fade
    if (this.bgmFadeInterval) {
      clearInterval(this.bgmFadeInterval);
    }

    const currentVolume = this.bgm.volume();
    const steps = 20;
    const stepTime = fadeDuration / steps;
    const volumeDiff = targetVolume - currentVolume;
    const volumeStep = volumeDiff / steps;
    let currentStep = 0;

    this.bgmFadeInterval = setInterval(() => {
      currentStep++;
      const newVolume = currentVolume + volumeStep * currentStep;
      this.bgm.volume(Math.max(0, Math.min(1, newVolume)));

      if (currentStep >= steps) {
        clearInterval(this.bgmFadeInterval);
        this.bgmFadeInterval = null;
      }
    }, stepTime);
  }

  // Fade in erhu sound on hover + pause BGM
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

    // Fade out and pause BGM
    const bgmCurrentVolume = this.bgm.volume();
    const bgmSteps = 20;
    const bgmStepTime = fadeDuration / bgmSteps;
    const bgmVolumeStep = bgmCurrentVolume / bgmSteps;
    let bgmStep = 0;

    const bgmFadeOut = setInterval(() => {
      bgmStep++;
      const newBGMVolume = Math.max(
        bgmCurrentVolume - bgmVolumeStep * bgmStep,
        0
      );
      this.bgm.volume(newBGMVolume);

      if (bgmStep >= bgmSteps) {
        clearInterval(bgmFadeOut);
        this.bgm.pause(); // Pause BGM completely
      }
    }, bgmStepTime);

    // Fade in erhu
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

  // Fade out erhu sound on mouse leave + restore BGM slowly
  stopErhu(fadeDuration = 300) {
    // Clear any existing fade
    if (this.erhuFadeInterval) {
      clearInterval(this.erhuFadeInterval);
    }

    // Fade out erhu
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

        // After erhu stops, resume BGM with slower fade in (1500ms)
        if (!this.bgm.playing()) {
          this.bgm.volume(0);
          this.bgm.play();
        }
        this.fadeBGM(this.originalBGMVolume, 1500); // 1.5 second fade in
      }
    }, stepTime);
  }
}

const audioManagerInstance = new AudioManager();
export default audioManagerInstance;
