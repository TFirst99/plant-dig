const socket = io();

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const tileSize = 30;
const gridWidth = 30;
const gridHeight = 30;

canvas.width = tileSize * gridWidth;
canvas.height = tileSize * gridHeight;

let gameState = null;

socket.on('gameState', (newState) => {
  gameState = newState;
});

function drawGrid() {
  ctx.strokeStyle = '#ccc';
  for (let x = 0; x <= gridWidth; x++) {
    ctx.beginPath();
    ctx.moveTo(x * tileSize, 0);
    ctx.lineTo(x * tileSize, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= gridHeight; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * tileSize);
    ctx.lineTo(canvas.width, y * tileSize);
    ctx.stroke();
  }
}

function drawPlayers() {
  if (!gameState) return;
  
  Object.values(gameState.players).forEach((player) => {
    ctx.fillStyle = player.faction === 'digger' ? 'blue' : 'green';
    ctx.fillRect(player.x * tileSize, player.y * tileSize, tileSize, tileSize);
  });
}

function update() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  drawPlayers();
  requestAnimationFrame(update);
}

document.addEventListener('keydown', (e) => {
  let input = null;
  switch(e.key) {
    case 'ArrowUp':
      input = 'up';
      break;
    case 'ArrowDown':
      input = 'down';
      break;
    case 'ArrowLeft':
      input = 'left';
      break;
    case 'ArrowRight':
      input = 'right';
      break;
  }
  if (input) {
    socket.emit('playerInput', input);
  }
});

update();