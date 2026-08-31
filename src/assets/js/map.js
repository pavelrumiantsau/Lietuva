(function () {
  var dataEl = document.getElementById("places-data");
  var mapEl = document.getElementById("map");
  if (!dataEl || !mapEl || typeof L === "undefined") return;

  var places;
  try {
    places = JSON.parse(dataEl.textContent);
  } catch (e) {
    return;
  }

  var lang = window.SITE_LANG || "lt";
  var exploreLabel = (window.SITE_STRINGS && window.SITE_STRINGS.explore) || "Explore";
  var pathPrefix = (window.SITE_PATH_PREFIX || "/").replace(/\/$/, "");

  var LITHUANIA_BOUNDS = [
    [53.85, 20.85],
    [56.55, 26.95],
  ];

  // maxBounds is padded beyond the strict Lithuania rectangle above so that
  // popups for markers sitting near the edge (e.g. Žagarė, right at the
  // northern border) have room to autoPan fully into view instead of being
  // clipped against a max extent that's flush with the marker itself.
  var MAX_BOUNDS = [
    [LITHUANIA_BOUNDS[0][0] - 0.5, LITHUANIA_BOUNDS[0][1] - 0.5],
    [LITHUANIA_BOUNDS[1][0] + 0.5, LITHUANIA_BOUNDS[1][1] + 0.5],
  ];

  var map = L.map(mapEl, {
    keyboard: true,
    maxBounds: MAX_BOUNDS,
    maxBoundsViscosity: 0.9,
    minZoom: 7,
  });
  map.fitBounds(LITHUANIA_BOUNDS);

  // maps.wikimedia.org (used previously) blocks any request that carries a
  // Referer header from outside wikimedia.org with a 403 — fine for curl
  // (which sends no Referer) but every browser sends one, so tiles never
  // loaded. OSM's own tile server has no such restriction.
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(map);

  var clusterGroup = L.markerClusterGroup({ maxClusterRadius: 45 });

  places.forEach(function (place) {
    var lat = place.lat;
    var lng = place.lng;
    if (typeof lat !== "number" || typeof lng !== "number") return;

    var name = place.name || place.slug;
    var desc = place.shortDescription || "";
    var placeUrl = place.url || pathPrefix + "/" + lang + "/places/" + place.slug + "/";
    var thumbSrc = place.highlightPhoto
      ? pathPrefix + "/assets/photos/" + place.slug + "/thumb/" + place.highlightPhoto
      : "";

    // The dot icon is a 32x32 box (comfortable touch target) with a 14px
    // visible circle centered inside it via flexbox — iconAnchor sits at the
    // box's center, which is also the visible circle's center, so it lines
    // up with the marker's true geographic point. popupAnchor is relative to
    // that same anchor point, so -7 (the circle's own radius) puts the
    // popup's tip right at the circle's top edge instead of floating above
    // empty space in the rest of the 32x32 box.
    var icon = L.divIcon({
      className: "place-dot",
      html: '<span class="place-dot__inner" aria-hidden="true"></span>',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -7],
    });

    var marker = L.marker([lat, lng], { icon: icon, title: name });

    marker.on("add", function () {
      var el = marker.getElement();
      if (el) el.setAttribute("aria-label", name + " — " + exploreLabel);
    });

    var popupHtml =
      '<div class="place-popup">' +
      (thumbSrc ? '<img src="' + thumbSrc + '" alt="" loading="lazy" width="200" height="150">' : "") +
      "<h3>" + escapeHtml(name) + "</h3>" +
      (desc ? "<p>" + escapeHtml(desc) + "</p>" : "") +
      '<a class="explore-btn" href="' + placeUrl + '">' + escapeHtml(exploreLabel) + "</a>" +
      "</div>";

    // No maxHeight here on purpose: a fixed cap forces an internal scrollbar
    // once a description wraps to an extra line (which varies a lot between
    // lt/en/uk for the same content), which is worse than just letting
    // autoPan give the popup all the room it needs.
    marker.bindPopup(popupHtml, {
      autoPanPadding: [16, 70],
      maxWidth: 240,
    });
    clusterGroup.addLayer(marker);
  });

  map.addLayer(clusterGroup);

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
})();
