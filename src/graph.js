import {
  squaredDistance,
  getBoxCenter,
  getExpandedBox,
  getOffsetBox,
  intersectLineBox,
} from "./geometry.js";

// Has the correct size
// Used to initially capture mouse events
const graphContainer = document.getElementById("graph");

// Contains the tasks and dependencies
// Will get translated around
const itemsContainer = document.getElementById("itemsContainer");

function getTasks() {
  const isTask = (e) => e.classList.contains("task");
  return Array.from(itemsContainer.children).filter(isTask);
}

function getDependencies() {
  const isDependency = (e) => e.tagName == "path";
  return Array.from(arrows.children).filter(isDependency);
}

export function clearGraph() {
  const removeElement = (e) => e.parentNode.removeChild(e);
  const tasks = getTasks();
  tasks.forEach(removeElement);
  const dependencies = getDependencies();
  dependencies.forEach(removeElement);
}

function getViewCenter() {
  const box = getOffsetBox(graphContainer);
  const viewCenter = getBoxCenter(box);
  return {
    x: viewCenter.x - panzoom.pan.x,
    y: viewCenter.y - panzoom.pan.y,
  };
}

function computeCenteredPos(element) {
  const viewCenter = getViewCenter();
  const width = element.offsetWidth;
  const height = element.offsetHeight;
  return {
    x: viewCenter.x - width / 2,
    y: viewCenter.y - height / 2,
  };
}

export function addTask(task) {
  const htmlTask = document.createElement("div");
  htmlTask.classList.add("task");
  htmlTask.textContent = task.name;
  htmlTask.from = [];
  htmlTask.to = [];
  if (task.status === "completed") htmlTask.classList.add("completed");
  itemsContainer.appendChild(htmlTask);
  const pos = task.pos ? task.pos : computeCenteredPos(htmlTask);
  htmlTask.style.left = pos.x + "px";
  htmlTask.style.top = pos.y + "px";
  return htmlTask;
}

function addDependency(dependency) {
  const dependencyHtml = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "path"
  );
  const tasks = getTasks();
  const predecessor = tasks.find(
    (task) => task.textContent == dependency.predecessor
  );
  if (!predecessor) {
    console.error(
      "Could not add dependency: predecessor not found",
      dependency
    );
    return;
  }
  const successor = tasks.find(
    (task) => task.textContent == dependency.successor
  );
  if (!successor) {
    console.error("Could not add dependency: successor not found.", dependency);
    return;
  }
  dependencyHtml.from = predecessor;
  dependencyHtml.to = successor;

  predecessor.from.push(dependencyHtml);
  successor.to.push(dependencyHtml);

  const arrows = document.getElementById("arrows");
  arrows.appendChild(dependencyHtml);

  updatePath(dependencyHtml);
}

function deleteTask(task) {
  const from = task.from.slice();
  from.forEach(deleteDependency);
  const to = task.to.slice();
  to.forEach(deleteDependency);
  itemsContainer.removeChild(task);
}

function removeFromArray(array, element) {
  array.splice(array.indexOf(element), 1);
}

function deleteDependency(dependency) {
  removeFromArray(dependency.from.from, dependency);
  removeFromArray(dependency.to.to, dependency);
  const arrows = document.getElementById("arrows");
  arrows.removeChild(dependency);
}

export function selectAll() {
  const tasks = getTasks();
  tasks.forEach((t) => t.classList.add("selected"));
  sendSelectionChanged(tasks);
}

export function deleteSelected() {
  const selected = getSelected();
  selected.forEach(deleteTask);
  sendSelectionChanged([]);
}

export function completeSelected() {
  const selected = getSelected();
  selected.forEach((task) => task.classList.toggle("completed"));
}

function onTaskClicked(task, event) {
  if (event.shiftKey) {
    task.classList.toggle("selected");
    sendSelectionChanged();
  } else {
    resetSelected();
    task.classList.add("selected");
    sendSelectionChanged([task]);
  }
}

/**
 * sends out a "selectionchanged" event
 * @param {[HTMLElement]} selection if known by the caller, passthrough
 */
function sendSelectionChanged(selection) {
  graphContainer.dispatchEvent(
    new CustomEvent("selectionchanged", {
      detail: selection ? selection : getSelected(),
    })
  );
}

function getSelected() {
  const isSelected = (e) => e.classList.contains("selected");
  return getTasks().filter(isSelected);
}

function resetSelected() {
  const selectedTasks = getSelected();
  selectedTasks.forEach((task) => task.classList.remove("selected"));
}

export function loadGraph(graph) {
  clearGraph();
  graph.tasks.forEach(addTask);
  graph.dependencies.forEach(addDependency);
}

export function getGraph() {
  const tasksHtml = getTasks();
  const tasks = tasksHtml.map((e) => {
    const bb = getOffsetBox(e);
    return {
      name: e.textContent,
      pos: { x: bb.left, y: bb.top },
      status: e.classList.contains("completed") ? "completed" : "todo",
    };
  });
  const dependenciesHtml = getDependencies();
  const dependencies = dependenciesHtml.map((e) => ({
    predecessor: e.from.textContent,
    successor: e.to.textContent,
  }));
  return { tasks, dependencies };
}

// updates the visual representation of path
// if dest if specified, use instead of path.to
function updatePath(path, dest) {
  const nodeABox = getOffsetBox(path.from);
  const nodeBBox = dest ? null : getOffsetBox(path.to);

  const centerA = getBoxCenter(nodeABox);
  const centerB = dest ? dest : getBoxCenter(nodeBBox);

  const pathPointA = intersectLineBox(
    centerA,
    centerB,
    getExpandedBox(nodeABox, 8)
  );
  const pathPointB = dest
    ? dest
    : intersectLineBox(centerA, centerB, getExpandedBox(nodeBBox, 8));

  if (pathPointA && pathPointB) {
    path.setAttributeNS(
      null,
      "d",
      `M${pathPointA.x},${pathPointA.y} L${pathPointB.x},${pathPointB.y}`
    );
  } else {
    path.setAttributeNS(null, "d", "");
  }
}

