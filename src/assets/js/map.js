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

  var LITHUANIA_BOUNDS = [
    [53.85, 20.85],
    [56.55, 26.95],
  ];

  var map = L.map(mapEl, {
    keyboard: true,
    maxBounds: LITHUANIA_BOUNDS,
    maxBoundsViscosity: 0.9,
    minZoom: 7,
  });
  map.fitBounds(LITHUANIA_BOUNDS);

  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 19,
  }).addTo(map);

  var clusterGroup = L.markerClusterGroup({ maxClusterRadius: 45 });

  places.forEach(function (place) {
    var lat = place.lat;
    var lng = place.lng;
    if (typeof lat !== "number" || typeof lng !== "number") return;

    var name = place.name || place.slug;
    var desc = place.shortDescription || "";
    var placeUrl = "/" + lang + "/places/" + place.slug + "/";
    var thumbSrc = place.highlightPhoto
      ? "/assets/photos/" + place.slug + "/thumb/" + place.highlightPhoto
      : "";

    var icon = L.divIcon({
      className: "place-dot",
      html: '<span class="place-dot__inner" aria-hidden="true"></span>',
      iconSize: [32, 32],
    });

    var marker = L.marker([lat, lng], { icon: icon, title: name });

    marker.on("add", function () {
      var el = marker.getElement();
      if (el) el.setAttribute("aria-label", name + " — " + exploreLabel);
    });

    var popupHtml =
      '<div class="place-popup">' +
      (thumbSrc ? '<img src="' + thumbSrc + '" alt="" loading="lazy" width="220" height="165">' : "") +
      "<h3>" + escapeHtml(name) + "</h3>" +
      (desc ? "<p>" + escapeHtml(desc) + "</p>" : "") +
      '<a class="explore-btn" href="' + placeUrl + '">' + escapeHtml(exploreLabel) + "</a>" +
      "</div>";

    marker.bindPopup(popupHtml);
    clusterGroup.addLayer(marker);
  });

  map.addLayer(clusterGroup);

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
})();
