/* ─── Theme system ───
   7 brand colour swatches + light/dark mode, two independent axes. Mode
   can also follow the clock ("time"), which resolves to light or dark.
   Default is always light + classic, regardless of OS preference.
   Once the user picks something, it is persisted. */

const APP_KEY = "uwuconvert";

const COLOR_THEMES = [
  { id: "classic", label: "Classic", hex: "#ccffcc" },
  { id: "not-green-1", label: "Not green 1", hex: "#ffcccc" },
  { id: "not-green-2", label: "Not green 2", hex: "#ccccff" },
  { id: "not-green-3", label: "Not green 3", hex: "#ffffcc" },
  { id: "not-green-4", label: "Not green 4", hex: "#ffccff" },
  { id: "not-green-5", label: "Not green 5", hex: "#ccffff" },
  { id: "really-light-green", label: "Really really light green", hex: "#ffffff" },
];

const STORAGE_KEY_COLOR = `${APP_KEY}.colorTheme`;
const STORAGE_KEY_MODE = `${APP_KEY}.mode`;

// Pre-mode-axis key, values were a flat swatch id.
const LEGACY_KEY_COLOR = `${APP_KEY}.theme`;
const LEGACY_COLOR_IDS = {
  classic: "classic",
  notgreen1: "not-green-1",
  notgreen2: "not-green-2",
  notgreen3: "not-green-3",
  notgreen4: "not-green-4",
  notgreen5: "not-green-5",
  white: "really-light-green",
};

function hexToRgb(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

// Carries the old swatch choice over once, then drops the old key. Mode has
// no legacy equivalent, so it falls back to the light default.
function migrateLegacyTheme() {
  const legacy = localStorage.getItem(LEGACY_KEY_COLOR);
  if (!legacy) return;
  if (!localStorage.getItem(STORAGE_KEY_COLOR) && LEGACY_COLOR_IDS[legacy]) {
    localStorage.setItem(STORAGE_KEY_COLOR, LEGACY_COLOR_IDS[legacy]);
  }
  localStorage.removeItem(LEGACY_KEY_COLOR);
}

function getStoredColorTheme() {
  return localStorage.getItem(STORAGE_KEY_COLOR) || "classic";
}

/* Mode preference and mode are different things. The preference is what the
   person chose and can be "time"; the mode is what the document is in and
   is only ever light or dark. */

const MODE_PREFERENCES = ["light", "dark", "time"];

/* The daylight window. Duplicated in the pre-paint script in index.html,
   which has to resolve this before first paint and cannot import anything.
   Change both together. */
const LIGHT_FROM_HOUR = 9;
const LIGHT_UNTIL_HOUR = 18;

function getModePreference() {
  const v = localStorage.getItem(STORAGE_KEY_MODE);
  return MODE_PREFERENCES.includes(v) ? v : "light";
}

function isDaylightHours(now = new Date()) {
  const hour = now.getHours();
  return hour >= LIGHT_FROM_HOUR && hour < LIGHT_UNTIL_HOUR;
}

function resolveMode(preference) {
  if (preference === "time") return isDaylightHours() ? "light" : "dark";
  return preference === "dark" ? "dark" : "light";
}

// The mode the document is in right now, resolved. What the theme button
// icon and anything else reading the active mode wants.
function getStoredMode() {
  return resolveMode(getModePreference());
}

function applyColorTheme(id) {
  const theme = COLOR_THEMES.find((t) => t.id === id) || COLOR_THEMES[0];
  document.documentElement.setAttribute("data-color-theme", theme.id);
  document.documentElement.style.setProperty("--brand", theme.hex);
  document.documentElement.style.setProperty("--brand-rgb", hexToRgb(theme.hex));
  localStorage.setItem(STORAGE_KEY_COLOR, theme.id);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme.hex);
  return theme;
}

function applyMode(preference) {
  const chosen = MODE_PREFERENCES.includes(preference) ? preference : "light";
  const resolved = resolveMode(chosen);

  document.documentElement.setAttribute("data-mode", resolved);
  document.documentElement.setAttribute("data-mode-preference", chosen);
  localStorage.setItem(STORAGE_KEY_MODE, chosen);

  scheduleModeCheck();

  return resolved;
}

/* Keeping the time based mode honest while the page stays open. */

let modeTimer = null;
let watchingVisibility = false;