const panzoom = {
  pan: { x: 0, y: 0 },
  zoom: 1,
};

function updatePanzoom() {
  itemsContainer.style.transform = `translate(${panzoom.pan.x}px, ${panzoom.pan.y}px) scale(${panzoom.zoom})`;
}

function onGraphDragStart(event) {
  itemsContainer.setPointerCapture(event.pointerId);
  let previousPosition = { x: event.clientX, y: event.clientY };
  const onPointerMove = (event) => {
    panzoom.pan.x += event.clientX - previousPosition.x;
    panzoom.pan.y += event.clientY - previousPosition.y;
    previousPosition = { x: event.clientX, y: event.clientY };
    updatePanzoom();
  };
  const onPointerEnd = (event) => {
    itemsContainer.removeEventListener("pointermove", onPointerMove);
    itemsContainer.removeEventListener("pointerup", onPointerEnd);
  };
  itemsContainer.addEventListener("pointermove", onPointerMove);
  itemsContainer.addEventListener("pointerup", onPointerEnd);
}

function updateZoomIndicator() {
  const zoomIndicator = document.getElementById("zoomIndicator");
  zoomIndicator.textContent =
    panzoom.zoom === 1 ? "" : Math.floor(panzoom.zoom * 100) + "% zoom";
}

function setupZoom() {
  graphContainer.onwheel = (event) => {
    panzoom.zoom *= event.deltaY < 0 ? 1.1 : 0.9;
    /**
     * Snaps *value* to *target* if close to *target* by less than *offset*
     */
    const snap = (target) => (offset) => (value) =>
      value > target - offset && value < target + offset ? target : value;
    panzoom.zoom = snap(1)(0.1)(panzoom.zoom);
    updatePanzoom();
    updateZoomIndicator();
  };
}

function moveTask(task, pos) {
  task.style.left = pos.x + "px";
  task.style.top = pos.y + "px";
  for (const path of [...task.from, ...task.to]) updatePath(path);
}

export function initGraph() {
  setupZoom();
  graphContainer.onpointerdown = (event) => {
    event.preventDefault();
    let moved = false;
    const task = event.target;
    if (!task.classList.contains("task")) {
      resetSelected();
      sendSelectionChanged([]);
      onGraphDragStart(event);
      return;
    }
    const pointerId = event.pointerId;
    itemsContainer.setPointerCapture(pointerId);
    const initialPosition = { x: event.clientX, y: event.clientY };
    if (
      event.shiftKey ||
      document.querySelector("#linkModeCheckbox input").checked
    ) {
      // Initiate link creation
      const path = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path"
      );
      path.from = task;
      arrows.appendChild(path);
      function onPointerMove(event) {
        if (event.pointerId !== pointerId) return;
        moved = true;
        updatePath(path, { x: event.offsetX, y: event.offsetY });
      }
      function onPointerEnd(event) {
        if (event.pointerId !== pointerId) return;
        if (!moved) onTaskClicked(task, event);
        itemsContainer.removeEventListener("pointermove", onPointerMove);
        itemsContainer.removeEventListener("pointerup", onPointerEnd);
        itemsContainer.removeEventListener("pointercancel", onPointerEnd);
        const target = document.elementFromPoint(event.pageX, event.pageY);
        // TODO Prevent a link to itself
        // TODO Prevent a link to a dependency
        // TODO Prevent a link to a target from which it's a dependency
        if (!target || !target.classList.contains("task")) {
          arrows.removeChild(path);
          return;
        }
        path.to = target;
        task.from.push(path);
        target.to.push(path);
        updatePath(path);
        graphContainer.dispatchEvent(new CustomEvent("newdependency"));
      }
      itemsContainer.addEventListener("pointermove", onPointerMove);
      itemsContainer.addEventListener("pointerup", onPointerEnd);
      itemsContainer.addEventListener("pointercancel", onPointerEnd);
    } else {
      // Initiate Drag
      const offsetX = event.offsetX;
      const offsetY = event.offsetY;
      task.classList.add("dragged");
      function onPointerMove(event) {
        if (event.pointerId !== pointerId) return;
        const currentPosition = { x: event.clientX, y: event.clientY };
        const movedThreshold = 5; // px
        const squaredMovedThreshold = movedThreshold * movedThreshold;
        if (
          squaredDistance(initialPosition, currentPosition) >
          squaredMovedThreshold
        )
          moved = true;
        moveTask(task, {
          x: event.offsetX - offsetX,
          y: event.offsetY - offsetY,
        });
      }
      function onPointerEnd(event) {
        if (event.pointerId !== pointerId) return;
        itemsContainer.removeEventListener("pointermove", onPointerMove);
        itemsContainer.removeEventListener("pointerup", onPointerEnd);
        itemsContainer.removeEventListener("pointercancel", onPointerEnd);
        task.classList.remove("dragged");
        if (moved) {
          graphContainer.dispatchEvent(
            new CustomEvent("taskmoved", { detail: { task } })
          );
        } else onTaskClicked(task, event);
      }
      itemsContainer.addEventListener("pointermove", onPointerMove);
      itemsContainer.addEventListener("pointerup", onPointerEnd);
      itemsContainer.addEventListener("pointercancel", onPointerEnd);
    }
  };
  sendSelectionChanged([]);
  updateZoomIndicator();
}