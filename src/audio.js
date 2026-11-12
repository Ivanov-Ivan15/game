export class AudioManager {
  constructor(eventBus) {
    this.ctx = null;
    this.buffers = {};
    this.eventBus = eventBus;
    this.initOnUserGesture();
  }

  initOnUserGesture() {
    const init = () => {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      window.removeEventListener('click', init);
      window.removeEventListener('keydown', init);
    };
    window.addEventListener('click', init);
    window.addEventListener('keydown', init);
  }

  setBuffers(buffers) {
    this.buffers = buffers;
    this.listenEvents();
  }

  listenEvents() {
    this.eventBus.addEventListener('fired', () => this.playSound('shoot'));
    this.eventBus.addEventListener('hit', () => this.playSound('explosion'));
    this.eventBus.addEventListener('exploded', () => this.playSound('explosion'));
  }

  playSound(name) {
    if (!this.ctx || !this.buffers[name]) return;
    const source = this.ctx.createBufferSource();
    source.buffer = this.buffers[name];
    source.connect(this.ctx.destination);
    source.start(0);
  }
}