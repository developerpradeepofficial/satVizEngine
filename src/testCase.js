import {
  Ion,
  Viewer,
  Camera,
  Rectangle,
  SceneMode,
  Transforms,
  Matrix4,
  Cartesian2,
  Cartesian3,
  HorizontalOrigin,
  VerticalOrigin,
  Color,
  Material,
  JulianDate,
  PolylineCollection,
  FrameRateMonitor,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  defaultValue,
  Entity,
  createWorldTerrain,
  createOsmBuildings,
  Cartographic,
  Math,
  EntityCluster,
  Resource,
} from "cesium";

// const fs = require("fs");
import "cesium/Build/Cesium/Widgets/widgets.css";
import "./css/main.css";
import "bootstrap/dist/css/bootstrap.min.css";
// import { $ } from 'jquery';
import "jquery/dist/jquery.min.js";
import "popper.js/dist/umd/popper.min.js";
import "bootstrap/dist/js/bootstrap.min.js";
const satellite = require("satellite.js");
// Your access token can be found at: https://cesium.com/ion/tokens.

// This is the default access token
Ion.defaultAccessToken =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJlYWE1OWUxNy1mMWZiLTQzYjYtYTQ0OS1kMWFjYmFkNjc5YzciLCJpZCI6NTc3MzMsImlhdCI6MTYyNzg0NTE4Mn0.XcKpgANiY19MC4bdFUXMVEBToBmqS8kuYpUlxJHYZxk";

// Initialize the Cesium Viewer in the HTML element with the `cesiumContainer` ID.
const viewer = new Viewer("cesiumContainer", {
  //create viewer
  geocoder: true, //disables search bar
  infoBox: true,
  navigationInstructionsInitiallyVisible: false, //disables instructions on start
  sceneModePicker: true, //disables scene mode picker
  shouldAnimate: true,
  selectionIndicator: true,
  // sceneMode: SceneMode.SCENE2D,
  navigationHelpButton: false,
  geocoder: new OpenStreetMapNominatimGeocoder(),
});
// viewer.scene.primitives.add(createOsmBuildings());

// Add Cesium OSM Buildings, a global 3D buildings layer.
// viewer.scene.primitives.add(createOsmBuildings());

// Create a new entity
Camera.DEFAULT_VIEW_RECTANGLE = Rectangle.fromDegrees(-60, -40, 60, 80); //sets default view

//REMOVE BING IMAGERY
// const viewModel = viewer.baseLayerPicker.viewModel;
// viewModel.imageryProviderViewModels =
//   viewModel.imageryProviderViewModels.filter((el) => {
//     return el.category !== "Cesium ion";
//   });
// viewModel.selectedImagery = viewModel.imageryProviderViewModels[2]; //select default imageryProvider

const scene = viewer.scene;
scene.debugShowFramesPerSecond = true;
const globe = viewer.scene.globe;
const clock = viewer.clock;
const entities = viewer.entities;
const frameRateMonitor = new FrameRateMonitor({
  scene: viewer.scene,
  quietPeriod: 0,
});
viewer.homeButton.viewModel.duration = 1;
let dataLoadingInProgress = false;
let dataLoadingProgress = 0;
//POLYLINES
const polylines = new PolylineCollection(); //collection for displaying orbits
scene.primitives.add(polylines);

//change lighting parameters
globe.nightFadeInDistance = 40000000;
globe.nightFadeOutDistance = 10000000;

document.getElementById("ui").style.visibility = "visible"; //makes options visible after loading javascript
let satUpdateIntervalTime = 10; //update interval in ms
const orbitSteps = 33; //number of steps in predicted orbit
let satellitesData = []; //currently displayed satellites TLE data (name, satrec)
let displayedOrbit = undefined; //displayed orbit data [satrec, refresh time in seconds]
let lastOrbitUpdateTime = JulianDate.now();

