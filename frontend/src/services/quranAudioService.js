import { Platform } from 'react-native';

/**
 * Universal Audio Player Service for Quran Recitations & Dua Audio.
 * Uses `expo-audio` when available, with HTML5 Audio fallback for web.
 * Manages a singleton playback instance to prevent multiple overlapping audio tracks.
 */
class AudioPlayerService {
  constructor() {
    this.player = null;
    this.webAudio = null;
    this.currentUrl = null;
    this.statusListeners = new Set();
    this.statusPollInterval = null;
    this.expoAudioModule = null;
  }

  async getExpoAudio() {
    if (this.expoAudioModule) return this.expoAudioModule;
    try {
      this.expoAudioModule = await import('expo-audio');
      return this.expoAudioModule;
    } catch (e) {
      console.warn('[AudioService] expo-audio import error:', e?.message);
      return null;
    }
  }

  notifyListeners(status) {
    this.statusListeners.forEach((listener) => {
      try {
        listener(status);
      } catch (err) {
        console.warn('[AudioService] listener error:', err);
      }
    });
  }

  subscribeStatus(listener) {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  async play(url, metadata = {}) {
    if (!url) return;

    // If same URL is already playing, do nothing
    if (this.currentUrl === url && this.isPlaying()) {
      return;
    }

    // Stop existing playback first
    await this.stop();
    this.currentUrl = url;

    this.notifyListeners({
      url,
      metadata,
      isPlaying: false,
      isBuffering: true,
      currentTime: 0,
      duration: 0,
    });

    // 1. Web Platform Fallback
    if (Platform.OS === 'web' || typeof window !== 'undefined' && window.Audio) {
      try {
        this.webAudio = new window.Audio(url);
        this.webAudio.onplay = () => {
          this.notifyListeners({
            url: this.currentUrl,
            metadata,
            isPlaying: true,
            isBuffering: false,
            currentTime: this.webAudio?.currentTime || 0,
            duration: this.webAudio?.duration || 0,
          });
        };
        this.webAudio.onpause = () => {
          this.notifyListeners({
            url: this.currentUrl,
            metadata,
            isPlaying: false,
            isBuffering: false,
            currentTime: this.webAudio?.currentTime || 0,
            duration: this.webAudio?.duration || 0,
          });
        };
        this.webAudio.onended = () => {
          this.notifyListeners({
            url: this.currentUrl,
            metadata,
            isPlaying: false,
            isBuffering: false,
            isEnded: true,
            currentTime: 0,
            duration: this.webAudio?.duration || 0,
          });
        };
        this.webAudio.ontimeupdate = () => {
          this.notifyListeners({
            url: this.currentUrl,
            metadata,
            isPlaying: !this.webAudio?.paused,
            isBuffering: false,
            currentTime: this.webAudio?.currentTime || 0,
            duration: this.webAudio?.duration || 0,
          });
        };
        await this.webAudio.play();
        return;
      } catch (webErr) {
        console.warn('[AudioService] Web playback error:', webErr?.message);
      }
    }

    // 2. Native Mobile Platform using expo-audio
    try {
      const expoAudio = await this.getExpoAudio();
      if (expoAudio && expoAudio.createAudioPlayer) {
        this.player = expoAudio.createAudioPlayer(url, 500);

        // Start playback
        if (this.player.play) {
          this.player.play();
        }

        // Poll playback status
        this.statusPollInterval = setInterval(() => {
          if (!this.player) return;
          try {
            const currentTime = this.player.currentTime || 0;
            const duration = this.player.duration || 0;
            const isPlaying = !!this.player.playing;
            const isBuffering = !this.player.isLoaded && isPlaying;

            this.notifyListeners({
              url: this.currentUrl,
              metadata,
              isPlaying,
              isBuffering,
              currentTime,
              duration,
            });

            if (duration > 0 && currentTime >= duration - 0.5) {
              this.notifyListeners({
                url: this.currentUrl,
                metadata,
                isPlaying: false,
                isBuffering: false,
                isEnded: true,
                currentTime: 0,
                duration,
              });
              this.stop();
            }
          } catch (_) {}
        }, 500);

        return;
      }
    } catch (nativeErr) {
      console.warn('[AudioService] Native expo-audio playback error:', nativeErr?.message);
    }
  }

  async pause() {
    if (this.webAudio) {
      this.webAudio.pause();
    }
    if (this.player && this.player.pause) {
      try {
        this.player.pause();
      } catch (_) {}
    }
    this.notifyListeners({
      url: this.currentUrl,
      isPlaying: false,
      isBuffering: false,
      currentTime: this.getCurrentTime(),
      duration: this.getDuration(),
    });
  }

  async resume() {
    if (this.webAudio) {
      await this.webAudio.play();
    }
    if (this.player && this.player.play) {
      try {
        this.player.play();
      } catch (_) {}
    }
    this.notifyListeners({
      url: this.currentUrl,
      isPlaying: true,
      isBuffering: false,
      currentTime: this.getCurrentTime(),
      duration: this.getDuration(),
    });
  }

  async stop() {
    if (this.statusPollInterval) {
      clearInterval(this.statusPollInterval);
      this.statusPollInterval = null;
    }

    if (this.webAudio) {
      try {
        this.webAudio.pause();
        this.webAudio.currentTime = 0;
        this.webAudio = null;
      } catch (_) {}
    }

    if (this.player) {
      try {
        if (this.player.pause) this.player.pause();
        if (this.player.remove) this.player.remove();
      } catch (_) {}
      this.player = null;
    }

    const previousUrl = this.currentUrl;
    this.currentUrl = null;

    this.notifyListeners({
      url: previousUrl,
      isPlaying: false,
      isBuffering: false,
      currentTime: 0,
      duration: 0,
      isStopped: true,
    });
  }

  async seek(seconds) {
    if (this.webAudio) {
      this.webAudio.currentTime = seconds;
    }
    if (this.player && this.player.seekTo) {
      try {
        this.player.seekTo(seconds);
      } catch (_) {}
    }
  }

  isPlaying() {
    if (this.webAudio) {
      return !this.webAudio.paused && !this.webAudio.ended;
    }
    if (this.player) {
      return !!this.player.playing;
    }
    return false;
  }

  getCurrentTime() {
    if (this.webAudio) return this.webAudio.currentTime || 0;
    if (this.player) return this.player.currentTime || 0;
    return 0;
  }

  getDuration() {
    if (this.webAudio) return this.webAudio.duration || 0;
    if (this.player) return this.player.duration || 0;
    return 0;
  }

  getCurrentUrl() {
    return this.currentUrl;
  }
}

export const quranAudioService = new AudioPlayerService();
export default quranAudioService;

