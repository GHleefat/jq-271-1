const GameState = {
  score: 0,
  level: 1,
  backlog: 0,
  config: {
    shelfCount: 10,
    rows: 3,
    cols: 4,
    initPackages: 8,
  },
  shelves: [],
  pendingPackages: [],
  pickupTasks: [],
  currentMode: "setup",
  pickupTimer: null,
  pickupTimeLeft: 0,
  pickedThisRound: 0,
  totalThisRound: 0,
};

const SIZE_CONFIG = {
  s: { label: "小", color: "#4CAF50" },
  m: { label: "中", color: "#FFC107" },
  l: { label: "大", color: "#f44336" },
};

function generatePackageId() {
  return "SF" + Math.random().toString(36).substring(2, 8).toUpperCase();
}

function generateRandomPackage() {
  const sizes = ["s", "m", "l"];
  const weights = [0.5, 0.35, 0.15];
  let rand = Math.random();
  let size = "s";
  let cumulative = 0;
  for (let i = 0; i < sizes.length; i++) {
    cumulative += weights[i];
    if (rand <= cumulative) {
      size = sizes[i];
      break;
    }
  }
  const tail = String(
    Math.floor(Math.random() * GameState.config.shelfCount),
  ).padStart(2, "0");
  return {
    id: generatePackageId(),
    tail: tail,
    size: size,
    placed: false,
    shelfIndex: null,
    row: null,
    col: null,
  };
}

function initShelves() {
  GameState.shelves = [];
  for (let i = 0; i < GameState.config.shelfCount; i++) {
    const shelf = {
      id: i,
      label: String(i).padStart(2, "0"),
      cells: [],
    };
    for (let r = 0; r < GameState.config.rows; r++) {
      const row = [];
      for (let c = 0; c < GameState.config.cols; c++) {
        row.push(null);
      }
      shelf.cells.push(row);
    }
    GameState.shelves.push(shelf);
  }
}

function showToast(message, type = "info", duration = 2000) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = "toast show " + type;
  setTimeout(() => {
    toast.className = "toast";
  }, duration);
}

function updateStats() {
  document.getElementById("score").textContent = GameState.score;
  document.getElementById("level").textContent = GameState.level;
  document.getElementById("backlog").textContent = GameState.backlog;
}

function switchMode(mode) {
  GameState.currentMode = mode;
  document
    .querySelectorAll(".mode-btn")
    .forEach((btn) => btn.classList.remove("active"));
  document.getElementById("btn-" + mode).classList.add("active");

  document.getElementById("setup-panel").style.display =
    mode === "setup" ? "block" : "none";
  document.getElementById("storage-panel").style.display =
    mode === "storage" ? "block" : "none";
  document.getElementById("pickup-panel").style.display =
    mode === "pickup" ? "block" : "none";
  document.getElementById("timer-container").style.display =
    mode === "pickup" ? "flex" : "none";
}

function renderPendingPackages() {
  const container = document.getElementById("pending-packages");
  if (GameState.pendingPackages.length === 0) {
    container.innerHTML = '<div class="empty-state">🎉 所有包裹已上架</div>';
    return;
  }
  container.innerHTML = GameState.pendingPackages
    .map(
      (pkg, idx) => `
        <div class="package-item size-${pkg.size}" draggable="true" data-idx="${idx}">
            <div class="package-header">
                <span class="package-tail">尾号 ${pkg.tail}</span>
                <span class="package-size">${SIZE_CONFIG[pkg.size].label}</span>
            </div>
            <div class="package-id">${pkg.id}</div>
        </div>
    `,
    )
    .join("");

  container.querySelectorAll(".package-item").forEach((el) => {
    el.addEventListener("dragstart", handleDragStart);
    el.addEventListener("dragend", handleDragEnd);
  });
}

function findEmptyCell(shelf) {
  for (let r = 0; r < shelf.cells.length; r++) {
    for (let c = 0; c < shelf.cells[r].length; c++) {
      if (shelf.cells[r][c] === null) {
        return { row: r, col: c };
      }
    }
  }
  return null;
}