// Satellite Categories to get from API
const TLEsources = [
  {
    name: "active",
    "label-en": "All active",
    url: "active&FORMAT=tle",
  },
  {
    name: "brightest",
    "label-en": "The brightest",
    url: "visual&FORMAT=tle",
  },
  {
    name: "weather",
    "label-en": "Weather",
    url: "weather&FORMAT=tle",
  },
  {
    name: "geosync",
    "label-en": "Geosynchronous",
    url: "geo&FORMAT=tle",
  },

  {
    name: "starlink",
    "label-en": "Starlink",
    url: "starlink&FORMAT=tle",
  },
  {
    name: "gps",
    "label-en": "GPS",
    url: "gps-ops&FORMAT=tle",
  },
  {
    name: "glonass",
    "label-en": "GLONASS",
    url: "glo-ops&FORMAT=tle",
  },
  {
    name: "galileo",
    "label-en": "Galileo",
    url: "galileo&FORMAT=tle",
  },
  {
    name: "beidou",
    "label-en": "Beidou",
    url: "beidou&FORMAT=tle",
  },
];
const translations = [
  {
    language: "en",
    strings: [
      { id: "tr-lighting", text: "Lighting" },
      { id: "tr-camera-lock", text: "Camera lock" },
      { id: "tr-disable-satellites", text: "Remove satellites" },
      { id: "tr-satellites-available", text: "Satellites available:" },
    ],
  },
  {
    language: "ta",
    strings: [
      { id: "tr-lighting", text: "விளக்கு" },
      { id: "tr-camera-lock", text: "கேமரா பூட்டு" },
      { id: "tr-disable-satellites", text: "செயற்கைக்கோள்களை அகற்று" },
      { id: "tr-satellites-available", text: "குறிப்பான்களை அகற்று:" },
    ],
  },
  {
    language: "ml",
    strings: [
      { id: "tr-lighting", text: "ലൈറ്റിംഗ്" },
      { id: "tr-camera-lock", text: "ക്യാമറ ലോക്ക്" },
      { id: "tr-disable-satellites", text: "ഉപഗ്രഹങ്ങൾ നീക്കം ചെയ്യുക" },
      { id: "tr-satellites-available", text: "ഉപഗ്രഹങ്ങൾ ലഭ്യമാണ്:" },
    ],
  },
  {
    language: "ka",
    strings: [
      { id: "tr-lighting", text: "ಬೆಳಕಿನ" },
      { id: "tr-camera-lock", text: "ಕ್ಯಾಮರಾ ಲಾಕ್" },
      { id: "tr-disable-satellites", text: "ಉಪಗ್ರಹಗಳನ್ನು ತೆಗೆದುಹಾಕಿ" },
      { id: "tr-satellites-available", text: "ಉಪಗ್ರಹಗಳು ಲಭ್ಯವಿದೆ:" },
    ],
  },
];

//SET UI STRINGS DEPENDING ON BROWSER LANGUAGE
const userLang =
  navigator.language.slice(0, 2) || navigator.userLanguage.slice(0, 2);

if (userLang !== undefined) {
  let translation = translations.find((tr) => {
    return tr.language === userLang;
  });

  if (translation !== undefined) {
    translation.strings.forEach((str) => {
      document.getElementById(str.id).innerHTML = str.text;
    });
  }
}

// ADD SOURCES BUTTONS
const btnsEntryPoint = document.getElementById("buttons-entry-point");
TLEsources.forEach((src) => {
  let labelLang = "label-en";
  if (src[`label-${userLang}`] !== undefined) {
    labelLang = `label-${userLang}`;
  }

  // console.log(src[labelLang]);
  const btnHTML = `<button class="cesium-button" type="button" name="enable-satellites">${src[labelLang]}</button>`;
  btnsEntryPoint.insertAdjacentHTML("beforeend", btnHTML);
  btnsEntryPoint.appendChild(btnHTML);
});

//===============================================================
//USER INTERFACE ACTIONS
//===============================================================
//menu button
document.getElementById("menu-button").onclick = () => {
  let o = document.getElementById("options");
  o.style.display === "block"
    ? (o.style.display = "none")
    : (o.style.display = "block");
};
// Delete satellites button
document
  .getElementById("tr-disable-satellites")
  .addEventListener("click", (e) => {
    deleteSatellites();
  });
