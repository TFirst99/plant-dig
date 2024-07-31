const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const tileSize = 30;
const gridWidth = 20;
const gridHeight = 15;

canvas.width = tileSize * gridWidth;
canvas.height = tileSize * gridHeight;

const player = {
    x: Math.floor(gridWidth / 2),
    y: Math.floor(gridHeight / 2)
};

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

function drawPlayer() {
    ctx.fillStyle = 'blue';
    ctx.fillRect(player.x * tileSize, player.y * tileSize, tileSize, tileSize);
}

function update() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    drawPlayer();
    requestAnimationFrame(update);
}

document.addEventListener('keydown', (e) => {
    switch(e.key) {
        case 'ArrowUp':
            if (player.y > 0) player.y--;
            break;
        case 'ArrowDown':
            if (player.y < gridHeight - 1) player.y++;
            break;
        case 'ArrowLeft':
            if (player.x > 0) player.x--;
            break;
        case 'ArrowRight':
            if (player.x < gridWidth - 1) player.x++;
            break;
    }
});

update();