function renderShelves(containerId, interactive = true) {
  const container = document.getElementById(containerId);
  container.innerHTML = GameState.shelves
    .map((shelf) => {
      const cellsHtml = shelf.cells
        .map((row, rIdx) => {
          return row
            .map((cell, cIdx) => {
              if (cell) {
                return `
                        <div class="cell filled size-${cell.size}" 
                             data-shelf="${shelf.id}" data-row="${rIdx}" data-col="${cIdx}">
                            <div class="cell-package">
                                <span class="cell-tail">${cell.tail}</span>
                                <span class="cell-size-tag ${cell.size}"></span>
                                <div class="cell-id">${cell.id}</div>
                            </div>
                        </div>
                    `;
              } else {
                return `<div class="cell" data-shelf="${shelf.id}" data-row="${rIdx}" data-col="${cIdx}"></div>`;
              }
            })
            .join("");
        })
        .join("");

      return `
            <div class="shelf" data-shelf="${shelf.id}">
                <div class="shelf-title">📦 货架 ${shelf.label} (尾号 ${shelf.label})</div>
                <div class="shelf-grid" style="grid-template-columns: repeat(${GameState.config.cols}, 1fr);">
                    ${cellsHtml}
                </div>
            </div>
        `;
    })
    .join("");

  if (interactive && containerId === "shelves-container") {
    container.querySelectorAll(".shelf").forEach((shelfEl) => {
      shelfEl.addEventListener("dragover", handleDragOver);
      shelfEl.addEventListener("dragleave", handleDragLeave);
      shelfEl.addEventListener("drop", handleDrop);
    });
  }
}

let draggedPackageIdx = null;

function handleDragStart(e) {
  draggedPackageIdx = parseInt(e.currentTarget.dataset.idx);
  e.currentTarget.classList.add("dragging");
  e.dataTransfer.effectAllowed = "move";
}

function handleDragEnd(e) {
  e.currentTarget.classList.remove("dragging");
  document
    .querySelectorAll(".shelf")
    .forEach((s) => s.classList.remove("drag-over"));
}

function handleDragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add("drag-over");
}

function handleDragLeave(e) {
  if (!e.currentTarget.contains(e.relatedTarget)) {
    e.currentTarget.classList.remove("drag-over");
  }
}

function handleDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove("drag-over");

  if (draggedPackageIdx === null) return;

  const shelfId = parseInt(e.currentTarget.dataset.shelf);
  const pkg = GameState.pendingPackages[draggedPackageIdx];
  const expectedTail = String(shelfId).padStart(2, "0");
  const pkgTail = pkg.tail;

  if (pkgTail !== expectedTail) {
    showToast(
      `❌ 包裹尾号 ${pkgTail} 不能放到 ${expectedTail} 号货架！`,
      "error",
    );
    return;
  }

  const shelf = GameState.shelves[shelfId];
  const emptyCell = findEmptyCell(shelf);

  if (!emptyCell) {
    showToast(`⚠️ 货架 ${shelf.label} 已满，请换一层或换货架`, "warning");
    return;
  }

  pkg.placed = true;
  pkg.shelfIndex = shelfId;
  pkg.row = emptyCell.row;
  pkg.col = emptyCell.col;
  shelf.cells[emptyCell.row][emptyCell.col] = pkg;

  GameState.pendingPackages.splice(draggedPackageIdx, 1);
  draggedPackageIdx = null;

  GameState.score += 5;
  updateStats();
  showToast(`✅ 上架成功！+5分`, "success", 1200);

  renderPendingPackages();
  renderShelves("shelves-container");
}

function startGame() {
  GameState.config.shelfCount =
    parseInt(document.getElementById("shelf-count").value) || 10;
  GameState.config.rows = parseInt(document.getElementById("rows").value) || 3;
  GameState.config.cols = parseInt(document.getElementById("cols").value) || 4;
  GameState.config.initPackages =
    parseInt(document.getElementById("init-packages").value) || 8;

  if (GameState.config.shelfCount < 2 || GameState.config.shelfCount > 20) {
    showToast("货架编号需在 2-20 之间", "error");
    return;
  }

  GameState.score = 0;
  GameState.level = 1;
  GameState.backlog = 0;
  GameState.pendingPackages = [];
  GameState.pickupTasks = [];

  initShelves();

  for (let i = 0; i < GameState.config.initPackages; i++) {
    GameState.pendingPackages.push(generateRandomPackage());
  }

  updateStats();
  switchMode("storage");
  renderPendingPackages();
  renderShelves("shelves-container");
  showToast(
    `🎮 第 ${GameState.level} 关开始！上架 ${GameState.config.initPackages} 个包裹`,
    "success",
  );
}

function addNewPackage() {
  const pkg = generateRandomPackage();
  GameState.pendingPackages.push(pkg);
  GameState.backlog++;
  updateStats();
  renderPendingPackages();
  showToast(
    `📦 新包裹到达：尾号 ${pkg.tail} (${SIZE_CONFIG[pkg.size].label})`,
    "info",
    1500,
  );
}

