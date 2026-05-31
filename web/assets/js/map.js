// Reusable Yandex Maps JavaScript API v3 helper.
//
// Responsibilities:
//  - Load the v3 script exactly once and wait for ymaps3.ready.
//  - Create / update / clear / fit / destroy a map instance.
//  - Convert backend { latitude, longitude } -> Yandex [longitude, latitude].
//  - Cluster many points through the official ymaps3 clusterer package.
//  - Fail gracefully on missing API key, script load failure or empty data.
//
// IMPORTANT: Yandex Maps v3 expects coordinates as [longitude, latitude].

// Default view centers on Kazakhstan. Stored as [longitude, latitude].
export const KAZAKHSTAN_CENTER = [67.0, 48.0];
export const KAZAKHSTAN_ZOOM = 4.2;

const POINT_SOURCE_ID = "timeleak-location-points";
const PACKAGE_CDN = "https://cdn.jsdelivr.net/npm/{package}";

export class MapError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = "MapError";
    this.code = code;
  }
}

let loadPromise = null;
let packagesRegistered = false;

function langToYandex(lang) {
  switch (lang) {
    case "ru":
    case "kz":
      return "ru_RU";
    case "en":
    default:
      return "en_US";
  }
}

// toYandexCoords converts a backend point to Yandex [longitude, latitude].
export function toYandexCoords(point) {
  return [Number(point.longitude), Number(point.latitude)];
}

function hasValidCoords(point) {
  const lat = Number(point.latitude);
  const lon = Number(point.longitude);
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}

function waitForYmapsReady(ymaps3) {
  if (!ymaps3 || !ymaps3.ready || typeof ymaps3.ready.then !== "function") {
    return Promise.reject(new MapError("script_invalid", "Yandex Maps v3 did not initialize"));
  }

  return ymaps3.ready.then(() => ymaps3);
}

function registerYmapsPackages(ymaps3) {
  if (packagesRegistered || !ymaps3.import || typeof ymaps3.import.registerCdn !== "function") {
    return;
  }

  try {
    ymaps3.import.registerCdn(PACKAGE_CDN, [
      "@yandex/ymaps3-clusterer@0.0.1",
      "@yandex/ymaps3-default-ui-theme@0.0",
    ]);
    packagesRegistered = true;
  } catch {
    // Packages can still be available through Yandex's own module resolver.
  }
}

