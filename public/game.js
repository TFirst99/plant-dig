const socket = io();

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let player = null;
let visiblePlayers = {};
let chunkSize = 16;
let visibleChunks = 3;

function resizeCanvas() {
  const maxSize = Math.min(window.innerWidth, window.innerHeight);
  canvas.width = maxSize;
  canvas.height = maxSize;
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

socket.on('initGameState', (initState) => {
  player = initState.player;
  chunkSize = initState.chunkSize;
  visibleChunks = initState.visibleChunks;
});

socket.on('gameStateUpdate', (newState) => {
  player = newState.player;
  visiblePlayers = newState.visiblePlayers;
});

function drawGrid() {
  const tileSize = canvas.width / (chunkSize * visibleChunks);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
  
  for (let i = 0; i <= chunkSize * visibleChunks; i++) {
    const pos = i * tileSize;
    ctx.beginPath();
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, canvas.height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, pos);
    ctx.lineTo(canvas.width, pos);
    ctx.stroke();
  }
}

function drawPlayers() {
  const tileSize = canvas.width / (chunkSize * visibleChunks);
  const centerX = Math.floor(canvas.width / 2 / tileSize) * tileSize;
  const centerY = Math.floor(canvas.height / 2 / tileSize) * tileSize;

  // Draw the current player
  ctx.fillStyle = player.faction === 'digger' ? 'blue' : 'green';
  ctx.fillRect(centerX, centerY, tileSize, tileSize);

  // Draw other visible players
  Object.values(visiblePlayers).forEach(otherPlayer => {
    const relativeX = otherPlayer.x - player.x;
    const relativeY = otherPlayer.y - player.y;
    const screenX = centerX + relativeX * tileSize;
    const screenY = centerY + relativeY * tileSize;

    ctx.fillStyle = otherPlayer.faction === 'digger' ? 'red' : 'yellow';
    ctx.fillRect(screenX, screenY, tileSize, tileSize);
  });
}


function update() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (player) {
    drawGrid();
    drawPlayers();
  }
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