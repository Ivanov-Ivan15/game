import { fetchJson } from './loader.js';

export class Lobby extends EventTarget {
  constructor() {
    super();
    this.rooms = [];
    this.intervalId = null;
  }

  async fetchRooms() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const rooms = await fetchJson('/api/rooms.json', controller.signal);
      clearTimeout(timeoutId);
      this.rooms = rooms;
      this.dispatchEvent(new CustomEvent('roomsUpdated', { detail: rooms }));
    } catch (err) {
      this.dispatchEvent(new CustomEvent('roomsError', { detail: err }));
    }
  }

  startPolling() {
    this.fetchRooms();
    this.intervalId = setInterval(() => this.fetchRooms(), 5000);
  }

  stopPolling() {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  joinRoom(playerName, roomId) {
    this.stopPolling();
    this.dispatchEvent(new CustomEvent('join', { detail: { playerName, roomId } }));
  }
}