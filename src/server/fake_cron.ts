import { store } from "./store.js";

function initCron() {
  setInterval(() => store.destroyOldNotes(), 1000 * 60 * 60 * 24); // 1 day
}

export default initCron;