// Delete marker Button
document.getElementById("tr-disable-markers").onclick = () => {
  deleteAllMarkers();
};

// any enable satellites button
document.getElementsByName("enable-satellites").forEach(
  (el, i) =>
    (el.onclick = () => {
      deleteSatellites();
      getData(TLEsources[i].url);
    })
);

//switch1
const sw1 = document.getElementById("sw1");
document.getElementById("sw1").onclick = () => {
  if (sw1.checked) {
    globe.enableLighting = true;
  } else {
    globe.enableLighting = false;
  }
};

//switch2
const sw2 = document.getElementById("sw2");
sw2.onclick = () => {
  if (sw2.checked) {
    disableCamIcrf();
  } else {
    enableCamIcrf();
  }
};

//deletes all satellites
const deleteSatellites = () => {
  satellitesData = [];
  displayedOrbit = undefined;
  polylines.removeAll();
  satID.forEach((index) => {
    entities.removeById(index);
    satID = [];
  });
};

// delete Markers
const deleteMarkers = () => {
  markerId.forEach((item) => {
    entities.removeById(item[0]);
  });
};

// delete all Markers
const deleteAllMarkers = () => {
  markerId.forEach((index) => {
    entities.removeById(index[0]);
    markerId = [];
  });
};

//camera lock functions
const disableCamIcrf = () => {
  //locks camera on the globe
  scene.postUpdate.removeEventListener(cameraIcrf);
  viewer.camera.lookAtTransform(Matrix4.IDENTITY);
};
const enableCamIcrf = () => {
  //locks camera in space
  scene.postUpdate.addEventListener(cameraIcrf);
};

const cameraIcrf = (scene, time) => {
  if (scene.mode !== SceneMode.SCENE3D) {
    return;
  }
  let icrfToFixed = Transforms.computeIcrfToFixedMatrix(time);
  if (icrfToFixed !== undefined) {
    let camera = viewer.camera;
    let offset = Cartesian3.clone(viewer.camera.position);
    let transform = Matrix4.fromRotationTranslation(icrfToFixed);
    camera.lookAtTransform(transform, offset);
  }
};
//lock orbit in space
const orbitIcrf = (scene, time) => {
  if (polylines.length) {
    let mat = Transforms.computeTemeToPseudoFixedMatrix(time);
    polylines.modelMatrix = Matrix4.fromRotationTranslation(mat);
  }
};
let satID = [],
  markerId = [];

//===============================================================
//Satellite Adding Function.
//===============================================================
const addSatelliteMarker = ([satName, satrec]) => {
  const posvel = satellite.propagate(
    satrec,
    JulianDate.toDate(clock.currentTime)
  );

  const gmst = satellite.gstime(JulianDate.toDate(clock.currentTime));
  const pos = Object.values(satellite.eciToEcf(posvel.position, gmst)).map(
    (el) => (el *= 1000)
  ); //position km->m

  let sat = viewer.entities.add({
    name: satName,
    position: Cartesian3.fromArray(pos),
    billboard: {
      image: "src/satImg.png",
    },
    label: {
      show: false,
      text: satName,
      showBackground: true,
      font: "12px monospace",
    },
  });

  satID.push(sat.id);
  sat.name = satName;
  sat.description = `
  <ul>
    <h3><b>Satellite Number: </b>${satrec.satnum}</h3>
    <h3><b>Epochdays: </b>${satrec.epochdays}</h3>
    <h3><b>Epochyr: </b>${satrec.epochyr}</h3>
  </ul>`;
  // markerId.forEach((item) => {
  //   console.log(item.position);
  //   // addMarker(item.position, true);
  // });
  console.log(markerId);
  deleteMarkers();
};

