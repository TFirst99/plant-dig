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
const WORLD_SIZE = 50; // Assuming a 1000x1000 world

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

io.on('connection', (socket) => {
  console.log('New player connected:', socket.id);
  
  // Add new player to game state
  gameState.players[socket.id] = {
    id: socket.id,
    x: Math.floor(Math.random() * WORLD_SIZE),
    y: Math.floor(Math.random() * WORLD_SIZE),
    faction: Math.random() < 0.5 ? 'digger' : 'restorer'
  };

  // Send initial game state to the new player
  const player = gameState.players[socket.id];
  socket.emit('initGameState', {
    player: player,
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
  // Process player inputs
  Object.values(gameState.players).forEach((player) => {
    if (player.input) {
      // Process the input (movement, digging, planting, etc.)
      switch (player.input) {
        case 'up':
          if (player.y > 0) player.y--;
          break;
        case 'down':
          if (player.y < WORLD_SIZE - 1) player.y++;
          break;
        case 'left':
          if (player.x > 0) player.x--;
          break;
        case 'right':
          if (player.x < WORLD_SIZE - 1) player.x++;
          break;
      }
      // Clear the processed input
      player.input = null;
    }
  });

  // Send updates to all players
  Object.values(gameState.players).forEach((player) => {
    io.to(player.id).emit('gameStateUpdate', {
      player: player,
      visiblePlayers: getVisiblePlayers(player)
    });
  });

  // Print all player locations
  console.log("Player Locations:");
  Object.entries(gameState.players).forEach(([playerId, player]) => {
    console.log(`Player ${playerId}: (${player.x}, ${player.y})`);
  });
}

// Start the game tick
setInterval(gameTick, tickRate);

server.listen(port, () => {
  console.log(`Game server running at http://localhost:${port}`);
});