/* ─── UI helpers ───
   Depends on icon() from icons.js. openModal/closeModal accept either an
   element or an id, plus an optional element to focus, so the spec call
   sites and the existing search.js call sites both work. */

// Safe to call repeatedly; re-renders when data-icon changes.
function hydrateIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((el) => {
    const name = el.dataset.icon;
    if (el.dataset.iconRendered === name) return;
    el.innerHTML = icon(name);
    el.dataset.iconRendered = name;
  });
}

function resolveModal(target) {
  return typeof target === "string" ? document.getElementById(target) : target;
}

/* Two modal shells coexist. .modal-backdrop animates off .hidden alone;
   the older .modal-overlay (search) needs .open added a frame later so the
   browser registers the starting point, and held until the fade finishes. */

function openModal(target, focusEl) {
  const modal = resolveModal(target);
  if (!modal) return;
  modal.classList.remove("hidden");
  if (modal.classList.contains("modal-overlay")) {
    requestAnimationFrame(() => modal.classList.add("open"));
  } else {
    document.body.classList.add("modal-open");
  }
  if (focusEl) setTimeout(() => focusEl.focus(), 0);
}

function closeModal(target, focusEl) {
  const modal = resolveModal(target);
  if (!modal) return;
  if (modal.classList.contains("modal-overlay")) {
    modal.classList.remove("open");
    const onEnd = (e) => {
      if (e.target !== modal) return;
      modal.classList.add("hidden");
      modal.removeEventListener("transitionend", onEnd);
    };
    modal.addEventListener("transitionend", onEnd);
  } else {
    modal.classList.add("hidden");
    if (!document.querySelector(".modal-backdrop:not(.hidden)")) {
      document.body.classList.remove("modal-open");
    }
  }
  if (focusEl) focusEl.focus();
}

window.hydrateIcons = hydrateIcons;
window.openModal = openModal;
window.closeModal = closeModal;