function enterPickupMode() {
  const notPlaced = GameState.pendingPackages.length;
  if (notPlaced > 0) {
    showToast(`还有 ${notPlaced} 个包裹未上架，将作为积压扣分`, "warning");
    GameState.score -= notPlaced * 10;
    GameState.backlog += notPlaced;
    GameState.pendingPackages = [];
    updateStats();
  }

  const allPlaced = [];
  GameState.shelves.forEach((shelf) => {
    shelf.cells.forEach((row) => {
      row.forEach((cell) => {
        if (cell) allPlaced.push(cell);
      });
    });
  });

  if (allPlaced.length === 0) {
    showToast("货架上没有包裹，请先上架！", "error");
    return;
  }

  const taskCount = Math.min(
    Math.floor(allPlaced.length * 0.6) + GameState.level,
    allPlaced.length,
  );
  const shuffled = [...allPlaced].sort(() => Math.random() - 0.5);
  GameState.pickupTasks = shuffled.slice(0, taskCount).map((p) => ({
    ...p,
    done: false,
  }));

  GameState.pickedThisRound = 0;
  GameState.totalThisRound = taskCount;
  GameState.pickupTimeLeft = Math.max(15, taskCount * 4 - GameState.level * 2);

  switchMode("pickup");
  renderTaskList();
  renderShelves("pickup-shelves", false);
  attachPickupHandlers();
  startTimer();
  document.getElementById("search-result").innerHTML =
    '<div class="empty-state">输入手机尾号查询</div>';
  document.getElementById("round-result").style.display = "none";
}

function renderTaskList() {
  const container = document.getElementById("task-list");
  if (GameState.pickupTasks.length === 0) {
    container.innerHTML = '<div class="empty-state">暂无取件任务</div>';
    return;
  }
  container.innerHTML = GameState.pickupTasks
    .map(
      (task, idx) => `
        <div class="task-item ${task.done ? "done" : ""}" data-idx="${idx}">
            <span>📦 ${task.id}</span>
            <span class="task-tail">尾号 ${task.tail}</span>
        </div>
    `,
    )
    .join("");
}

function attachPickupHandlers() {
  document.querySelectorAll("#pickup-shelves .cell.filled").forEach((cell) => {
    cell.addEventListener("click", handlePickupClick);
  });
}

function handlePickupClick(e) {
  const cellEl = e.currentTarget;
  const shelfId = parseInt(cellEl.dataset.shelf);
  const row = parseInt(cellEl.dataset.row);
  const col = parseInt(cellEl.dataset.col);

  const pkg = GameState.shelves[shelfId].cells[row][col];
  if (!pkg) return;

  const taskIdx = GameState.pickupTasks.findIndex(
    (t) => t.id === pkg.id && !t.done,
  );

  if (taskIdx === -1) {
    cellEl.classList.add("wrong");
    setTimeout(() => cellEl.classList.remove("wrong"), 500);
    GameState.score -= 5;
    updateStats();
    showToast("❌ 这个包裹不在取件列表中！-5分", "error", 1200);
    return;
  }

  GameState.pickupTasks[taskIdx].done = true;
  GameState.shelves[shelfId].cells[row][col] = null;
  GameState.pickedThisRound++;
  GameState.score += 15;
  updateStats();

  showToast(
    `✅ 出库成功！+15分 (${GameState.pickedThisRound}/${GameState.totalThisRound})`,
    "success",
    1000,
  );
  renderTaskList();
  renderShelves("pickup-shelves", false);
  attachPickupHandlers();

  if (GameState.pickedThisRound >= GameState.totalThisRound) {
    finishPickupRound(true);
  }
}

function startTimer() {
  const timerEl = document.getElementById("timer");
  timerEl.textContent = GameState.pickupTimeLeft;

  if (GameState.pickupTimer) clearInterval(GameState.pickupTimer);

  GameState.pickupTimer = setInterval(() => {
    GameState.pickupTimeLeft--;
    timerEl.textContent = GameState.pickupTimeLeft;

    if (GameState.pickupTimeLeft <= 5) {
      timerEl.style.color = "#f44336";
    } else {
      timerEl.style.color = "";
    }

    if (GameState.pickupTimeLeft <= 0) {
      finishPickupRound(false);
    }
  }, 1000);
}