// Milliseconds until the next 09:00 or 18:00, whichever comes first.
function msUntilNextBoundary(now = new Date()) {
  const next = new Date(now);
  next.setMinutes(0, 0, 0);

  const hour = now.getHours();
  if (hour < LIGHT_FROM_HOUR) {
    next.setHours(LIGHT_FROM_HOUR);
  } else if (hour < LIGHT_UNTIL_HOUR) {
    next.setHours(LIGHT_UNTIL_HOUR);
  } else {
    next.setDate(next.getDate() + 1);
    next.setHours(LIGHT_FROM_HOUR);
  }

  // A second of slack, so a timer that fires a fraction early does not land
  // back in the hour it just left and reschedule itself in a tight loop.
  return Math.max(1000, next.getTime() - now.getTime() + 1000);
}

function scheduleModeCheck() {
  if (modeTimer !== null) {
    clearTimeout(modeTimer);
    modeTimer = null;
  }

  if (getModePreference() !== "time") return;

  modeTimer = setTimeout(() => {
    modeTimer = null;
    refreshTimeMode();
  }, msUntilNextBoundary());

  if (!watchingVisibility && typeof document !== "undefined") {
    watchingVisibility = true;
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") refreshTimeMode();
    });
  }
}

function refreshTimeMode() {
  if (getModePreference() !== "time") return;

  const resolved = resolveMode("time");
  const current = document.documentElement.getAttribute("data-mode");

  if (resolved !== current) {
    document.documentElement.setAttribute("data-mode", resolved);
    document.dispatchEvent(
      new CustomEvent("uwu:modechange", {
        detail: { mode: resolved, preference: "time" },
      })
    );
  }

  scheduleModeCheck();
}

function initTheme() {
  migrateLegacyTheme();
  applyColorTheme(getStoredColorTheme());
  // The preference, not the resolved mode. Passing the resolved one would
  // quietly rewrite a stored "time" into "dark" the first evening.
  applyMode(getModePreference());
}

/* ─── Theme modal ─── */

function buildThemeModal() {
  const grid = document.getElementById("swatchGrid");
  if (!grid) return;
  grid.innerHTML = COLOR_THEMES.map(
    (t) => `
      <button class="swatch" data-theme-id="${t.id}" style="--swatch-color:${t.hex}" type="button" aria-label="${t.label}">
        <span class="swatch-dot"></span>
        <span class="swatch-label">${t.label}</span>
      </button>`
  ).join("");

  syncThemeModalState();

  grid.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-theme-id]");
    if (!btn) return;
    applyColorTheme(btn.dataset.themeId);
    syncThemeModalState();
  });

  document.getElementById("modeToggle").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-mode]");
    if (!btn) return;
    applyMode(btn.dataset.mode);
    syncThemeModalState();
  });

  // A tab left open across 09:00 or 18:00 re-resolves itself; redraw the
  // modal so the note and pressed state stay in step with the change.
  document.addEventListener("uwu:modechange", syncThemeModalState);
}

function syncThemeModalState() {
  const activeTheme = getStoredColorTheme();
  const activePreference = getModePreference();
  const resolvedMode = getStoredMode();

  document.querySelectorAll("#swatchGrid .swatch").forEach((el) => {
    el.classList.toggle("active", el.dataset.themeId === activeTheme);
  });
  document.querySelectorAll("#modeToggle .mode-btn").forEach((el) => {
    const isActive = el.dataset.mode === activePreference;
    el.classList.toggle("active", isActive);
    el.setAttribute("aria-pressed", String(isActive));
  });

  const note = document.getElementById("modeNote");
  if (note) {
    note.hidden = activePreference !== "time";
    if (activePreference === "time") {
      note.textContent = `Following the clock. Currently ${resolvedMode}.`;
    }
  }

  updateThemeButtonIcon();
}

function updateThemeButtonIcon() {
  const span = document.querySelector("#themeBtn [data-icon]");
  if (!span) return;
  span.setAttribute("data-icon", getStoredMode() === "dark" ? "moon" : "sun");
  hydrateIcons(document.getElementById("themeBtn"));
}

function wireModals() {
  document.querySelectorAll("[data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", () => closeModal(btn.dataset.closeModal));
  });
  document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) closeModal(backdrop.id);
    });
  });
  const themeBtn = document.getElementById("themeBtn");
  if (themeBtn) themeBtn.addEventListener("click", () => openModal("themeModal"));

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    document.querySelectorAll(".modal-backdrop:not(.hidden)").forEach((m) => closeModal(m.id));
  });
}

initTheme();

document.addEventListener("DOMContentLoaded", () => {
  hydrateIcons();
  updateThemeButtonIcon();
  buildThemeModal();
  wireModals();
});
