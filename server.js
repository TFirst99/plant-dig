const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const port = 3000;

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Game constants
const CHUNK_SIZE = 16;
const VISIBLE_CHUNKS = 3;
const WORLD_SIZE = 50;
const MAX_SOIL_LEVEL = 10;
const INITIAL_SOIL_LEVEL = 5;
const TICK_RATE = 1000; // 1 tick per second

// Game state
const gameState = {
  players: {},
  chunks: {},
  pendingActions: {}
};

function getChunkKey(chunkX, chunkY) {
  return `${chunkX},${chunkY}`;
}

function createChunk(chunkX, chunkY) {
  const chunk = [];
  for (let y = 0; y < CHUNK_SIZE; y++) {
    chunk[y] = [];
    for (let x = 0; x < CHUNK_SIZE; x++) {
      chunk[y][x] = {
        soilLevel: INITIAL_SOIL_LEVEL,
        hasTree: false
      };
    }
  }
  return chunk;
}

function getOrCreateChunk(chunkX, chunkY) {
  const key = getChunkKey(chunkX, chunkY);
  if (!gameState.chunks[key]) {
    gameState.chunks[key] = createChunk(chunkX, chunkY);
  }
  return gameState.chunks[key];
}

function getVisibleChunks(player) {
  const visibleChunks = {};
  const chunkRadius = Math.floor(VISIBLE_CHUNKS / 2);
  const playerChunkX = Math.floor(player.x / CHUNK_SIZE);
  const playerChunkY = Math.floor(player.y / CHUNK_SIZE);

  for (let dy = -chunkRadius; dy <= chunkRadius; dy++) {
    for (let dx = -chunkRadius; dx <= chunkRadius; dx++) {
      const chunkX = playerChunkX + dx;
      const chunkY = playerChunkY + dy;
      const key = getChunkKey(chunkX, chunkY);
      visibleChunks[key] = getOrCreateChunk(chunkX, chunkY);
    }
  }

  return visibleChunks;
}

function getVisiblePlayers(currentPlayer) {
  const visiblePlayers = {};
  const chunkRadius = Math.floor(VISIBLE_CHUNKS / 2);
  const playerChunkX = Math.floor(currentPlayer.x / CHUNK_SIZE);
  const playerChunkY = Math.floor(currentPlayer.y / CHUNK_SIZE);

  Object.entries(gameState.players).forEach(([id, player]) => {
    if (id !== currentPlayer.id) {
      const otherChunkX = Math.floor(player.x / CHUNK_SIZE);
      const otherChunkY = Math.floor(player.y / CHUNK_SIZE);
      if (Math.abs(otherChunkX - playerChunkX) <= chunkRadius &&
          Math.abs(otherChunkY - playerChunkY) <= chunkRadius) {
        visiblePlayers[id] = player;
      }
    }
  });

  return visiblePlayers;
}

function performAction(player, action) {
  const chunkX = Math.floor(player.x / CHUNK_SIZE);
  const chunkY = Math.floor(player.y / CHUNK_SIZE);
  const chunk = getOrCreateChunk(chunkX, chunkY);
  const tileX = player.x % CHUNK_SIZE;
  const tileY = player.y % CHUNK_SIZE;
  const tile = chunk[tileY][tileX];

  switch (action) {
    case 'dig':
      if (player.faction === 'digger' && tile.soilLevel > 0) {
        tile.soilLevel--;
        if (tile.soilLevel < MAX_SOIL_LEVEL && tile.hasTree) {
          tile.hasTree = false;
        }
        return true;
      }
      break;
    case 'fill':
      if (player.faction === 'restorer' && tile.soilLevel < MAX_SOIL_LEVEL) {
        tile.soilLevel++;
        return true;
      }
      break;
    case 'plant':
      if (player.faction === 'restorer' && tile.soilLevel === MAX_SOIL_LEVEL && !tile.hasTree) {
        tile.hasTree = true;
        return true;
      }
      break;
    case 'chop':
      if (player.faction === 'digger' && tile.hasTree) {
        tile.hasTree = false;
        return true;
      }
      break;
  }
  return false;
}

io.on('connection', (socket) => {
  console.log('New player connected:', socket.id);
  
  gameState.players[socket.id] = {
    id: socket.id,
    x: Math.floor(Math.random() * WORLD_SIZE),
    y: Math.floor(Math.random() * WORLD_SIZE),
    faction: Math.random() < 0.5 ? 'digger' : 'restorer'
  };

  socket.emit('initGameState', {
    player: gameState.players[socket.id],
    chunkSize: CHUNK_SIZE,
    visibleChunks: VISIBLE_CHUNKS,
    maxSoilLevel: MAX_SOIL_LEVEL
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    delete gameState.players[socket.id];
    delete gameState.pendingActions[socket.id];
  });

  socket.on('playerInput', (input) => {
    if (!gameState.pendingActions[socket.id]) {
      gameState.pendingActions[socket.id] = input;
    }
  });
});

function processPlayerActions() {
  Object.entries(gameState.pendingActions).forEach(([playerId, action]) => {
    const player = gameState.players[playerId];
    if (!player) return;

    if (action.type === 'move') {
      let newX = player.x;
      let newY = player.y;

      switch (action.direction) {
        case 'up':
          if (player.y > 0) newY--;
          break;
        case 'down':
          if (player.y < WORLD_SIZE - 1) newY++;
          break;
        case 'left':
          if (player.x > 0) newX--;
          break;
        case 'right':
          if (player.x < WORLD_SIZE - 1) newX++;
          break;
      }

      if (newX !== player.x || newY !== player.y) {
        player.x = newX;
        player.y = newY;
      }
    } else if (action.type === 'action') {
      performAction(player, action.action);
    }

    delete gameState.pendingActions[playerId];
  });
}

function gameTick() {
  processPlayerActions();

  // Send updates to all players
  Object.values(gameState.players).forEach((player) => {
    io.emit('gameStateUpdate', {
      players: gameState.players,
      chunks: gameState.chunks
    });
  });

  console.log("Player Locations:");
  Object.entries(gameState.players).forEach(([playerId, player]) => {
    console.log(`Player ${playerId}: (${player.x}, ${player.y})`);
  });
}

setInterval(gameTick, TICK_RATE);

server.listen(port, () => {
  console.log(`Game server running at http://localhost:${port}`);
});