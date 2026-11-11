/* MOKUJO 木序 P2 — localStorage store, init/reset, expire-on-load. */
var MokujoStore = (function () {
  var KEY = "mokujo-p2-demo-v1";
  var SESSION_KEY = "mokujo-p2-session-v1";
  var memory = null;
  var customStorage = null;

  function storage() {
    if (customStorage) return customStorage;
    try {
      if (typeof localStorage !== "undefined" && localStorage) return localStorage;
    } catch (e) {}
    if (!memory) {
      var map = {};
      memory = {
        getItem: function (k) { return Object.prototype.hasOwnProperty.call(map, k) ? map[k] : null; },
        setItem: function (k, v) { map[k] = String(v); },
        removeItem: function (k) { delete map[k]; }
      };
    }
    return memory;
  }

  function useStorage(s) {
    customStorage = s;
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function readRaw() {
    var raw = storage().getItem(KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function writeRaw(state) {
    state.rev = (state.rev || 0) + 1;
    state.savedAt = MokujoTime.iso(MokujoTime.now());
    storage().setItem(KEY, JSON.stringify(state));
    return state;
  }

  function readSessionUserId() {
    try {
      var s = storage().getItem(SESSION_KEY);
      if (s) {
        var o = JSON.parse(s);
        if (o && o.currentUserId) return o.currentUserId;
      }
    } catch (e) {}
    return null;
  }

  function writeSessionUserId(id) {
    storage().setItem(SESSION_KEY, JSON.stringify({ currentUserId: id }));
  }

  function init(now) {
    var state = MokujoData.build(now || MokujoTime.now());
    state.rev = 0;
    var keepUser = readSessionUserId();
    if (keepUser && state.users.some(function (u) { return u.id === keepUser && u.status === "active"; })) {
      state.currentUserId = keepUser;
    }
    writeRaw(state);
    return clone(state);
  }

  function load(now) {
    var state = readRaw();
    if (!state || !state.shop || !state.appointments) {
      return init(now);
    }
    var sessionUser = readSessionUserId();
    if (sessionUser) state.currentUserId = sessionUser;
    if (typeof MokujoEngine !== "undefined" && MokujoEngine.expireDue) {
      var changed = MokujoEngine.expireDue(state, now || MokujoTime.now());
      if (changed && changed.length) writeRaw(state);
    }
    return clone(state);
  }

  function save(state) {
    writeRaw(state);
    return clone(state);
  }

  /* Reload from storage, run expire, apply mutator(state, now), save. Mutator may throw / return fail. */
  function transact(mutator, now) {
    now = now || MokujoTime.now();
    var state = readRaw();
    if (!state || !state.shop) state = MokujoData.build(now);
    if (typeof MokujoEngine !== "undefined" && MokujoEngine.expireDue) {
      MokujoEngine.expireDue(state, now);
    }
    var sessionUser = readSessionUserId();
    if (sessionUser) state.currentUserId = sessionUser;
    var result = mutator(state, now);
    if (!result) result = { ok: true };
    if (result.ok !== false) {
      writeRaw(state);
      result.state = clone(state);
    } else {
      result.state = load(now);
    }
    return result;
  }

  function reset(now) {
    var sessionUser = readSessionUserId();
    var state = MokujoData.build(now || MokujoTime.now());
    state.rev = 0;
    if (sessionUser && state.users.some(function (u) { return u.id === sessionUser; })) {
      state.currentUserId = sessionUser;
    }
    writeRaw(state);
    return clone(state);
  }

  function clearAll() {
    storage().removeItem(KEY);
  }

  function setCurrentUser(userId) {
    writeSessionUserId(userId);
    var state = readRaw();
    if (state) {
      state.currentUserId = userId;
      writeRaw(state);
    }
  }

  function getCurrentUserId() {
    var s = readSessionUserId();
    if (s) return s;
    var state = readRaw();
    return state && state.currentUserId ? state.currentUserId : "user-aqing";
  }

  return {
    KEY: KEY,
    useStorage: useStorage,
    clone: clone,
    init: init,
    load: load,
    save: save,
    transact: transact,
    reset: reset,
    clearAll: clearAll,
    setCurrentUser: setCurrentUser,
    getCurrentUserId: getCurrentUserId,
    readRaw: readRaw
  };
})();
