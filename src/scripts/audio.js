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

    // Multiple erhu sounds
    this.erhuSounds = [
      new Howl({ src: ["audio/erhu.mp3"], loop: true, volume: 0.0 }),
      new Howl({ src: ["audio/lantingxu.mp3"], loop: true, volume: 0.0 }),
      new Howl({ src: ["audio/yuxia-short.mp3"], loop: true, volume: 0.0 }),
    ];

    this.currentErhu = null;
    this.erhuFadeInterval = null;
    this.bgmFadeInterval = null;
    this.originalBGMVolume = 1.0;
  }

  playBGM(volume = 1.0) {
    this.originalBGMVolume = volume;
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

  fadeBGM(targetVolume, fadeDuration = 500) {
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

  playErhu(targetVolume = 0.3, fadeDuration = 300) {
    // CRITICAL: Stop ALL erhu sounds completely first to prevent overlap
    this.erhuSounds.forEach((sound) => {
      if (sound.playing()) {
        sound.stop();
        sound.volume(0);
      }
    });

    // Clear any existing fade
    if (this.erhuFadeInterval) {
      clearInterval(this.erhuFadeInterval);
      this.erhuFadeInterval = null;
    }

    // Pick a random erhu sound
    const randomIndex = Math.floor(Math.random() * this.erhuSounds.length);
    this.currentErhu = this.erhuSounds[randomIndex];

    // Start playing the new sound
    this.currentErhu.volume(0);
    this.currentErhu.play();

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
        this.bgm.pause();
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
      if (this.currentErhu) {
        this.currentErhu.volume(newVolume);
      }

      if (currentStep >= steps) {
        clearInterval(this.erhuFadeInterval);
        this.erhuFadeInterval = null;
      }
    }, stepTime);
  }

  stopErhu(fadeDuration = 300) {
    if (!this.currentErhu) return;

    // Capture reference to the erhu we're stopping
    const erhuToStop = this.currentErhu;

    // Clear the current erhu reference immediately to prevent re-use
    this.currentErhu = null;

    // Clear any existing fade
    if (this.erhuFadeInterval) {
      clearInterval(this.erhuFadeInterval);
      this.erhuFadeInterval = null;
    }

    // Get current volume before fading
    const currentVolume = erhuToStop.volume();

    // If volume is already 0 or not playing, just stop immediately
    if (currentVolume === 0 || !erhuToStop.playing()) {
      erhuToStop.stop();

      // Resume BGM
      if (!this.bgm.playing()) {
        this.bgm.volume(0);
        this.bgm.play();
      }
      this.fadeBGM(this.originalBGMVolume, 1500);
      return;
    }

    // Fade out erhu
    const steps = 20;
    const stepTime = fadeDuration / steps;
    const volumeStep = currentVolume / steps;
    let currentStep = 0;

    this.erhuFadeInterval = setInterval(() => {
      currentStep++;
      const newVolume = Math.max(currentVolume - volumeStep * currentStep, 0);
      erhuToStop.volume(newVolume);

      if (currentStep >= steps) {
        clearInterval(this.erhuFadeInterval);
        this.erhuFadeInterval = null;
        erhuToStop.stop(); // Make sure it stops
        erhuToStop.volume(0); // Reset volume

        // Resume BGM
        if (!this.bgm.playing()) {
          this.bgm.volume(0);
          this.bgm.play();
        }
        this.fadeBGM(this.originalBGMVolume, 1500);
      }
    }, stepTime);
  }
}

const audioManagerInstance = new AudioManager();
export default audioManagerInstance;