//ORBIT CALCULATION
const calculateOrbit = (satrec) => {
  try {
    //init
    let orbitPoints = []; //array for calculated points
    const period = (2 * Math.PI) / satrec.no; // orbital period in minutes
    const timeStep = period / orbitSteps; //time interval between points on orbit
    let baseTime = new JulianDate(); //time of the first point
    JulianDate.addMinutes(clock.currentTime, -period / 2, baseTime); //sets base time to the half period ago
    let tempTime = new JulianDate(); //temp date for calculations

    //calculate points in ECI coordinate frame
    for (let i = 0; i <= orbitSteps; i++) {
      JulianDate.addMinutes(baseTime, i * timeStep, tempTime);
      let posvelTemp = satellite.propagate(satrec, JulianDate.toDate(tempTime));
      if (posvelTemp.position !== undefined) {
        orbitPoints.push(
          Cartesian3.fromArray(Object.values(posvelTemp.position))
        );
      }
    }

    //convert coordinates from kilometers to meters
    orbitPoints.forEach((point) =>
      Cartesian3.multiplyByScalar(point, 1000, point)
    );

    //polyline material
    const polylineMaterial = new Material.fromType("Color"); //create polyline material
    polylineMaterial.uniforms.color = Color.BLUE; //set the material color
    polylines.removeAll();
    polylines.add({
      positions: orbitPoints,
      width: 1,
      material: polylineMaterial,
      id: "orbit",
    });

    displayedOrbit = [satrec, period * 30];
  } catch (error) {
    console.log("This satellite is deorbited.");
  }
};
const clearOrbit = () => {
  displayedOrbit = undefined;
  polylines.removeAll();
};
const updateOrbit = () => {
  if (displayedOrbit !== undefined) {
    if (
      clock.currentTime.equalsEpsilon(
        lastOrbitUpdateTime,
        displayedOrbit[1]
      ) === false
    ) {
      lastOrbitUpdateTime = clock.currentTime;
      calculateOrbit(displayedOrbit[0]);
    }
  }
};
const updateSatellites = () => {
  //updates satellites positions
  if (satellitesData.length && viewer.clockViewModel.shouldAnimate) {
    const gmst = satellite.gstime(JulianDate.toDate(clock.currentTime));
    satellitesData.forEach(([satName, satrec], index) => {
      //update satellite entity position
      try {
        const posvel = satellite.propagate(
          satrec,
          JulianDate.toDate(clock.currentTime)
        );
        const pos = Object.values(
          satellite.eciToEcf(posvel.position, gmst)
        ).map((el) => (el *= 1000)); //position km->m

        entities.values[index].position = Cartesian3.fromArray(pos); //update satellite position
        // entities.values[index].point.color = Color.YELLOW; //update point color
      } catch (error) {
        // entities.values[index].point.color = Color.RED; //update point color
      }
    });
  }
};
const setLoadingData = (bool) => {
  //shows loading bar
  dataLoadingInProgress = bool;
  const loadingBar = document.getElementById("progress-bar");
  if (bool) {
    loadingBar.style.visibility = "visible";
  } else {
    loadingBar.style.visibility = "hidden";
  }
};
const getData = async (targetUrl) => {
  //get TLE data from CelesTrack
  if (dataLoadingInProgress === false) {
    setLoadingData(true);
    const bar = document.getElementById("bar");

    const response = await fetch(
      `https://www.celestrak.com/NORAD/elements/gp.php?GROUP=${targetUrl}`
    );
    let textLines = (await response.text()).split(/\r?\n/); //split file to separate lines

    textLines = textLines.filter((e) => {
      return e;
    }); //delete empty lines at the eof

    if (textLines.length) {
      let tempSatellitesData = [];
      //read file line by line
      try {
        for (let i = 0; i < textLines.length; i += 3) {
          //check if TLE texts length is correct
          if (
            textLines[i].length === 24 &&
            textLines[i + 1].length === 69 &&
            textLines[i + 2].length === 69
          ) {
            let tempSatrec = satellite.twoline2satrec(
              textLines[i + 1],
              textLines[i + 2]
            );

            //check if TLE is valid
            if (
              satellite.propagate(
                tempSatrec,
                JulianDate.toDate(clock.currentTime)
              ).position === undefined
            ) {
              continue; //skips this loop iteration
            }
            tempSatellitesData.push([textLines[i].trim(), tempSatrec]);
          } else {
            throw `Error: The TLE data file can't be processed. The file may be corrupted.`;
          }
        }
      } catch (error) {
        console.log(error);
        setLoadingData(false);
      }
      tempSatellitesData.forEach(function (sat) {
        addSatelliteMarker(sat);
        // console.log(sat);
      }); //create point entities

      satellitesData.push(...tempSatellitesData); //add satellites to updated satellites array
    }
    setLoadingData(false);
  }
};
// Custom Styled FPS Counter
// const updateFPScounter = () => {
//   let fps = frameRateMonitor.lastFramesPerSecond;
//   if (fps) {
//     document.getElementById("fps").innerText = fps.toFixed(0).toString();
//   }
// };
const checkCameraZoom = () => {
  //changes state of camera lock switch depending on camera zoom
  setTimeout(() => {
    if (scene.mode === SceneMode.SCENE3D) {
      if (viewer.camera.getMagnitude() < 13000000) {
        disableCamIcrf();
        sw2.checked = true;
        sw2.disabled = true;
      } else {
        sw2.disabled = false;
      }
    }
  }, 10);
};

