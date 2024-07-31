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
const CHUNK_SIZE = 32;
const VISIBLE_CHUNKS = 3;
const VISIBLE_AREA = CHUNK_SIZE * VISIBLE_CHUNKS;

// Game state
const gameState = {
  players: {},
  chunks: {}
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
        soilLevel: Math.floor(Math.random() * 10),
        hasTree: Math.random() < 0.1
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

function getRelevantChunks(playerX, playerY) {
  const centerChunkX = Math.floor(playerX / CHUNK_SIZE);
  const centerChunkY = Math.floor(playerY / CHUNK_SIZE);
  const relevantChunks = {};

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const chunkX = centerChunkX + dx;
      const chunkY = centerChunkY + dy;
      const key = getChunkKey(chunkX, chunkY);
      relevantChunks[key] = getOrCreateChunk(chunkX, chunkY);
    }
  }

  return relevantChunks;
}

io.on('connection', (socket) => {
  console.log('New player connected:', socket.id);
  
  // Add new player to game state
  gameState.players[socket.id] = {
    x: Math.floor(Math.random() * VISIBLE_AREA),
    y: Math.floor(Math.random() * VISIBLE_AREA),
    faction: Math.random() < 0.5 ? 'digger' : 'restorer'
  };

  // Send initial game state to the new player
  const player = gameState.players[socket.id];
  socket.emit('initGameState', {
    player: player,
    chunks: getRelevantChunks(player.x, player.y),
    chunkSize: CHUNK_SIZE,
    visibleChunks: VISIBLE_CHUNKS
  });

  // Handle player disconnect
  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    delete gameState.players[socket.id];
  });

  // Handle player input
  socket.on('playerInput', (input) => {
    gameState.players[socket.id].input = input;
  });
});

// Game tick system
const tickRate = 1000; // 1 tick per second

function gameTick() {
  Object.keys(gameState.players).forEach((playerId) => {
    const player = gameState.players[playerId];
    if (player.input) {
      // Process the input (movement, digging, planting, etc.)
      switch (player.input) {
        case 'up':
          if (player.y > 0) player.y--;
          break;
        case 'down':
          if (player.y < VISIBLE_AREA - 1) player.y++;
          break;
        case 'left':
          if (player.x > 0) player.x--;
          break;
        case 'right':
          if (player.x < VISIBLE_AREA - 1) player.x++;
          break;
      }
      // Clear the processed input
      player.input = null;

      // Send updated game state to the player
      io.to(playerId).emit('gameStateUpdate', {
        player: player,
        chunks: getRelevantChunks(player.x, player.y)
      });
    }
  });
}

// Start the game tick
setInterval(gameTick, tickRate);

server.listen(port, () => {
  console.log(`Game server running at http://localhost:${port}`);
});