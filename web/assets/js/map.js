// Reusable Yandex Maps JavaScript API 2.1 helper.
//
// Responsibilities:
//  - Load the 2.1 script exactly once and wait for ymaps.ready.
//  - Create / update / clear / fit / destroy a map instance.
//  - Convert backend { latitude, longitude } -> Yandex [latitude, longitude].
//  - Cluster many points through the built-in Clusterer.
//  - Fail gracefully on missing API key, script load failure or empty data.
//
// IMPORTANT: Yandex Maps 2.1 expects coordinates as [latitude, longitude].

// Default view centers on Kazakhstan. Stored as [latitude, longitude].
export const KAZAKHSTAN_CENTER = [48.0, 67.0];
export const KAZAKHSTAN_ZOOM = 5;

export class MapError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = "MapError";
    this.code = code;
  }
}

let loadPromise = null;

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

// toYandexCoords converts a backend point to Yandex [latitude, longitude].
export function toYandexCoords(point) {
  return [Number(point.latitude), Number(point.longitude)];
}

function hasValidCoords(point) {
  const lat = Number(point.latitude);
  const lon = Number(point.longitude);
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}

function waitForYmapsReady(ymaps) {
  return new Promise((resolve, reject) => {
    let done = false;
    const timeoutID = window.setTimeout(() => {
      if (!done) {
        done = true;
        reject(new MapError("script_timeout", "Yandex Maps initialization timed out"));
      }
    }, 15000);

    const complete = () => {
      if (done) {
        return;
      }
      done = true;
      window.clearTimeout(timeoutID);
      resolve(ymaps);
    };

    const fail = (error) => {
      if (done) {
        return;
      }
      done = true;
      window.clearTimeout(timeoutID);
      reject(error instanceof Error ? error : new MapError("script_invalid", "Yandex Maps did not initialize"));
    };

    try {
      ymaps.ready(complete, fail);
    } catch (error) {
      fail(error);
    }
  });
}

