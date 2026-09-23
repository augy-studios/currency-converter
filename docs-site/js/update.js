/* ─── Update prompt bar ───
   Registers the service worker once for the whole site and, when a new
   version has installed and is waiting, shows a slim bar at the top of the
   page: one sentence, Reload and Not now. Nothing reloads until the reader
   asks. The worker never activates on its own; the only thing that promotes
   it is the Reload button posting "skip-waiting".

   Dismissal is for this page view only and is never stored. */

(function () {
  const SW_URL = "/sw.js";
  const SITE_NAME = "the Currency API docs";

  const STRINGS = {
    label: "Update",
    ready: `A new version of ${SITE_NAME} is ready.`,
    reload: "Reload",
    later: "Not now",
  };

  // A tab left open for days never navigates, so the browser never looks for
  // a new worker by itself. Check again when the tab comes back into view, at
  // most this often.
  const RECHECK_MS = 60 * 60 * 1000;

  let registration = null;
  let waitingWorker = null;
  let reloading = false;
  let dismissed = false;
  let lastCheck = Date.now();
  let resizeObserver = null;

  function publishHeight(bar) {
    // Pages with a fixed header offset it by this; pages in normal flow
    // ignore it.
    const root = document.documentElement;
    if (bar) root.style.setProperty("--update-notice-h", `${bar.offsetHeight}px`);
    else root.style.removeProperty("--update-notice-h");
  }

  function removeBar(bar) {
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    bar.remove();
    publishHeight(null);
  }

  function render() {
    const existing = document.querySelector(".update-notice");

    if (!waitingWorker || dismissed) {
      if (existing && !existing.classList.contains("is-leaving")) {
        existing.classList.add("is-leaving");
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          removeBar(existing);
        };
        existing.addEventListener("animationend", finish, { once: true });
        setTimeout(finish, 250);
      }
      return;
    }

    if (existing) return;

    const bar = document.createElement("div");
    bar.className = "update-notice";
    bar.setAttribute("role", "status");
    bar.setAttribute("aria-label", STRINGS.label);

    const inner = document.createElement("div");
    inner.className = "update-notice-inner";

    const text = document.createElement("p");
    text.textContent = STRINGS.ready;

    const reload = document.createElement("button");
    reload.type = "button";
    reload.className = "btn btn--primary";
    reload.dataset.swUpdate = "";
    reload.textContent = STRINGS.reload;

    const later = document.createElement("button");
    later.type = "button";
    later.className = "btn btn--ghost";
    later.dataset.swLater = "";
    later.textContent = STRINGS.later;

    reload.addEventListener("click", () => {
      // The only place anything asks for skipWaiting. The reload happens on
      // controllerchange, not here.
      reload.disabled = true;
      waitingWorker?.postMessage("skip-waiting");
    });

    later.addEventListener("click", () => {
      dismissed = true;
      render();
    });

    inner.append(text, reload, later);
    bar.append(inner);
    document.body.prepend(bar);

    publishHeight(bar);
    if ("ResizeObserver" in window) {
      resizeObserver = new ResizeObserver(() => publishHeight(bar));
      resizeObserver.observe(bar);
    }
  }

  function watchForUpdate() {
    if (!registration) return;

    // A worker already waiting when the page opened. The ordinary case on the
    // second page view after a deploy.
    if (registration.waiting && navigator.serviceWorker.controller) {
      waitingWorker = registration.waiting;
      render();
    }

    registration.addEventListener("updatefound", () => {
      const installing = registration.installing;
      if (!installing) return;

      installing.addEventListener("statechange", () => {
        // `installed` with a controller present means an update. With no
        // controller it is a first install: nothing on screen to protect.
        if (installing.state === "installed" && navigator.serviceWorker.controller) {
          waitingWorker = registration.waiting ?? installing;
          render();
        }
      });
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastCheck < RECHECK_MS) return;
      lastCheck = Date.now();
      // Offline, or the server is unreachable: try again next time.
      registration.update().catch(() => {});
    });
  }

  function registerWorker() {
    if (!("serviceWorker" in navigator)) return;

    let controller = navigator.serviceWorker.controller;

    navigator.serviceWorker
      .register(SW_URL)
      .then((reg) => {
        registration = reg;
        watchForUpdate();
      })
      .catch((cause) => {
        // A refused registration is not a reason to break the page.
        console.warn("service worker registration failed:", cause);
      });

    // The swap, once somebody has accepted it. Reloading here rather than in
    // the click handler is what makes the page come back on the new version.
    // A page that had no controller before is being claimed by a first
    // install, which replaces nothing and needs no reload.
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      const previous = controller;
      controller = navigator.serviceWorker.controller;
      if (!previous || reloading) return;
      reloading = true;
      window.location.reload();
    });
  }

  // Registration on load, not immediately: installing fetches everything the
  // worker precaches, and starting that while the page is still fetching its
  // own assets makes a first visit slower for no gain.
  if (document.readyState === "complete") registerWorker();
  else window.addEventListener("load", registerWorker, { once: true });
})();
