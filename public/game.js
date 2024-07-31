const socket = io();

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game state
let player = null;
let players = {};
let chunks = {};
let queuedMove = null;
let previousGameState = null;

// Constants
const TILE_SIZE = 32; // pixels
const CHUNK_SIZE = 16; // tiles
const VISIBLE_TILES_X = 25;
const VISIBLE_TILES_Y = 25;
const animations = [];
const ANIMATION_DURATION = 500;

// Derived constants
const CANVAS_WIDTH = VISIBLE_TILES_X * TILE_SIZE;
const CANVAS_HEIGHT = VISIBLE_TILES_Y * TILE_SIZE;

// Set canvas size
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

// Camera position (top-left corner of the view)
let cameraX = 0;
let cameraY = 0;

socket.on('initGameState', (initState) => {
  player = initState.player;
  updateCamera();
});

socket.on('gameStateUpdate', (newState) => {
  const oldChunks = chunks;
  players = newState.players;
  chunks = newState.chunks;
  player = players[socket.id];
  updateCamera();
  queuedMove = null;

  Object.entries(chunks).forEach(([key, chunk]) => {
    const oldChunk = oldChunks[key];
    if (oldChunk) {
      for (let y = 0; y < CHUNK_SIZE; y++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          if (chunk[y][x].soilLevel !== oldChunk[y][x].soilLevel) {
            const worldX = parseInt(key.split(',')[0]) * CHUNK_SIZE + x;
            const worldY = parseInt(key.split(',')[1]) * CHUNK_SIZE + y;
            const action = chunk[y][x].soilLevel > oldChunk[y][x].soilLevel ? 'fill' : 'dig';
            createAnimation(worldX, worldY, action);
          }
        }
      }
    }
  });
});

function updateCamera() {
  if (player) {
    cameraX = player.x - Math.floor(VISIBLE_TILES_X / 2);
    cameraY = player.y - Math.floor(VISIBLE_TILES_Y / 2);
  }
}

function worldToScreen(worldX, worldY) {
  return {
    x: (worldX - cameraX) * TILE_SIZE,
    y: (worldY - cameraY) * TILE_SIZE
  };
}

function drawWorld() {
  for (let y = 0; y < VISIBLE_TILES_Y; y++) {
    for (let x = 0; x < VISIBLE_TILES_X; x++) {
      const worldX = cameraX + x;
      const worldY = cameraY + y;
      const chunkX = Math.floor(worldX / CHUNK_SIZE);
      const chunkY = Math.floor(worldY / CHUNK_SIZE);
      const chunk = chunks[`${chunkX},${chunkY}`];

      if (chunk) {
        const tileX = ((worldX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const tileY = ((worldY % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const tile = chunk[tileY][tileX];

        const {x: screenX, y: screenY} = worldToScreen(worldX, worldY);

        // Draw soil
        const soilColor = `rgb(${255 - tile.soilLevel * 25}, ${255 - tile.soilLevel * 25}, ${255 - tile.soilLevel * 25})`;
        ctx.fillStyle = soilColor;
        ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);

        // Draw tree
        if (tile.hasTree) {
          ctx.fillStyle = 'green';
          ctx.beginPath();
          ctx.moveTo(screenX + TILE_SIZE / 2, screenY);
          ctx.lineTo(screenX + TILE_SIZE, screenY + TILE_SIZE);
          ctx.lineTo(screenX, screenY + TILE_SIZE);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
  }
}

function drawPlayers() {
  Object.values(players).forEach(p => {
    const {x: screenX, y: screenY} = worldToScreen(p.x, p.y);

    ctx.fillStyle = p.faction === 'digger' ? 'red' : 'blue';
    ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);

    // Draw player ID above the player
    ctx.fillStyle = 'white';
    ctx.font = '12px Arial';
    ctx.fillText(p.id, screenX, screenY - 5);
  });
}

function drawGrid() {
  ctx.strokeStyle = 'rgba(128, 128, 128, 0.5)';
  ctx.lineWidth = 1;

  for (let x = 0; x <= VISIBLE_TILES_X; x++) {
    const screenX = x * TILE_SIZE;
    ctx.beginPath();
    ctx.moveTo(screenX, 0);
    ctx.lineTo(screenX, CANVAS_HEIGHT);
    ctx.stroke();
  }

  for (let y = 0; y <= VISIBLE_TILES_Y; y++) {
    const screenY = y * TILE_SIZE;
    ctx.beginPath();
    ctx.moveTo(0, screenY);
    ctx.lineTo(CANVAS_WIDTH, screenY);
    ctx.stroke();
  }
}

function drawTargetCell() {
  if (player && queuedMove) {
    const targetWorldX = player.x + queuedMove.x;
    const targetWorldY = player.y + queuedMove.y;
    const {x: screenX, y: screenY} = worldToScreen(targetWorldX, targetWorldY);

    ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
    ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
  }
}

function update() {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  if (player) {
    drawWorld();
    drawGrid();
    drawTargetCell();
    drawPlayers();
    updateAndDrawAnimations();
    updateUI();
  }
  requestAnimationFrame(update);
}

function updateUI() {
  document.getElementById('faction').textContent = player.faction;
  document.getElementById('player-x').textContent = player.x;
  document.getElementById('player-y').textContent = player.y;
}

function createAnimation(x, y, action) {
  animations.push({
    x, y,
    action,
    startTime: Date.now(),
  });
}

function updateAndDrawAnimations() {
  const currentTime = Date.now();
  for (let i = animations.length - 1; i >= 0; i--) {
    const anim = animations[i];
    const elapsedTime = currentTime - anim.startTime;
    const progress = Math.min(elapsedTime / ANIMATION_DURATION, 1);

    if (progress >= 1) {
      animations.splice(i, 1);
      continue;
    }

    const {x: screenX, y: screenY} = worldToScreen(anim.x, anim.y);
    const size = TILE_SIZE * progress;
    const offset = (TILE_SIZE - size) / 2;

    ctx.fillStyle = anim.action === 'dig' ? 'rgba(139, 69, 19, 0.5)' : 'rgba(34, 139, 34, 0.5)';
    ctx.fillRect(screenX + offset, screenY + offset, size, size);
  }
}

let targetX = 0;
let targetY = 0;

document.addEventListener('keydown', (e) => {
  let input = { type: 'move', direction: null };
  switch(e.key) {
    case 'ArrowUp':
      input.direction = 'up';
      queuedMove = { x: 0, y: -1 };
      break;
    case 'ArrowDown':
      input.direction = 'down';
      queuedMove = { x: 0, y: 1 };
      break;
    case 'ArrowLeft':
      input.direction = 'left';
      queuedMove = { x: -1, y: 0 };
      break;
    case 'ArrowRight':
      input.direction = 'right';
      queuedMove = { x: 1, y: 0 };
      break;
    case ' ':
      input = { type: 'action', action: player.faction === 'digger' ? 'dig' : 'fill' };
      queuedMove = null;
      break;
    case 'p':
      if (player.faction === 'restorer') {
        input = { type: 'action', action: 'plant' };
        queuedMove = null;
      }
      break;
    case 'c':
      if (player.faction === 'digger') {
        input = { type: 'action', action: 'chop' };
        queuedMove = null;
      }
      break;
    default:
      return; // Exit the function for other keys
  }
  if (input.direction || input.action) {
    socket.emit('playerInput', input);
  }
});

update();