// loadYandexMaps loads the 2.1 script once and resolves with the ymaps global.
export function loadYandexMaps(apiKey, lang = "en") {
  const key = String(apiKey || "").trim();
  if (!key) {
    return Promise.reject(new MapError("missing_api_key", "Yandex Maps API key is not configured"));
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise((resolve, reject) => {
    if (window.ymaps) {
      waitForYmapsReady(window.ymaps).then(resolve).catch(reject);
      return;
    }

    const script = document.createElement("script");
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(key)}&lang=${langToYandex(lang)}&load=package.full`;
    script.async = true;
    script.dataset.timeleakYandexMaps = "2.1";
    script.onload = () => {
      if (!window.ymaps) {
        reject(new MapError("script_invalid", "Yandex Maps did not initialize"));
        return;
      }
      waitForYmapsReady(window.ymaps).then(resolve).catch(reject);
    };
    script.onerror = () => {
      loadPromise = null; // allow a later retry
      reject(new MapError("script_load_failed", "Failed to load Yandex Maps script"));
    };
    document.head.appendChild(script);
  });

  loadPromise.catch(() => {
    loadPromise = null;
  });

  return loadPromise;
}

// createMap initializes a Yandex 2.1 map inside the container. Returns a controller object.
export async function createMap(container, { center = KAZAKHSTAN_CENTER, zoom = KAZAKHSTAN_ZOOM, lang = "en", apiKey } = {}) {
  const ymaps = await loadYandexMaps(apiKey, lang);

  // Clear any previous content (e.g. an old map or placeholder).
  container.innerHTML = "";

  const map = new ymaps.Map(
    container,
    {
      center,
      zoom,
      controls: ["zoomControl"],
    },
    {
      suppressMapOpenBlock: true,
      yandexMapDisablePoiInteractivity: true,
    },
  );

  const controller = {
    ymaps,
    map,
    clusterer: null,
    markers: [],
    onPointClick: null,
    destroyed: false,
  };

  if (typeof ymaps.Clusterer === "function") {
    controller.clusterer = new ymaps.Clusterer({
      clusterDisableClickZoom: false,
      clusterHideIconOnBalloonOpen: false,
      clusterOpenBalloonOnClick: false,
      groupByCoordinates: false,
      gridSize: 64,
      preset: "islands#blueClusterIcons",
    });
    map.geoObjects.add(controller.clusterer);
  }

  try {
    map.behaviors.enable(["drag", "scrollZoom", "multiTouch", "dblClickZoom"]);
    map.container.fitToViewport();
  } catch {
    /* optional map behavior */
  }

  return controller;
}

function pointsToPlacemarks(controller, points) {
  return points.filter(hasValidCoords).map((point) => {
    const placemark = new controller.ymaps.Placemark(
      toYandexCoords(point),
      {},
      {
        iconColor: "#2563ff",
        openBalloonOnClick: false,
        preset: "islands#blueCircleDotIcon",
      },
    );

    placemark.events.add("click", () => {
      if (controller.onPointClick) {
        controller.onPointClick(point);
      }
    });

    return placemark;
  });
}

// renderLocationPoints replaces the rendered points without recreating the map.
export function renderLocationPoints(controller, points = [], onPointClick) {
  if (!controller || controller.destroyed) {
    return;
  }
  controller.onPointClick = onPointClick || controller.onPointClick;

  if (controller.clusterer) {
    controller.clusterer.removeAll();
    controller.markers = pointsToPlacemarks(controller, points);
    controller.clusterer.add(controller.markers);
    return;
  }

  // Fallback path: plain markers, capped to keep the map responsive.
  clearMarkers(controller);
  const capped = pointsToPlacemarks(controller, points).slice(0, 500);
  capped.forEach((placemark) => controller.map.geoObjects.add(placemark));
  controller.markers = capped;
}

function clearMarkers(controller) {
  controller.markers.forEach((marker) => {
    try {
      controller.map.geoObjects.remove(marker);
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
    controller.clusterer.removeAll();
    controller.markers = [];
    return;
  }
  clearMarkers(controller);
}

function setMapCenter(controller, center, zoom) {
  try {
    controller.map.setCenter(center, zoom, { duration: 300 });
  } catch {
    /* ignore */
  }
}

// fitToPoints centers/zooms the map to contain the supplied points.
export function fitToPoints(controller, points = []) {
  if (!controller || controller.destroyed) {
    return;
  }
  const valid = points.filter(hasValidCoords);
  if (valid.length === 0) {
    setMapCenter(controller, KAZAKHSTAN_CENTER, KAZAKHSTAN_ZOOM);
    return;
  }
  if (valid.length === 1) {
    setMapCenter(controller, toYandexCoords(valid[0]), 11);
    return;
  }

  let minLat = Infinity;
  let minLon = Infinity;
  let maxLat = -Infinity;
  let maxLon = -Infinity;
  valid.forEach((point) => {
    const [lat, lon] = toYandexCoords(point);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
  });

  // Pad the bounds slightly so markers are not flush against the edge.
  const padLat = Math.max((maxLat - minLat) * 0.1, 0.05);
  const padLon = Math.max((maxLon - minLon) * 0.1, 0.05);
  const bounds = [
    [minLat - padLat, minLon - padLon],
    [maxLat + padLat, maxLon + padLon],
  ];

  try {
    const result = controller.map.setBounds(bounds, {
      checkZoomRange: true,
      duration: 300,
      zoomMargin: [40, 40, 40, 40],
    });
    if (result && typeof result.catch === "function") {
      result.catch(() => {
        setMapCenter(controller, [(minLat + maxLat) / 2, (minLon + maxLon) / 2], 5);
      });
    }
  } catch {
    setMapCenter(controller, [(minLat + maxLat) / 2, (minLon + maxLon) / 2], 5);
  }
}

// destroyMap tears down the map instance.
export function destroyMap(controller) {
  if (!controller || controller.destroyed) {
    return;
  }
  try {
    if (controller.clusterer) {
      controller.clusterer.removeAll();
    }
    controller.map.destroy();
  } catch {
    /* ignore */
  }
  controller.destroyed = true;
  controller.clusterer = null;
  controller.markers = [];
}
