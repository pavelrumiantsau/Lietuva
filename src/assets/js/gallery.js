(function () {
  var grid = document.getElementById("gallery-grid");
  if (!grid) return;

  var links = Array.prototype.slice.call(grid.querySelectorAll("a"));
  if (!links.length) return;

  var strings = window.GALLERY_STRINGS || {
    close: "Close",
    prev: "Previous photo",
    next: "Next photo",
    viewer: "Photo viewer",
  };

  var currentIndex = -1;
  var lastFocused = null;

  var overlay = document.createElement("div");
  overlay.className = "lightbox";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", strings.viewer);
  overlay.hidden = true;
  overlay.innerHTML =
    '<button type="button" class="lightbox__close" aria-label="' + strings.close + '">×</button>' +
    '<button type="button" class="lightbox__prev" aria-label="' + strings.prev + '">‹</button>' +
    '<img class="lightbox__image" alt="">' +
    '<button type="button" class="lightbox__next" aria-label="' + strings.next + '">›</button>' +
    '<p class="lightbox__status" aria-live="polite"></p>';
  document.body.appendChild(overlay);

  var imgEl = overlay.querySelector(".lightbox__image");
  var statusEl = overlay.querySelector(".lightbox__status");
  var closeBtn = overlay.querySelector(".lightbox__close");
  var prevBtn = overlay.querySelector(".lightbox__prev");
  var nextBtn = overlay.querySelector(".lightbox__next");
  var focusable = [closeBtn, prevBtn, nextBtn];

  function open(index, triggerEl) {
    currentIndex = index;
    lastFocused = triggerEl;
    show(index);
    overlay.hidden = false;
    document.body.classList.add("lightbox-open");
    document.addEventListener("keydown", onKeydown);
    closeBtn.focus();
  }

  function close() {
    overlay.hidden = true;
    document.body.classList.remove("lightbox-open");
    document.removeEventListener("keydown", onKeydown);
    if (lastFocused) lastFocused.focus();
  }

  function show(index) {
    var link = links[index];
    var thumbImg = link.querySelector("img");
    imgEl.src = link.getAttribute("href");
    imgEl.alt = thumbImg ? thumbImg.getAttribute("alt") : "";
    statusEl.textContent = (index + 1) + " / " + links.length;
    prevBtn.disabled = index === 0;
    nextBtn.disabled = index === links.length - 1;
  }

  function step(delta) {
    var next = currentIndex + delta;
    if (next < 0 || next >= links.length) return;
    currentIndex = next;
    show(currentIndex);
    closeBtn.focus();
  }

  function onKeydown(e) {
    if (e.key === "Escape") {
      close();
    } else if (e.key === "ArrowLeft") {
      step(-1);
    } else if (e.key === "ArrowRight") {
      step(1);
    } else if (e.key === "Tab") {
      var idx = focusable.indexOf(document.activeElement);
      var dir = e.shiftKey ? -1 : 1;
      var nextIdx = (idx + dir + focusable.length) % focusable.length;
      e.preventDefault();
      focusable[nextIdx].focus();
    }
  }

  links.forEach(function (link, index) {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      open(index, link);
    });
  });

  closeBtn.addEventListener("click", close);
  prevBtn.addEventListener("click", function () { step(-1); });
  nextBtn.addEventListener("click", function () { step(1); });
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) close();
  });
})();