function finishPickupRound(completed) {
  if (GameState.pickupTimer) {
    clearInterval(GameState.pickupTimer);
    GameState.pickupTimer = null;
  }

  const remaining = GameState.totalThisRound - GameState.pickedThisRound;
  const timeBonus = completed ? GameState.pickupTimeLeft * 2 : 0;
  const missedPenalty = remaining * 20;
  const roundScore = GameState.pickedThisRound * 15 + timeBonus - missedPenalty;

  GameState.score += timeBonus - (completed ? 0 : missedPenalty);
  GameState.backlog += remaining;

  if (remaining > 0) {
    const notDone = GameState.pickupTasks.filter((t) => !t.done);
    notDone.forEach((task) => {
      if (task.shelfIndex !== null && task.row !== null && task.col !== null) {
        GameState.shelves[task.shelfIndex].cells[task.row][task.col] = null;
      }
    });
  }

  updateStats();

  const resultEl = document.getElementById("round-result");
  resultEl.innerHTML = `
        <h3>${completed ? "🎉 本关完成！" : "⏰ 时间到！"}</h3>
        <div class="score-breakdown">
            <div class="score-item">
                <div class="label">成功取件</div>
                <div class="value">${GameState.pickedThisRound}/${GameState.totalThisRound}</div>
            </div>
            <div class="score-item">
                <div class="label">取件得分</div>
                <div class="value">+${GameState.pickedThisRound * 15}</div>
            </div>
            ${
              completed
                ? `
            <div class="score-item">
                <div class="label">时间奖励</div>
                <div class="value">+${timeBonus}</div>
            </div>
            `
                : `
            <div class="score-item">
                <div class="label">超时积压</div>
                <div class="value" style="color:#f44336;">-${missedPenalty}</div>
            </div>
            `
            }
        </div>
        <p>当前总分：<strong style="font-size:20px;color:#f5576c;">${GameState.score}</strong></p>
        <button class="primary-btn" onclick="nextLevel()">🚀 进入下一关</button>
    `;
  resultEl.style.display = "block";
}

function nextLevel() {
  GameState.level++;
  const newPackages = GameState.config.initPackages + GameState.level * 2;

  for (let i = 0; i < newPackages; i++) {
    GameState.pendingPackages.push(generateRandomPackage());
  }

  document.getElementById("round-result").style.display = "none";
  switchMode("storage");
  renderPendingPackages();
  renderShelves("shelves-container");
  showToast(
    `🎮 第 ${GameState.level} 关！新增 ${newPackages} 个包裹待上架`,
    "success",
  );
}

function searchByTail() {
  const tailInput = document.getElementById("search-tail").value.trim();
  const resultEl = document.getElementById("search-result");

  if (!tailInput || tailInput.length === 0) {
    resultEl.innerHTML = '<div class="empty-state">请输入手机尾号</div>';
    return;
  }

  const normalizedTail = tailInput.padStart(2, "0");
  const tailDigit = parseInt(normalizedTail) % GameState.config.shelfCount;
  const searchTail = String(tailDigit).padStart(2, "0");

  const matches = [];
  GameState.shelves.forEach((shelf) => {
    shelf.cells.forEach((row, rIdx) => {
      row.forEach((cell, cIdx) => {
        if (cell && cell.tail === searchTail) {
          matches.push({
            ...cell,
            shelfLabel: shelf.label,
            rowLabel: rIdx + 1,
            colLabel: cIdx + 1,
          });
        }
      });
    });
  });

  document.querySelectorAll("#pickup-shelves .cell").forEach((c) => {
    c.classList.remove("pickup-target");
  });

  if (matches.length === 0) {
    resultEl.innerHTML = `<div class="empty-state">未找到尾号 ${searchTail} 的包裹</div>`;
    return;
  }

  resultEl.innerHTML = `
        <div style="margin-bottom:8px;font-size:13px;color:#666;">找到 ${matches.length} 个尾号 ${searchTail} 的包裹：</div>
        ${matches
          .map(
            (m) => `
            <div class="result-item">
                <span>📦 ${m.id} (${SIZE_CONFIG[m.size].label})</span>
                <span class="result-location">${m.shelfLabel}号·${m.rowLabel}层·${m.colLabel}格</span>
            </div>
        `,
          )
          .join("")}
    `;

  matches.forEach((m) => {
    const cellEl = document.querySelector(
      `#pickup-shelves .cell[data-shelf="${m.shelfIndex}"][data-row="${m.row}"][data-col="${m.col}"]`,
    );
    if (cellEl) cellEl.classList.add("pickup-target");
  });
}

document.addEventListener("DOMContentLoaded", () => {
  document
    .getElementById("btn-setup")
    .addEventListener("click", () => switchMode("setup"));
  document.getElementById("btn-storage").addEventListener("click", () => {
    if (GameState.shelves.length === 0) {
      showToast("请先设置并开始游戏", "warning");
      return;
    }
    switchMode("storage");
  });
  document.getElementById("btn-pickup").addEventListener("click", () => {
    if (GameState.shelves.length === 0) {
      showToast("请先设置并开始游戏", "warning");
      return;
    }
    enterPickupMode();
  });

  document.getElementById("btn-start").addEventListener("click", startGame);
  document
    .getElementById("btn-new-package")
    .addEventListener("click", addNewPackage);
  document
    .getElementById("btn-finish-storage")
    .addEventListener("click", enterPickupMode);
  document.getElementById("btn-search").addEventListener("click", searchByTail);
  document.getElementById("search-tail").addEventListener("keypress", (e) => {
    if (e.key === "Enter") searchByTail();
  });

  updateStats();
});