// loadYandexMaps loads the v3 script once and resolves with the ymaps3 global.
export function loadYandexMaps(apiKey, lang = "en") {
  const key = String(apiKey || "").trim();
  if (!key) {
    return Promise.reject(new MapError("missing_api_key", "Yandex Maps API key is not configured"));
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise((resolve, reject) => {
    if (window.ymaps3) {
      waitForYmapsReady(window.ymaps3).then(resolve).catch(reject);
      return;
    }

    const script = document.createElement("script");
    script.src = `https://api-maps.yandex.ru/v3/?apikey=${encodeURIComponent(key)}&lang=${langToYandex(lang)}`;
    script.async = true;
    script.dataset.timeleakYandexMaps = "3";
    script.onload = () => {
      if (!window.ymaps3) {
        reject(new MapError("script_invalid", "Yandex Maps v3 did not initialize"));
        return;
      }
      waitForYmapsReady(window.ymaps3).then(resolve).catch(reject);
    };
    script.onerror = () => {
      loadPromise = null; // allow a later retry
      reject(new MapError("script_load_failed", "Failed to load Yandex Maps v3 script"));
    };
    document.head.appendChild(script);
  });

  loadPromise.catch(() => {
    loadPromise = null;
  });

  return loadPromise;
}

function buildClusterMarkerElement(count) {
  const el = document.createElement("div");
  el.className = "map-cluster-marker";
  el.textContent = String(count);
  return el;
}

function buildPointMarkerElement() {
  const el = document.createElement("div");
  el.className = "map-point-marker";
  return el;
}

function addMapChild(map, child) {
  if (child) {
    map.addChild(child);
  }
}

// createMap initializes a YMap v3 instance inside the container. Returns a controller object.
export async function createMap(container, { center = KAZAKHSTAN_CENTER, zoom = KAZAKHSTAN_ZOOM, lang = "en", apiKey } = {}) {
  const ymaps3 = await loadYandexMaps(apiKey, lang);
  registerYmapsPackages(ymaps3);

  const {
    YMap,
    YMapDefaultSchemeLayer,
    YMapDefaultFeaturesLayer,
    YMapControls,
    YMapFeatureDataSource,
    YMapLayer,
  } = ymaps3;

  // Clear any previous content (e.g. an old map or placeholder).
  container.innerHTML = "";

  const map = new YMap(container, {
    location: { center, zoom },
    behaviors: ["drag", "scrollZoom", "pinchZoom", "dblClick"],
  });

  addMapChild(map, new YMapDefaultSchemeLayer({}));
  addMapChild(map, new YMapDefaultFeaturesLayer({ zIndex: 1700 }));
  if (YMapFeatureDataSource && YMapLayer) {
    addMapChild(map, new YMapFeatureDataSource({ id: POINT_SOURCE_ID }));
    addMapChild(map, new YMapLayer({ source: POINT_SOURCE_ID, type: "markers", zIndex: 1800 }));
  }

  try {
    const { YMapZoomControl } = await ymaps3.import("@yandex/ymaps3-default-ui-theme");
    if (YMapControls && YMapZoomControl) {
      const controls = new YMapControls({ position: "right" });
      controls.addChild(new YMapZoomControl({}));
      map.addChild(controls);
    }
  } catch {
    // Zoom control is optional; ignore if the UI package is unavailable.
  }

  const controller = {
    ymaps3,
    map,
    clusterer: null,
    markers: [],
    onPointClick: null,
    destroyed: false,
  };

  // Try to attach the clusterer package. If it is unavailable we fall back to
  // plain HTML markers in renderLocationPoints.
  try {
    const clustererPkg = await ymaps3.import("@yandex/ymaps3-clusterer");
    const { YMapClusterer, clusterByGrid } = clustererPkg;
    const { YMapMarker } = ymaps3;

    const marker = (feature) => {
      const el = buildPointMarkerElement();
      el.addEventListener("click", () => {
        if (controller.onPointClick) {
          controller.onPointClick(feature.properties.point);
        }
      });

      return new YMapMarker(
        { coordinates: feature.geometry.coordinates, source: POINT_SOURCE_ID },
        el,
      );
    };

    const cluster = (coordinates, features) => {
      const el = buildClusterMarkerElement(features.length);
      el.addEventListener("click", () => {
        const currentZoom = Number(controller.map.zoom || controller.map.location?.zoom || KAZAKHSTAN_ZOOM);
        controller.map.update({ location: { center: coordinates, zoom: currentZoom + 2, duration: 300 } });
      });

      return new YMapMarker({ coordinates, source: POINT_SOURCE_ID }, el);
    };

    controller.clusterer = new YMapClusterer({
      method: clusterByGrid({ gridSize: 64 }),
      features: [],
      marker,
      cluster,
    });
    map.addChild(controller.clusterer);
  } catch {
    controller.clusterer = null;
  }

  return controller;
}

function pointsToFeatures(points) {
  return points.filter(hasValidCoords).map((point) => ({
    type: "Feature",
    id: String(point.id),
    geometry: { type: "Point", coordinates: toYandexCoords(point) },
    properties: { point },
  }));
}

// renderLocationPoints replaces the rendered points without recreating the map.
export function renderLocationPoints(controller, points = [], onPointClick) {
  if (!controller || controller.destroyed) {
    return;
  }
  controller.onPointClick = onPointClick || controller.onPointClick;
  const features = pointsToFeatures(points);

  if (controller.clusterer) {
    controller.clusterer.update({ features });
    return;
  }

  // Fallback path: plain HTML markers, capped to keep the map responsive.
  clearMarkers(controller);
  const { YMapMarker } = controller.ymaps3;
  const capped = features.slice(0, 500);
  capped.forEach((feature) => {
    const el = buildPointMarkerElement();
    el.addEventListener("click", () => {
      if (controller.onPointClick) {
        controller.onPointClick(feature.properties.point);
      }
    });

    const marker = new YMapMarker(
      { coordinates: feature.geometry.coordinates, source: POINT_SOURCE_ID },
      el,
    );
    controller.map.addChild(marker);
    controller.markers.push(marker);
  });
}

function clearMarkers(controller) {
  controller.markers.forEach((marker) => {
    try {
      controller.map.removeChild(marker);
    } catch {
      /* already detached */
    }
  });
  controller.markers = [];
}

// clearMap removes all rendered points.
export function clearMap(controller) {
  if (!controller || controller.destroyed) {
    return;
  }
  if (controller.clusterer) {
    controller.clusterer.update({ features: [] });
    return;
  }
  clearMarkers(controller);
}

// fitToPoints centers/zooms the map to contain the supplied points.
export function fitToPoints(controller, points = []) {
  if (!controller || controller.destroyed) {
    return;
  }
  const valid = points.filter(hasValidCoords);
  if (valid.length === 0) {
    controller.map.update({ location: { center: KAZAKHSTAN_CENTER, zoom: KAZAKHSTAN_ZOOM, duration: 300 } });
    return;
  }
  if (valid.length === 1) {
    controller.map.update({ location: { center: toYandexCoords(valid[0]), zoom: 11, duration: 300 } });
    return;
  }

  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  valid.forEach((point) => {
    const [lon, lat] = toYandexCoords(point);
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  });

  // Pad the bounds slightly so markers are not flush against the edge.
  const padLon = Math.max((maxLon - minLon) * 0.1, 0.05);
  const padLat = Math.max((maxLat - minLat) * 0.1, 0.05);

  try {
    controller.map.update({
      location: {
        bounds: [
          [minLon - padLon, maxLat + padLat],
          [maxLon + padLon, minLat - padLat],
        ],
        duration: 300,
      },
    });
  } catch {
    const centerLon = (minLon + maxLon) / 2;
    const centerLat = (minLat + maxLat) / 2;
    controller.map.update({ location: { center: [centerLon, centerLat], zoom: 5, duration: 300 } });
  }
}

// destroyMap tears down the map instance.
export function destroyMap(controller) {
  if (!controller || controller.destroyed) {
    return;
  }
  try {
    controller.map.destroy();
  } catch {
    /* ignore */
  }
  controller.destroyed = true;
  controller.clusterer = null;
  controller.markers = [];
}