const satUpdateInterval = setInterval(updateSatellites, satUpdateIntervalTime); //enables satellites positions update
const frameRateMonitorInterval = setInterval(updateFPScounter, 500);
scene.postUpdate.addEventListener(cameraIcrf); //enables camera lock at the start
scene.postUpdate.addEventListener(orbitIcrf); //enables orbit lock at the start
scene.postUpdate.addEventListener(updateOrbit); //enables orbit update
viewer.camera.changed.addEventListener(checkCameraZoom);

//USER INPUT HANDLERS
viewer.screenSpaceEventHandler.setInputAction((input) => {},
ScreenSpaceEventType.LEFT_DOUBLE_CLICK); //reset default doubleclick handler

const handler = new ScreenSpaceEventHandler(scene.canvas); //custom event handler
handler.setInputAction((input) => {
  //left click input action
  let picked = scene.pick(input.position);
  // console.log(picked);

  if (picked) {
    let entity = defaultValue(picked.id, picked.primitive.id);
    if (entity instanceof Entity) {
      if (entity.label.show.getValue() === false) {
        entity.label.show = true;
        calculateOrbit(satellitesData.find((el) => el[0] === entity.name)[1]);
      } else {
        entity.label.show = false;
        clearOrbit();
      }
    }
  }
}, ScreenSpaceEventType.LEFT_CLICK);

handler.setInputAction((input) => {
  //mouse scroll
  checkCameraZoom();
}, ScreenSpaceEventType.WHEEL);
let a = 0;
let entity1;
let cartesian;
function addMarker(cartesian, visibility) {
  console.log(markerId);
  entity1 = viewer.entities.add({
    billboard: {
      image: "src/locationPin.png",
      scale: 0.5,
    },
    label: {
      show: visibility,
      showBackground: true,
      horizontalOrigin: HorizontalOrigin.CENTER,
      verticalOrigin: VerticalOrigin.BOTTOM,
      font: "12px monospace",
    },
  });

  // entity.description = `Coordinates: ${cartesian}`;
}

