// @ts-check
/// <reference path="../kintone-shared/types/kintone-jsdoc.d.ts" />

/* Portfolio Demo - 3D warehouse view */
(function () {
  "use strict";

  var APP_ID = 354;
  var VIEW_NAMES = ["3D置場マップ デモ", "4号テント内3D置場"];
  var CONTAINER_ID = "inventory-dashboard-3d";

  var FIELD_LOCATION = "location";
  var FIELD_STATUS = "status";
  var FIELD_QUANTITY = "quantity";
  var FIELD_QUANTITY_NUMERIC = "quantity_numeric";
  var FIELD_PRODUCT = "product";
  var FIELD_REMARK = "remark";

  var WEST_LOCATIONS = [
    "L01-01", "L01-02", "L01-03", "L01-04", "L01-05", "L01-06",
    "L01-07", "L01-08", "L01-09", "L01-10", "L01-11", "L01-12",
    "L01-13", "L01-14", "L01-15", "L01-16", "L01-17", "L01-18",
  ];
  var EAST_LOCATIONS = [
    "L02-00", "L02-01", "L02-02", "L02-03", "L02-04", "L02-05",
    "L02-06", "L02-07", "L02-08", "L02-09", "L02-10", "L02-11",
    "L02-12", "L02-13", "L02-14", "L02-15", "L02-16",
  ];
  var ALL_LOCATIONS = WEST_LOCATIONS.concat(EAST_LOCATIONS);

  var PRODUCT_COLOR_MAP = {
    "製品A":  { hex: 0xdc2626, css: "#dc2626" },
    "製品B":  { hex: 0x2563eb, css: "#2563eb" },
    "製品C":  { hex: 0x16a34a, css: "#16a34a" },
    "製品D":  { hex: 0xea580c, css: "#ea580c" },
    "製品E": { hex: 0x9333ea, css: "#9333ea" },
    "製品F":  { hex: 0x06b6d4, css: "#06b6d4" },
    "製品G": { hex: 0xca8a04, css: "#ca8a04" },
    "製品H": { hex: 0xdb2777, css: "#db2777" },
    "その他":     { hex: 0x64748b, css: "#64748b" },
  };
  var PRODUCT_COLOR_OTHER = { hex: 0xd1d5db, css: "#d1d5db" };

  var POSITION_COUNT = 15;
  var MAX_LEVEL = 4;
  var AISLE_WIDTH = 2.2;
  var LOCATION_SPACING = 1.22;
  var POSITION_SPACING = 0.48;
  var LEVEL_HEIGHT = 0.45;
  var CUBE_SIZE = 0.34;
  var CAMERA_TARGET_Y = 0.8;
  var PAN_LIMIT_X = 13.5;
  var PAN_LIMIT_Z = 10.5;

  var activeViewer = null;

  function generateDummyRecords() {
    var products = ["製品A", "製品B", "製品C", "製品D", "製品E", "製品F", "製品G", "製品H", "その他"];
    var statuses = ["出荷待ち", "一部出荷済", "資材", "積替済"];
    var stamps = ["", "黒〇", "赤〇"];
    var records = [];
    var id = 1000;
    ALL_LOCATIONS.forEach(function (loc) {
      if (Math.random() > 0.75) return;
      var product = products[Math.floor(Math.random() * products.length)];
      var status = statuses[Math.floor(Math.random() * statuses.length)];
      var qty = Math.floor(Math.random() * 36) + 4;
      var record = {
        $id: { value: String(id++) },
        location: { value: loc },
        status: { value: status },
        quantity: { value: String(qty) },
        quantity_numeric: { value: "" },
        product: { value: product },
        remark: { value: "" },
        flag: { value: "" }
      };
      for (var pos = 1; pos <= POSITION_COUNT; pos++) {
        for (var level = 1; level <= MAX_LEVEL; level++) {
          if (Math.random() > 0.65) continue;
          record["lot_" + pos + "_" + level] = { value: "LT" + id + "-" + pos + "-" + level };
          record["branch_" + pos + "_" + level] = { value: "1" };
          record["stamp_" + pos + "_" + level] = { value: stamps[Math.floor(Math.random() * stamps.length)] };
          record["shipped_" + pos + "_" + level] = { value: "" };
        }
      }
      records.push(record);
    });
    return records;
  }

  function initDemo() {
    var container = document.getElementById(CONTAINER_ID);
    if (!container) return;
    container.innerHTML = '<div class="inv3d-loading">読み込み中...</div>';
    var records = generateDummyRecords();
    renderDashboard(container, records.map(parseRecord), "all");
  }

  document.addEventListener("DOMContentLoaded", initDemo);

  function lotFieldCodes() {
    var fields = [];
    for (var pos = 1; pos <= POSITION_COUNT; pos++) {
      for (var level = 1; level <= MAX_LEVEL; level++) {
        fields.push("lot_" + pos + "_" + level);
        fields.push("branch_" + pos + "_" + level);
        fields.push("stamp_" + pos + "_" + level);
        fields.push("shipped_" + pos + "_" + level);
      }
    }
    return fields;
  }

  function parseRecord(record) {
    var location = trimValue(record[FIELD_LOCATION]) || "未指定";
    var status = trimValue(record[FIELD_STATUS]) || "出荷待ち";
    var totalQuantity = toNumber(trimValue(record[FIELD_QUANTITY]));
    var remainingValue = trimValue(record[FIELD_QUANTITY_NUMERIC]);
    var quantity = status === "一部出荷済" && remainingValue !== ""
      ? toNumber(remainingValue)
      : totalQuantity;
    var lots = [];
    var shippedLots = [];
    var ignored = [];

    for (var pos = 1; pos <= POSITION_COUNT; pos++) {
      var allowedLevels = maxLevelForPosition(pos);
      for (var level = 1; level <= MAX_LEVEL; level++) {
        var lotField = "lot_" + pos + "_" + level;
        var lotNumber = trimValue(record[lotField]);
        if (!lotNumber) continue;

        var lot = {
          position: pos,
          level: level,
          lotNumber: lotNumber,
          branch: trimValue(record["branch_" + pos + "_" + level]),
          stamp: trimValue(record["stamp_" + pos + "_" + level]),
          shipped: trimValue(record["shipped_" + pos + "_" + level]),
        };
        if (level > allowedLevels) {
          ignored.push(lot);
          continue;
        }
        if (isShippedLot(lot)) {
          shippedLots.push(lot);
          continue;
        }
        lots.push(lot);
      }
    }

    if (status === "一部出荷済" && remainingValue !== "" && lots.length > quantity) {
      shippedLots = shippedLots.concat(lots.slice(quantity));
      lots = lots.slice(0, quantity);
    }

    return {
      recordId: record.$id ? record.$id.value : "",
      location: location,
      area: areaForLocation(location),
      locationIndex: locationIndex(location),
      status: status,
      product: trimValue(record[FIELD_PRODUCT]) || "product未設定",
      quantity: quantity,
      remark: trimValue(record[FIELD_REMARK]),
      solarTon: trimValue(record["flag"]),
      lots: lots,
      shippedLots: shippedLots,
      ignoredLots: ignored,
    };
  }

  function renderDashboard(container, records, activeFilter, viewState, colorMode) {
    activeFilter = activeFilter || "all";
    colorMode = colorMode || "status";
    var displayRecords = filterRecordsForLegend(records, activeFilter);
    var locatedRecords = displayRecords.filter(function (record) { return record.area !== "OTHER"; });
    var stats = buildStats(displayRecords, locatedRecords, activeFilter);
    var html = "";
    html += '<div class="inv3d-page">';
    html += '<header class="inv3d-header">';
    html += '<div><h1>3D置場マップ デモ</h1><p>在庫状況を3Dで俯瞰</p></div>';
    html += '<button type="button" class="inv3d-refresh" id="inv3d-refresh">更新</button>';
    html += '</header>';
    html += '<section class="inv3d-summary">';
    html += summaryCard("置場", String(stats.usedLocations), "使用中");
    html += summaryCard("ロット", String(stats.lotCount), "表示対象");
    html += summaryCard("製品数", stats.totalQuantity.toLocaleString(), "在庫数");
    html += summaryCard("未配置", String(stats.otherCount), "location未指定/対象外");
    html += '</section>';
    html += '<section class="inv3d-shell">';
    html += '<div class="inv3d-toolbar">';
    html += '<div class="inv3d-actions">';
    html += '<button type="button" data-view="reset">リセット</button>';
    html += '<button type="button" id="inv3d-color-toggle" class="inv3d-colortoggle' + (colorMode === "product" ? " is-active" : "") + '">';
    html += colorMode === "product" ? "状況別色" : "product別色";
    html += '</button>';
    html += '</div>';
    html += '</div>';
    html += '<div class="inv3d-legend">';
    html += legend("all", "すべて", activeFilter);
    html += legend("wait", "出荷待ち", activeFilter);
    html += legend("partial", "一部出荷済", activeFilter);
    html += legend("material", "資材", activeFilter);
    html += legend("black-stamp", "黒〇（黒枠）", activeFilter);
    html += legend("red-stamp", "赤〇（赤枠）", activeFilter);
    html += legend("defective", "不適合/保留", activeFilter);
    html += '</div>';
    if (colorMode === "product") {
      html += '<div class="inv3d-product-legend">';
      html += '<span>product別色：</span>';
      Object.keys(PRODUCT_COLOR_MAP).forEach(function (name) {
        html += '<span class="inv3d-prod-item"><i style="background:' + PRODUCT_COLOR_MAP[name].css + '"></i>' + esc(name) + '</span>';
      });
      html += '<span class="inv3d-prod-item"><i style="background:' + PRODUCT_COLOR_OTHER.css + '"></i>その他</span>';
      html += '</div>';
    }
    html += '<div class="inv3d-layout">';
    html += '<div class="inv3d-canvas" id="inv3d-canvas"></div>';
    html += '<aside class="inv3d-detail" id="inv3d-detail">' + emptyDetailHtml(stats) + '</aside>';
    html += '</div>';
    html += '</section>';
    if (stats.otherCount > 0) {
      html += '<section class="inv3d-other"><h2>対象外置場</h2>';
      displayRecords.filter(function (record) { return record.area === "OTHER"; }).slice(0, 40).forEach(function (record) {
        html += '<div><strong>' + esc(record.location) + '</strong><span>' + esc(record.product) + '</span><em>' + record.quantity.toLocaleString() + '</em></div>';
      });
      html += '</section>';
    }
    html += '<footer class="inv3d-footer">最終更新: ' + esc(new Date().toLocaleString("ja-JP")) + '</footer>';
    html += '</div>';
    container.innerHTML = html;

    var refresh = document.getElementById("inv3d-refresh");
    if (refresh) {
      refresh.addEventListener("click", function () {
        var currentViewState = activeViewer && activeViewer.getViewState ? activeViewer.getViewState() : null;
        if (activeViewer && activeViewer.destroy) {
          activeViewer.destroy();
          activeViewer = null;
        }
        container.innerHTML = '<div class="inv3d-loading">読み込み中...</div>';
        var nextRecords = generateDummyRecords();
        renderDashboard(container, nextRecords.map(parseRecord), activeFilter, currentViewState, colorMode);
      });
    }

    var legendEl = container.querySelector(".inv3d-legend");
    if (legendEl) {
      legendEl.addEventListener("click", function (event) {
        var button = event.target.closest("[data-filter]");
        if (!button) return;
        var nextFilter = button.getAttribute("data-filter") || "all";
        if (nextFilter === activeFilter) nextFilter = "all";
        var currentViewState = activeViewer && activeViewer.getViewState ? activeViewer.getViewState() : null;
        if (activeViewer && activeViewer.destroy) {
          activeViewer.destroy();
          activeViewer = null;
        }
        renderDashboard(container, records, nextFilter, currentViewState, colorMode);
      });
    }

    var colorToggle = document.getElementById("inv3d-color-toggle");
    if (colorToggle) {
      colorToggle.addEventListener("click", function () {
        var nextColorMode = colorMode === "product" ? "status" : "product";
        var currentViewState = activeViewer && activeViewer.getViewState ? activeViewer.getViewState() : null;
        if (activeViewer && activeViewer.destroy) {
          activeViewer.destroy();
          activeViewer = null;
        }
        renderDashboard(container, records, activeFilter, currentViewState, nextColorMode);
      });
    }

    var host = document.getElementById("inv3d-canvas");
    var detail = document.getElementById("inv3d-detail");
    var toolbar = container.querySelector(".inv3d-toolbar");

    if (!window.THREE) {
      host.innerHTML = '<div class="inv3d-error">Three.js が読み込まれていません。</div>';
      renderStaticFallback(host, locatedRecords);
      return;
    }

    activeViewer = createViewer({
      host: host,
      detail: detail,
      toolbar: toolbar,
      records: locatedRecords,
      stats: stats,
      viewState: viewState,
      colorMode: colorMode,
    });
  }

  function createViewer(options) {
    var THREE = window.THREE;
    var host = options.host;
    var detail = options.detail;
    var toolbar = options.toolbar;
    var records = options.records;
    var stats = options.stats;
    var initialViewState = options.viewState;
    var colorMode = options.colorMode || "status";

    host.innerHTML = "";
    var width = Math.max(host.clientWidth || 0, 320);
    var height = Math.max(host.clientHeight || 0, 520);
    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fafc);

    var camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 1000);
    var cameraTarget = new THREE.Vector3(0, CAMERA_TARGET_Y, 0);
    setCamera(camera, "overview", cameraTarget);

    var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace || renderer.outputColorSpace;
    host.appendChild(renderer.domElement);
    host.appendChild(operationGuideElement());

    var world = new THREE.Group();
    scene.add(world);

    var ambient = new THREE.HemisphereLight(0xffffff, 0xdbe4ee, 1.35);
    scene.add(ambient);
    var key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(5, 12, 8);
    scene.add(key);
    var fill = new THREE.DirectionalLight(0xdbeafe, 0.65);
    fill.position.set(-9, 6, -8);
    scene.add(fill);

    var selectable = [];
    var objectToLot = {};
    var recordGroups = groupByLocation(records);

    buildWarehouseBase(world, THREE);
    buildLocationBays(world, THREE, recordGroups);
    buildMaterialColumns(world, THREE, records);
    buildLotCubes(world, THREE, records, recordGroups, selectable, objectToLot, colorMode);
    buildSceneLabels(world, THREE);
    buildCompassDirections(world, THREE);
    restoreViewState(initialViewState);

    var pointer = new THREE.Vector2();
    var raycaster = new THREE.Raycaster();
    var selectedMesh = null;
    var isDragging = false;
    var didDrag = false;
    var dragMode = "rotate";
    var lastX = 0;
    var lastY = 0;
    var frame = 0;
    var resizeObserver = window.ResizeObserver ? new ResizeObserver(resize) : null;
    if (resizeObserver) resizeObserver.observe(host);

    window.addEventListener("resize", resize);
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointerleave", onPointerLeave);
    renderer.domElement.addEventListener("dblclick", onDoubleClick);
    renderer.domElement.addEventListener("contextmenu", onContextMenu);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
    toolbar.addEventListener("click", onToolbarClick);

    renderFrame();

    return {
      getViewState: function () {
        return {
          cameraPosition: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
          cameraTarget: { x: cameraTarget.x, y: cameraTarget.y, z: cameraTarget.z },
          worldRotation: { x: world.rotation.x, y: world.rotation.y, z: world.rotation.z },
        };
      },
      destroy: function () {
        cancelAnimationFrame(frame);
        if (resizeObserver) resizeObserver.disconnect();
        window.removeEventListener("resize", resize);
        renderer.domElement.removeEventListener("pointerdown", onPointerDown);
        renderer.domElement.removeEventListener("pointermove", onPointerMove);
        renderer.domElement.removeEventListener("pointerup", onPointerUp);
        renderer.domElement.removeEventListener("pointerleave", onPointerLeave);
        renderer.domElement.removeEventListener("dblclick", onDoubleClick);
        renderer.domElement.removeEventListener("contextmenu", onContextMenu);
        renderer.domElement.removeEventListener("wheel", onWheel);
        toolbar.removeEventListener("click", onToolbarClick);
        renderer.dispose();
        host.innerHTML = "";
      },
    };

    function restoreViewState(state) {
      if (!state) return;
      if (state.cameraTarget && isFiniteNumber(state.cameraTarget.x) && isFiniteNumber(state.cameraTarget.z)) {
        cameraTarget.set(
          clamp(state.cameraTarget.x, -PAN_LIMIT_X, PAN_LIMIT_X),
          isFiniteNumber(state.cameraTarget.y) ? state.cameraTarget.y : CAMERA_TARGET_Y,
          clamp(state.cameraTarget.z, -PAN_LIMIT_Z, PAN_LIMIT_Z)
        );
      }
      if (state.cameraPosition && isFiniteNumber(state.cameraPosition.x) && isFiniteNumber(state.cameraPosition.y) && isFiniteNumber(state.cameraPosition.z)) {
        camera.position.set(state.cameraPosition.x, state.cameraPosition.y, state.cameraPosition.z);
      }
      if (state.worldRotation && isFiniteNumber(state.worldRotation.x) && isFiniteNumber(state.worldRotation.y)) {
        world.rotation.set(
          clamp(state.worldRotation.x, -0.65, 0.55),
          state.worldRotation.y,
          isFiniteNumber(state.worldRotation.z) ? state.worldRotation.z : 0
        );
      }
      camera.lookAt(cameraTarget);
    }

    function renderFrame() {
      renderer.render(scene, camera);
      frame = requestAnimationFrame(renderFrame);
    }

    function resize() {
      var nextWidth = Math.max(host.clientWidth || 0, 320);
      var nextHeight = Math.max(host.clientHeight || 0, 420);
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(nextWidth, nextHeight);
    }

    function onPointerDown(event) {
      event.preventDefault();
      isDragging = true;
      didDrag = false;
      dragMode = event.button === 1 || event.button === 2 || event.shiftKey || event.ctrlKey ? "pan" : "rotate";
      lastX = event.clientX;
      lastY = event.clientY;
      try { renderer.domElement.setPointerCapture(event.pointerId); } catch (_) {}
    }

    function onPointerMove(event) {
      if (!isDragging) {
        var hover = pickLot(event);
        host.classList.toggle("inv3d-hovering", !!hover);
        return;
      }
      var dx = event.clientX - lastX;
      var dy = event.clientY - lastY;
      if (Math.abs(dx) + Math.abs(dy) > 4) didDrag = true;
      if (dragMode === "pan") {
        panCameraByScreen(dx, dy, 1);
      } else {
        world.rotation.y += dx * 0.004;
        world.rotation.x = clamp(world.rotation.x + dy * 0.003, -0.65, 0.55);
      }
      lastX = event.clientX;
      lastY = event.clientY;
    }

    function onPointerUp(event) {
      isDragging = false;
      try { renderer.domElement.releasePointerCapture(event.pointerId); } catch (_) {}
      var wasPan = dragMode === "pan";
      dragMode = "rotate";
      if (didDrag) return;
      if (wasPan) return;
      var lot = pickLot(event);
      if (lot) selectLot(lot);
    }

    function onPointerLeave() {
      isDragging = false;
      dragMode = "rotate";
      host.classList.remove("inv3d-hovering");
    }

    function onDoubleClick(event) {
      var lot = pickLot(event);
      if (lot && lot.recordId) openRecord(lot.recordId);
    }

    function onContextMenu(event) {
      event.preventDefault();
    }

    function onWheel(event) {
      event.preventDefault();
      var delta = event.deltaY > 0 ? 1.08 : 0.92;
      zoomCamera(delta);
    }

    function onToolbarClick(event) {
      var button = event.target.closest("[data-view], [data-action]");
      if (!button) return;
      var action = button.getAttribute("data-action");
      if (action) {
        applyAction(action);
        return;
      }
      var view = button.getAttribute("data-view") || "overview";
      setCamera(camera, view === "reset" ? "overview" : view, cameraTarget);
      if (view === "reset") {
        world.rotation.set(0, 0, 0);
      }
    }

    function applyAction(action) {
      if (action === "rotate-left") {
        world.rotation.y -= 0.2;
      } else if (action === "rotate-right") {
        world.rotation.y += 0.2;
      } else if (action === "pitch-up") {
        world.rotation.x = clamp(world.rotation.x - 0.14, -0.65, 0.55);
      } else if (action === "pitch-down") {
        world.rotation.x = clamp(world.rotation.x + 0.14, -0.65, 0.55);
      } else if (action === "zoom-in") {
        zoomCamera(0.88);
      } else if (action === "zoom-out") {
        zoomCamera(1.14);
      } else if (action === "pan-x-minus") {
        panCameraByWorld(-1.2, 0);
      } else if (action === "pan-x-plus") {
        panCameraByWorld(1.2, 0);
      } else if (action === "pan-z-minus") {
        panCameraByWorld(0, -1.2);
      } else if (action === "pan-z-plus") {
        panCameraByWorld(0, 1.2);
      } else if (action === "pan-center") {
        centerCameraTarget();
      }
    }

    function zoomCamera(scale) {
      var offset = camera.position.clone().sub(cameraTarget);
      var dist = clamp(offset.length() * scale, 8, 55);
      offset.setLength(dist);
      camera.position.copy(cameraTarget).add(offset);
      camera.lookAt(cameraTarget);
    }

    function panCameraByScreen(dx, dy, strength) {
      camera.updateMatrixWorld();
      var distance = camera.position.clone().sub(cameraTarget).length();
      var scale = (distance / Math.max(renderer.domElement.clientHeight || height, 1)) * 1.45 * (strength || 1);
      var right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
      right.y = 0;
      if (right.lengthSq() < 0.0001) right.set(1, 0, 0);
      right.normalize();

      var forward = new THREE.Vector3().subVectors(cameraTarget, camera.position);
      forward.y = 0;
      if (forward.lengthSq() < 0.0001) {
        forward.set(0, 0, -1);
      } else {
        forward.normalize();
      }

      var move = right.multiplyScalar(-dx * scale).add(forward.multiplyScalar(dy * scale));
      applyCameraTargetMove(move.x, move.z);
    }

    function panCameraByWorld(dx, dz) {
      applyCameraTargetMove(dx, dz);
    }

    function centerCameraTarget() {
      applyCameraTargetMove(-cameraTarget.x, -cameraTarget.z);
    }

    function applyCameraTargetMove(dx, dz) {
      var nextX = clamp(cameraTarget.x + dx, -PAN_LIMIT_X, PAN_LIMIT_X);
      var nextZ = clamp(cameraTarget.z + dz, -PAN_LIMIT_Z, PAN_LIMIT_Z);
      var actualX = nextX - cameraTarget.x;
      var actualZ = nextZ - cameraTarget.z;
      if (!actualX && !actualZ) return;
      cameraTarget.set(nextX, CAMERA_TARGET_Y, nextZ);
      camera.position.x += actualX;
      camera.position.z += actualZ;
      camera.lookAt(cameraTarget);
    }

    function pickLot(event) {
      var rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      var hits = raycaster.intersectObjects(selectable, false);
      if (!hits.length) return null;
      return objectToLot[hits[0].object.id] || null;
    }

    function selectLot(lot) {
      if (selectedMesh) selectedMesh.scale.set(1, 1, 1);
      selectedMesh = lot.__mesh || null;
      if (selectedMesh) selectedMesh.scale.set(1.12, 1.18, 1.12);
      detail.innerHTML = lotDetailHtml(lot, stats);
      var openButton = detail.querySelector("[data-open-record]");
      if (openButton) {
        openButton.addEventListener("click", function () {
          openRecord(openButton.getAttribute("data-open-record"));
        });
      }
    }
  }

  function buildWarehouseBase(world, THREE) {
    var width = Math.max(WEST_LOCATIONS.length, EAST_LOCATIONS.length) * LOCATION_SPACING + 1.4;
    var depth = AISLE_WIDTH + POSITION_COUNT * POSITION_SPACING * 2 + 1.7;
    var floor = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      new THREE.MeshBasicMaterial({ color: 0xf1f5f9, transparent: true, opacity: 0.88 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.03;
    world.add(floor);

    var aisle = new THREE.Mesh(
      new THREE.PlaneGeometry(width, AISLE_WIDTH),
      new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.9 })
    );
    aisle.rotation.x = -Math.PI / 2;
    aisle.position.y = -0.015;
    world.add(aisle);

    var grid = new THREE.GridHelper(Math.max(width, depth), 36, 0xcbd5e1, 0xe2e8f0);
    [].concat(grid.material || []).forEach(function (material) {
      material.transparent = true;
      material.opacity = 0.34;
    });
    world.add(grid);

    var wallMaterial = new THREE.MeshBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.46 });
    [-outerWallDistance(), outerWallDistance()].forEach(function (z) {
      var wall = new THREE.Mesh(new THREE.BoxGeometry(width, 0.1, 0.12), wallMaterial);
      wall.position.set(0, 0.05, z);
      world.add(wall);
    });
  }

  function buildLocationBays(world, THREE, recordGroups) {
    var bayMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.52, depthWrite: false });
    var usedMaterial = new THREE.MeshBasicMaterial({ color: 0xdbeafe, transparent: true, opacity: 0.62, depthWrite: false });
    var geometry = new THREE.BoxGeometry(0.98, 0.04, POSITION_COUNT * POSITION_SPACING + 0.25);

    ALL_LOCATIONS.forEach(function (loc) {
      var pos = locationBase(loc);
      var used = !!recordGroups[loc];
      var bay = new THREE.Mesh(geometry, used ? usedMaterial : bayMaterial);
      bay.position.set(pos.x, 0, pos.z);
      world.add(bay);
    });
  }

  function buildMaterialColumns(world, THREE, records) {
    var materialRecords = records.filter(function (record) {
      return statusKey(record) === "material" && record.area !== "OTHER";
    });
    if (!materialRecords.length) return;

    var seen = {};
    var columnGeometry = new THREE.BoxGeometry(1.08, 0.12, POSITION_COUNT * POSITION_SPACING + 0.45);
    var edgeGeometry = new THREE.EdgesGeometry(columnGeometry);
    var columnMaterial = new THREE.MeshBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.34, depthWrite: false });
    var edgeMaterial = new THREE.LineBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.92 });

    materialRecords.forEach(function (record) {
      if (seen[record.location]) return;
      seen[record.location] = true;

      var base = locationBase(record.location);
      var column = new THREE.Mesh(columnGeometry, columnMaterial);
      column.position.set(base.x, 0.08, base.z);
      column.renderOrder = 2;
      world.add(column);

      var edge = new THREE.LineSegments(edgeGeometry, edgeMaterial);
      edge.position.copy(column.position);
      edge.renderOrder = 3;
      world.add(edge);

      var label = makeTextSprite(THREE, "資材", "#0f172a", "rgba(255,255,255,.94)", 72, 28);
      label.position.set(base.x, 0.34, base.z);
      label.scale.set(0.74, 0.24, 1);
      world.add(label);
    });
  }

  function buildLotCubes(world, THREE, records, recordGroups, selectable, objectToLot, colorMode) {
    colorMode = colorMode || "status";
    var cubeGeometry = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);
    var edgeGeometry = new THREE.EdgesGeometry(cubeGeometry);
    var edgeMaterial = new THREE.LineBasicMaterial({ color: 0x0f172a, transparent: true, opacity: 0.26 });
    var stampEdgeGeometries = [1.2, 1.34, 1.48].map(function (scale) {
      return new THREE.EdgesGeometry(new THREE.BoxGeometry(CUBE_SIZE * scale, CUBE_SIZE * scale, CUBE_SIZE * scale));
    });
    var stampShellGeometry = new THREE.BoxGeometry(CUBE_SIZE * 1.58, CUBE_SIZE * 1.58, CUBE_SIZE * 1.58);
    var stampEdgeMaterials = {
      black: new THREE.LineBasicMaterial({ color: 0x020617, transparent: true, opacity: 1 }),
      red: new THREE.LineBasicMaterial({ color: 0xdc2626, transparent: true, opacity: 1 }),
      defective: new THREE.LineBasicMaterial({ color: 0x7c3aed, transparent: true, opacity: 1 }),
    };
    var stampShellMaterials = {
      black: new THREE.MeshBasicMaterial({ color: 0x020617, transparent: true, opacity: 0.08, depthWrite: false }),
      red: new THREE.MeshBasicMaterial({ color: 0xdc2626, transparent: true, opacity: 0.12, depthWrite: false }),
      defective: new THREE.MeshBasicMaterial({ color: 0x7c3aed, transparent: true, opacity: 0.12, depthWrite: false }),
    };
    var materials = {
      wait: new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.54, metalness: 0.03 }),
      partial: new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.58, metalness: 0.02 }),
      material: new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.72, metalness: 0.02 }),
    };
    var productMaterials = {};
    function getProductMaterial(product) {
      var key = String(product || "").trim();
      if (!productMaterials[key]) {
        var entry = PRODUCT_COLOR_MAP[key] || PRODUCT_COLOR_OTHER;
        productMaterials[key] = new THREE.MeshStandardMaterial({ color: entry.hex, roughness: 0.54, metalness: 0.03 });
      }
      return productMaterials[key];
    }
    var slotMaterial = new THREE.MeshBasicMaterial({ color: 0xcbd5e1, transparent: true, opacity: 0.14, wireframe: true, depthWrite: false });
    var slotGeometry = new THREE.BoxGeometry(CUBE_SIZE * 0.9, CUBE_SIZE * 0.9, CUBE_SIZE * 0.9);

    records.forEach(function (record) {
      var laneOffset = laneOffsetForRecord(record, recordGroups);
      for (var pos = 1; pos <= POSITION_COUNT; pos++) {
        for (var level = 1; level <= maxLevelForPosition(pos); level++) {
          var slot = new THREE.Mesh(slotGeometry, slotMaterial);
          var slotPos = lotWorldPosition(record.location, pos, level, laneOffset);
          slot.position.set(slotPos.x, slotPos.y, slotPos.z);
          world.add(slot);
        }
      }

      record.lots.forEach(function (lot) {
        var worldPos = lotWorldPosition(record.location, lot.position, lot.level, laneOffset);
        var material = colorMode === "product"
          ? getProductMaterial(record.product)
          : materials[statusKey(record)];
        var cube = new THREE.Mesh(cubeGeometry, material);
        cube.position.set(worldPos.x, worldPos.y, worldPos.z);
        cube.userData.recordId = record.recordId;
        cube.userData.lotNumber = lot.lotNumber;
        world.add(cube);
        selectable.push(cube);

        var edge = new THREE.LineSegments(edgeGeometry, edgeMaterial);
        edge.position.copy(cube.position);
        world.add(edge);

        var borderKind = stampBorderKind(lot);
        if (borderKind) {
          addStampFrame(world, THREE, cube.position, stampShellGeometry, stampShellMaterials[borderKind], stampEdgeGeometries, stampEdgeMaterials[borderKind]);
        }

        var label = makeTextSprite(THREE, shortLotLabel(lot.lotNumber), "#0f172a", "rgba(255,255,255,.92)", 86, 28);
        label.position.set(cube.position.x, cube.position.y + 0.28, cube.position.z);
        label.scale.set(0.48, 0.16, 1);
        world.add(label);

        var enriched = {
          recordId: record.recordId,
          location: record.location,
          area: record.area,
          status: record.status,
          product: record.product,
          quantity: record.quantity,
          position: lot.position,
          level: lot.level,
          lotNumber: lot.lotNumber,
          branch: lot.branch,
          stamp: lot.stamp,
          shipped: lot.shipped,
          remark: record.remark,
          __mesh: cube,
        };
        objectToLot[cube.id] = enriched;
      });
    });
  }

  function addStampFrame(world, THREE, position, shellGeometry, shellMaterial, geometries, material) {
    var shell = new THREE.Mesh(shellGeometry, shellMaterial);
    shell.position.copy(position);
    shell.renderOrder = 4;
    world.add(shell);

    geometries.forEach(function (geometry, index) {
      var frame = new THREE.LineSegments(geometry, material);
      frame.position.copy(position);
      frame.renderOrder = 5 + index;
      world.add(frame);
    });
  }

  function buildSceneLabels(world, THREE) {
    var aisleLabel = makeTextSprite(THREE, "中央通路", "#0f172a", "rgba(224,242,254,.92)", 120, 32);
    aisleLabel.position.set(0, 0.1, 0);
    aisleLabel.scale.set(1.15, 0.3, 1);
    world.add(aisleLabel);

    [
      { text: "WEST AREA", z: -outerWallDistance() + 0.35 },
      { text: "EAST AREA", z: outerWallDistance() - 0.35 },
    ].forEach(function (item) {
      var label = makeTextSprite(THREE, item.text, "#334155", "rgba(255,255,255,.9)", 130, 30);
      label.position.set(-10.6, 0.18, item.z);
      label.scale.set(1.0, 0.28, 1);
      world.add(label);
    });

    ALL_LOCATIONS.forEach(function (loc) {
      var base = locationBase(loc);
      var label = makeTextSprite(THREE, loc, "#475569", "rgba(255,255,255,.84)", 86, 24);
      label.position.set(base.x, 0.12, base.area === "W" ? -0.72 : 0.72);
      label.scale.set(0.58, 0.18, 1);
      world.add(label);
    });
  }

  function buildCompassDirections(world, THREE) {
    var xEdge = ((WEST_LOCATIONS.length - 1) / 2) * LOCATION_SPACING + 0.15;
    var zEdge = outerWallDistance() - 2.05;
    var y = 0.34;
    var arrowLength = 1.35;
    var color = 0x0f172a;

    addMapDirection(world, THREE, {
      label: "N 北",
      direction: new THREE.Vector3(1, 0, 0),
      origin: new THREE.Vector3(xEdge - arrowLength, y, 0),
      labelPosition: new THREE.Vector3(xEdge - 0.48, y + 0.03, 0),
      width: 76,
      scaleX: 1.16,
      scaleY: 0.32,
      length: arrowLength,
      color: color,
    });
    addMapDirection(world, THREE, {
      label: "S 南",
      direction: new THREE.Vector3(-1, 0, 0),
      origin: new THREE.Vector3(-xEdge + arrowLength, y, 0),
      labelPosition: new THREE.Vector3(-xEdge + 0.48, y + 0.03, 0),
      width: 76,
      scaleX: 1.16,
      scaleY: 0.32,
      length: arrowLength,
      color: color,
    });
    addMapDirection(world, THREE, {
      label: "W 西 L01",
      direction: new THREE.Vector3(0, 0, -1),
      origin: new THREE.Vector3(0, y, -zEdge + arrowLength),
      labelPosition: new THREE.Vector3(0, y + 0.03, -zEdge + 0.48),
      width: 104,
      scaleX: 1.48,
      scaleY: 0.32,
      length: arrowLength,
      color: color,
    });
    addMapDirection(world, THREE, {
      label: "E 東 L02",
      direction: new THREE.Vector3(0, 0, 1),
      origin: new THREE.Vector3(0, y, zEdge - arrowLength),
      labelPosition: new THREE.Vector3(0, y + 0.03, zEdge - 0.48),
      width: 104,
      scaleX: 1.48,
      scaleY: 0.32,
      length: arrowLength,
      color: color,
    });
  }

  function addMapDirection(world, THREE, options) {
    world.add(new THREE.ArrowHelper(options.direction, options.origin, options.length || 1.45, options.color, 0.34, 0.18));
    var label = makeTextSprite(THREE, options.label, "#0f172a", "rgba(255,255,255,.94)", options.width, 28);
    label.position.copy(options.labelPosition);
    label.scale.set(options.scaleX, options.scaleY || 0.24, 1);
    world.add(label);
  }

  function buildAxisHelper(world, THREE) {
    var origin = new THREE.Vector3(-10.4, 0.22, outerWallDistance() - 0.55);
    var length = 1.25;
    world.add(new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), origin, length, 0xdc2626, 0.28, 0.16));
    world.add(new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), origin, length, 0x16a34a, 0.28, 0.16));
    world.add(new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), origin, length, 0x2563eb, 0.28, 0.16));

    var xLabel = makeTextSprite(THREE, "X location", "#991b1b", "rgba(255,255,255,.92)", 82, 26);
    xLabel.position.set(origin.x + length + 0.28, origin.y, origin.z);
    xLabel.scale.set(0.6, 0.2, 1);
    world.add(xLabel);

    var yLabel = makeTextSprite(THREE, "Y 段", "#166534", "rgba(255,255,255,.92)", 72, 26);
    yLabel.position.set(origin.x, origin.y + length + 0.22, origin.z);
    yLabel.scale.set(0.5, 0.2, 1);
    world.add(yLabel);

    var zLabel = makeTextSprite(THREE, "Z 壁/通路", "#1d4ed8", "rgba(255,255,255,.92)", 104, 26);
    zLabel.position.set(origin.x, origin.y, origin.z - length - 0.26);
    zLabel.scale.set(0.78, 0.2, 1);
    world.add(zLabel);
  }

  function setCamera(camera, view, target) {
    if (target) target.set(0, CAMERA_TARGET_Y, 0);
    if (view === "top") {
      camera.position.set(0, 28, 0.01);
    } else if (view === "side") {
      camera.position.set(0, 8.5, 25);
    } else if (view === "west") {
      camera.position.set(-18, 10, 6);
    } else if (view === "east") {
      camera.position.set(18, 10, -6);
    } else {
      camera.position.set(0, 16, 12);
    }
    if (target) {
      camera.lookAt(target);
    } else {
      camera.lookAt(0, CAMERA_TARGET_Y, 0);
    }
  }

  function groupByLocation(records) {
    var grouped = {};
    records.forEach(function (record) {
      if (!grouped[record.location]) grouped[record.location] = [];
      grouped[record.location].push(record);
    });
    return grouped;
  }

  function laneOffsetForRecord(record, grouped) {
    var records = grouped[record.location] || [record];
    var index = records.indexOf(record);
    if (index < 0) index = 0;
    return (index - ((records.length - 1) / 2)) * 0.18;
  }

  function lotWorldPosition(location, position, level, laneOffset) {
    var base = locationBase(location);
    return {
      x: base.x + laneOffset,
      y: (level - 0.5) * LEVEL_HEIGHT,
      z: lotZ(base.area, position),
    };
  }

  function lotZ(area, position) {
    var distanceFromAisle = (POSITION_COUNT - position) * POSITION_SPACING + (AISLE_WIDTH / 2) + 0.55;
    return area === "W" ? -distanceFromAisle : distanceFromAisle;
  }

  function locationBase(location) {
    var westIndex = WEST_LOCATIONS.indexOf(location);
    if (westIndex >= 0) {
      return {
        area: "W",
        x: (westIndex - ((WEST_LOCATIONS.length - 1) / 2)) * LOCATION_SPACING,
        z: -(AISLE_WIDTH / 2 + POSITION_COUNT * POSITION_SPACING / 2 + 0.55),
      };
    }
    var eastIndex = EAST_LOCATIONS.indexOf(location);
    if (eastIndex >= 0) {
      return {
        area: "E",
        x: (eastIndex - ((WEST_LOCATIONS.length - 1) / 2)) * LOCATION_SPACING,
        z: AISLE_WIDTH / 2 + POSITION_COUNT * POSITION_SPACING / 2 + 0.55,
      };
    }
    return { area: "OTHER", x: 0, z: 0 };
  }

  function outerWallDistance() {
    return (AISLE_WIDTH / 2) + POSITION_COUNT * POSITION_SPACING + 0.9;
  }

  function maxLevelForPosition(position) {
    if (position === 1) return 2;
    if (position === 2) return 3;
    return 4;
  }

  function areaForLocation(location) {
    if (WEST_LOCATIONS.indexOf(location) >= 0) return "W";
    if (EAST_LOCATIONS.indexOf(location) >= 0) return "E";
    return "OTHER";
  }

  function locationIndex(location) {
    var westIndex = WEST_LOCATIONS.indexOf(location);
    if (westIndex >= 0) return westIndex;
    return EAST_LOCATIONS.indexOf(location);
  }

  function statusKey(record) {
    if (record.status === "一部出荷済") return "partial";
    if (record.status === "資材") return "material";
    return "wait";
  }

  function hasStampMark(lot) {
    return !!stampBorderKind(lot);
  }

  function stampBorderKind(lot) {
    var value = normalizeMarkValue(lot.stamp);
    if (value === "黒〇" || value === "修正品&黒〇") return "black";
    if (value === "赤〇" || value === "修正品&赤〇") return "red";
    if (value === "不適合" || value === "保留") return "defective";
    return "";
  }

  function isShippedLot(lot) {
    var value = normalizeMarkValue(lot.shipped);
    if (!value) return false;
    return value.split(",").some(function (item) {
      return item === "済" || item === "出荷済" || item === "廃棄";
    });
  }

  function normalizeMarkValue(value) {
    return String(value || "")
      .replace(/\s+/g, "")
      .replace(/○/g, "〇")
      .trim();
  }

  function filterRecordsForLegend(records, filter) {
    if (!filter || filter === "all") return records;
    var filtered = [];
    records.forEach(function (record) {
      if (filter === "material" && statusKey(record) === "material") {
        filtered.push(record);
        return;
      }
      var lots = record.lots.filter(function (lot) {
        return lotMatchesFilter(record, lot, filter);
      });
      if (lots.length > 0) {
        filtered.push(Object.assign({}, record, { lots: lots }));
      }
    });
    return filtered;
  }

  function lotMatchesFilter(record, lot, filter) {
    if (filter === "wait" || filter === "partial" || filter === "material") {
      return statusKey(record) === filter;
    }
    if (filter === "black-stamp") return stampBorderKind(lot) === "black";
    if (filter === "red-stamp") return stampBorderKind(lot) === "red";
    if (filter === "defective") return stampBorderKind(lot) === "defective";
    return true;
  }

  function isLotLevelFilter(filter) {
    return filter === "black-stamp" || filter === "red-stamp" || filter === "defective";
  }

  function filterLabel(filter) {
    if (filter === "wait") return "出荷待ち";
    if (filter === "partial") return "一部出荷済";
    if (filter === "material") return "資材";
    if (filter === "black-stamp") return "黒〇（黒枠）";
    if (filter === "red-stamp") return "赤〇（赤枠）";
    if (filter === "defective") return "不適合/保留";
    return "すべて";
  }

  function buildStats(records, locatedRecords, activeFilter) {
    var used = {};
    var lotCount = 0;
    var totalQuantity = 0;
    records.forEach(function (record) {
      if (record.area !== "OTHER") used[record.location] = true;
      lotCount += record.lots.length;
      totalQuantity += isLotLevelFilter(activeFilter) ? record.lots.length : (record.quantity || 0);
    });
    return {
      usedLocations: Object.keys(used).length,
      lotCount: lotCount,
      totalQuantity: totalQuantity,
      otherCount: records.length - locatedRecords.length,
      recordCount: records.length,
      activeFilter: activeFilter || "all",
    };
  }

  function emptyDetailHtml(stats) {
    var html = "";
    html += '<div class="inv3d-detail-empty">';
    html += '<strong>ロット未選択</strong>';
    html += '<dl>';
    html += detailRow("対象レコード", stats.recordCount + "件");
    html += detailRow("表示ロット", stats.lotCount + "件");
    if (stats.activeFilter && stats.activeFilter !== "all") {
      html += detailRow("絞り込み", filterLabel(stats.activeFilter));
    }
    html += detailRow("高さ", "最大4段");
    html += '</dl></div>';
    return html;
  }

  function lotDetailHtml(lot, stats) {
    var html = "";
    html += '<div class="inv3d-detail-kicker">' + esc(lot.location) + '</div>';
    html += '<h2>' + esc(lot.lotNumber) + '</h2>';
    html += '<span class="inv3d-status ' + esc(statusKey(lot)) + '">' + esc(lot.status) + '</span>';
    html += '<dl>';
    html += detailRow("product", lot.product);
    html += detailRow("山内位置", lot.position + "番 / " + lot.level + "段");
    html += detailRow("branch_", lot.branch || "-");
    html += detailRow("スタンプ", stampBorderKind(lot) ? (lot.stamp || "あり") : "-");
    html += detailRow("shipped_", lot.shipped || "-");
    html += detailRow("quantity", lot.quantity.toLocaleString());
    if (lot.remark) html += detailRow("remark", lot.remark);
    html += '</dl>';
    if (lot.recordId) {
      html += '<button type="button" class="inv3d-open" data-open-record="' + esc(lot.recordId) + '">レコードを開く</button>';
    }
    html += '<div class="inv3d-detail-foot">表示ロット ' + stats.lotCount + '件</div>';
    return html;
  }

  function summaryCard(label, value, subLabel) {
    return '<div><span>' + esc(label) + '</span><strong>' + esc(value) + '</strong><em>' + esc(subLabel) + '</em></div>';
  }

  function legend(type, label, activeFilter) {
    var active = type === activeFilter ? " is-active" : "";
    var pressed = type === activeFilter ? "true" : "false";
    return '<button type="button" class="' + type + active + '" data-filter="' + esc(type) + '" aria-pressed="' + pressed + '"><i></i>' + esc(label) + '</button>';
  }

  function detailRow(label, value) {
    return '<div><dt>' + esc(label) + '</dt><dd>' + esc(value) + '</dd></div>';
  }

  function renderStaticFallback(host, records) {
    var html = '<div class="inv3d-static">';
    records.slice(0, 80).forEach(function (record) {
      html += '<div><strong>' + esc(record.location) + '</strong><span>' + esc(record.product) + '</span><em>' + record.lots.length + 'ロット</em></div>';
    });
    html += '</div>';
    host.insertAdjacentHTML("beforeend", html);
  }

  function operationGuideElement() {
    var guide = document.createElement("div");
    guide.className = "inv3d-operation-guide";
    guide.innerHTML = [
      '<strong>マウス操作</strong>',
      '<div>ドラッグ: 回転</div>',
      '<div>Shift+ドラッグ / 右ドラッグ: 移動</div>',
      '<div>ホイール: 拡大縮小</div>',
      '<div>ダブルクリック: レコードを開く</div>',
    ].join("");
    return guide;
  }

  function openRecord(recordId) {
    if (!recordId) return;
    window.location.href = window.location.origin + "/k/" + APP_ID + "/show#record=" + encodeURIComponent(recordId);
  }

  function makeTextSprite(THREE, text, color, background, width, height) {
    var canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    var ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = background;
    roundRect(ctx, 0, 0, width, height, 7);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.font = "700 16px 'Segoe UI', 'Noto Sans JP', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, width / 2, height / 2 + 1);
    var texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
  }

  function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  function trimValue(field) {
    var value = field && field.value;
    if (Array.isArray(value)) return value.join(",");
    if (value === null || value === undefined) return "";
    return String(value).trim();
  }

  function toNumber(value) {
    var number = parseInt(value || "0", 10);
    return Number.isFinite(number) ? number : 0;
  }

  function shortLotLabel(value) {
    var text = String(value || "");
    return text.length > 6 ? text.slice(-6) : text;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();