// Mark Locations.
handler.setInputAction(function (click) {
  cartesian = viewer.camera.pickEllipsoid(
    click.position,
    scene.globe.ellipsoid
  );
  if (cartesian) {
    const cartographic = Cartographic.fromCartesian(cartesian);
    const longitudeString = Math.toDegrees(cartographic.longitude).toFixed(2);
    const latitudeString = Math.toDegrees(cartographic.latitude).toFixed(2);
    addMarker(cartesian, true);
    // Coordinates
    console.log(longitudeString.slice(-7), latitudeString.slice(-7));
    entity1.position = cartesian;
    entity1.label.show = true;
    entity1.label.text =
      `Lon: ${`   ${longitudeString}`.slice(-7)}\u00B0` +
      `\nLat: ${`   ${latitudeString}`.slice(-7)}\u00B0`;

    markerId.push([entity1.id, entity1.position]);
  } else {
    entity1.label.show = false;
  }
}, ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

// Globe Navigation
const canvas = viewer.canvas;
canvas.onclick = function () {
  canvas.focus();
};

const ellipsoid = scene.globe.ellipsoid;
let startMousePosition;
let mousePosition;
const flags = {
  looking: false,
  moveForward: false,
  moveBackward: false,
  moveUp: false,
  moveDown: false,
  moveLeft: false,
  moveRight: false,
};

handler.setInputAction(function (movement) {
  flags.looking = true;
  mousePosition = startMousePosition = Cartesian3.clone(movement.position);
}, ScreenSpaceEventType.LEFT_DOWN);

handler.setInputAction(function (position) {
  flags.looking = false;
}, ScreenSpaceEventType.LEFT_UP);

function getFlagForKeyCode(keyCode) {
  switch (keyCode) {
    case "W".charCodeAt(0):
      return "moveForward";
    case "S".charCodeAt(0):
      return "moveBackward";
    case "Q".charCodeAt(0):
      return "moveUp";
    case "E".charCodeAt(0):
      return "moveDown";
    case "D".charCodeAt(0):
      return "moveRight";
    case "A".charCodeAt(0):
      return "moveLeft";
    default:
      return undefined;
  }
}

document.addEventListener(
  "keydown",
  function (e) {
    const flagName = getFlagForKeyCode(e.keyCode);
    if (typeof flagName !== "undefined") {
      flags[flagName] = true;
    }
  },
  false
);

document.addEventListener(
  "keyup",
  function (e) {
    const flagName = getFlagForKeyCode(e.keyCode);
    if (typeof flagName !== "undefined") {
      flags[flagName] = false;
    }
  },
  false
);

viewer.clock.onTick.addEventListener(function (clock) {
  const camera = viewer.camera;

  if (flags.looking) {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    // Coordinate (0.0, 0.0) will be where the mouse was clicked.
    const x = (mousePosition.x - startMousePosition.x) / width;
    const y = -(mousePosition.y - startMousePosition.y) / height;

    const lookFactor = 0.05;
    camera.lookRight(x * lookFactor);
    camera.lookUp(y * lookFactor);
  }

  // Change movement speed based on the distance of the camera to the surface of the ellipsoid.
  const cameraHeight = ellipsoid.cartesianToCartographic(
    camera.position
  ).height;
  const moveRate = cameraHeight / 100.0;

  if (flags.moveForward) {
    camera.moveForward(moveRate);
  }
  if (flags.moveBackward) {
    camera.moveBackward(moveRate);
  }
  if (flags.moveUp) {
    camera.moveUp(moveRate);
  }
  if (flags.moveDown) {
    camera.moveDown(moveRate);
  }
  if (flags.moveLeft) {
    camera.moveLeft(moveRate);
  }
  if (flags.moveRight) {
    camera.moveRight(moveRate);
  }
});

let infoBtn = document.getElementById("infoBtn");
let infoPanel = document.getElementById("infoPanel");
function showNav(e) {
  if (infoPanel.style.display == "block") {
    infoPanel.style.display = "none";
  } else {
    infoPanel.style.display = "block";
  }
}

infoBtn.addEventListener("click", (e) => {
  showNav(e);
});

// Custom GeoCoder for Search Box
function OpenStreetMapNominatimGeocoder() {}
OpenStreetMapNominatimGeocoder.prototype.geocode = function (input) {
  const endpoint = "https://nominatim.openstreetmap.org/search";
  const resource = new Resource({
    url: endpoint,
    queryParameters: {
      format: "json",
      q: input,
    },
  });

  return resource.fetchJson().then(function (results) {
    let bboxDegrees;
    return results.map(function (resultObject) {
      bboxDegrees = resultObject.boundingbox;
      return {
        displayName: resultObject.display_name,
        destination: Rectangle.fromDegrees(
          bboxDegrees[2],
          bboxDegrees[0],
          bboxDegrees[3],
          bboxDegrees[1]
        ),
      };
    });
  });
};
