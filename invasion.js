"use strict";

var canvas, ctx;
var canvasBg, ctxBg;
var canvasText, ctxText;
var player = {};
var enemies = [];
var swarm = {};
var laser = null;
var bomb = null;
var bombInterval = 1.5;
var winInterval = 0;
var screenWidth = 512;
var screenHeight = 448;
var input = {left: 0, right: 0, fire: 0};
var dtFrame = 1 / 60;
var targetTime = dtFrame * 1000;
var timeStart, timeEnd, timeDiff;
var secondsElapsed = 0;
var showDebug = false;
var startGame = false;
var readyScreenCounter = 0;
var showTitleScreen = false;
var showReadyScreen = false;
var playingGame = false;
var gameOver = false;
var gameOverCounter = 0;
var pause = false;
var canvasScale;
var stars = [];
var blasts = [];
var score = 0;
var charWidth = 7;
var charHeight = 10;

document.addEventListener(
	"keydown",
	function(event) {
		switch (event.keyCode) {
		case 13: // enter
			input.enter = 1;
			break;
		case 37: // left arrow
		case 65: // "a"
			input.left = 1;
			break;
		case 39: // right arrow
		case 68: // "d"
			input.right = 1;
			break;
		case 16: // shift (left or right)
		case 17: // ctrl (left or right)
		case 32: // space
			input.fire = 1;
			break;
		/*
		case 83: // "s"
			showDebug = !showDebug;
			break;
		*/
		case 80: // "p"
			// Don't allow pausing during the game over screen.
			if (!gameOver) {
				pause = !pause;
			}
			break;
		/*
		case 173: // minus
			enemies.splice(enemies.length - 1, 1);
			break;
		*/
		}
		input.any = 1;
	}
);

document.addEventListener(
	"keyup",
	function(event) {
		switch (event.keyCode) {
		case 13:
			input.enter = 0;
			break;
		case 37:
		case 65:
			input.left = 0;
			break;
		case 39:
		case 68:
			input.right = 0;
			break;
		case 16:
		case 17:
		case 32:
			input.fire = 0;
			break;
		}
		input.any = 0;
	}
);

function drawDebug() {
	let debug = [];
	debug.push({name: "Frame rate", value: secondsElapsed.toFixed(2)});
	debug.push({name: "Enemy row index", value: swarm.rowIndex});
	debug.push({name: "Enemy number", value: enemies.length});
	debug.push({name: "Enemy direction", value: swarm.direction});
	debug.push({name: "Enemy downward movement", value: swarm.down});
	debug.push({name: "Enemy cycle in ms", value: (swarm.cycle * 1000).toFixed(2)});
	debug.push({name: "Enemy cycle in seconds elapsed", value: swarm.frame.toFixed(2)});
	debug.push({name: "Enemy velocity X", value: swarm.velocityX.toFixed(2)});
	debug.push({name: "Enemy velocity Y", value: swarm.velocityY.toFixed(2)});
	ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
	ctx.font = "bold 10pt monospace";
	let x = 20;
	let y = 60;
	for (let el of debug) {
		ctx.fillText(el.name + ": " + String(el.value), x, y);
		y += 20;
	}
}

function drawStats() {
	let yOffset = 10;
	let xOffset = 10;
	drawString("SHIELD", xOffset, yOffset);
	xOffset = 105;
	drawString("SCORE", xOffset, yOffset);
	yOffset = 25;
	drawString(String(score).padStart(5, "0"), xOffset, yOffset);
	ctxText.fillStyle = "MediumSeaGreen";
	xOffset = 10;
	yOffset = 27;
	ctxText.clearRect(xOffset, yOffset, xOffset * 5, 8);
	for (let i = 0; i < player.health; ++i) {
		ctxText.fillRect(
			xOffset + (i * xOffset),
			yOffset,
			8, 8);
	}
}

function showGameOver() {
	let string = "GAME OVER";
	let x = canvasText.width * 0.5;
	let y = canvasText.height * 0.5;
	let xOffset = Math.round(string.length * 0.5) * charWidth * 2;
	let yOffset = Math.round(charHeight * 2 * 0.5);
	drawString(string, x - xOffset, y - yOffset, 2);
	let r = 16 + (gameOverCounter * 30);
	let g = 16 - (gameOverCounter * 10);
	let b = 32 - (gameOverCounter * 10);
	for (let y = 0; y < screenHeight; ++y) {
		let a = y / screenHeight;
		ctxBg.fillStyle = `rgb(${a * r}, ${a * g}, ${a * b})`;
		ctxBg.fillRect(0, y, screenWidth, 1);
	}
	gameOverCounter += dtFrame;
	if (gameOverCounter > 4) {
		clearScreen();
		gameOver = false;
		playingGame = false;
		gameOverCounter = 0;
		showReadyScreen = true;
	}
}

function showReady() {
	clearScreen();
	ctx.fillStyle = "black";
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	readyScreenCounter += dtFrame;
	let string = "READY";
	let x = canvasText.width * 0.5;
	let y = canvasText.height * 0.5;
	let xOffset = Math.round(string.length * 0.5) * charWidth * 2;
	let yOffset = Math.round(charHeight * 2 * 0.5);
	if (readyScreenCounter < 2) {
		drawString(string, x - xOffset, y - yOffset, 2);
	} else {
		clearScreen();
		readyScreenCounter = 0;
		showReadyScreen = false;
		startGame = true;
	}
}

function showTitle() {
	clearScreen();
	ctx.fillStyle = "black";
	ctx.fillRect(0, 0, canvasText.width, canvasText.height);
	if (input.enter == 1) {
		showTitleScreen = false;
		showReadyScreen = true;
	} else {
		let string = "INVASION";
		let textScale = 2;
		let x = canvasText.width * 0.5;
		let y = canvasText.height * 0.5;
		let xOffset = (string.length * 0.5) * charWidth * textScale;
		let yOffset = charHeight * textScale * 0.5;
		drawString(string, x - xOffset, y - yOffset, textScale);
		let titleImage = new Image();
		titleImage.src = "assets/horse.png";
		let titleImageWidth = 32;
		let titleImageHeight = 32;
		let imageScale = 12;
		ctx.drawImage(
			titleImage,
			screenWidth * 0.5 - (titleImageWidth * imageScale * 0.5),
			screenHeight * 0.5 - (titleImageHeight * imageScale * 0.5),
			titleImageWidth * imageScale, titleImageHeight * imageScale);
	}
}

function drawString(
	string,
	x, y,
	textScale = 1) {
	for (let i = 0; i < string.length; ++i) {
		let ord = string[i].charCodeAt();
		drawChar(ord - 33, 0, x, y, textScale);
		x += charWidth * textScale;
	}
}

function drawChar(
	sx, sy,
	dx, dy,
	textScale) {
	let chars = new Image();
	chars.src = "assets/chars.png";
	ctxText.clearRect(
		dx, dy,
		charWidth * textScale, charHeight * textScale);
	ctxText.drawImage(
		chars,
		(sx * charWidth) + 2, sy * charHeight,
		charWidth, charHeight,
		dx, dy,
		charWidth * textScale, charHeight * textScale);
}

function initText() {
	canvasText = document.createElement("canvas");
	canvasText.width = screenWidth;
	canvasText.height = screenHeight;
	ctxText = canvasText.getContext("2d");
	ctxText.imageSmoothingEnabled = false;
}


function initBackground() {
	canvasBg = document.createElement("canvas");
	canvasBg.width = screenWidth;
	canvasBg.height = screenHeight;
	ctxBg = canvasBg.getContext("2d");
	ctxBg.imageSmoothingEnabled = false;
}

function drawBackground() {
	for (let y = 0; y < screenHeight; ++y) {
		let a = y / screenHeight;
		ctxBg.fillStyle = `rgb(${a * 16}, ${a * 16}, ${a * 32})`;
		ctxBg.fillRect(0, y, screenWidth, 1);
	}
}

function initStars() {
	stars = [];
	let pixelsPerRegion = 40;
	let nRegionsX = canvas.width / pixelsPerRegion;
	let nRegionsY = canvas.height / pixelsPerRegion;
	for (let regionY = 0; regionY < nRegionsY; ++regionY) {
		for (let regionX = 0; regionX < nRegionsX; ++regionX) {
			let x = (regionX * pixelsPerRegion) + (Math.random() * pixelsPerRegion);
			let y = (regionY * pixelsPerRegion) + (Math.random() * pixelsPerRegion);
			stars.push({x: x, y: y});
		}
	}
}

function updateStars() {
	for (let star of stars) {
		star.y -= 0.5;
		if (star.y < 0) {
			star.y = screenHeight;
		}
	}
}

function drawStars() {
	let n = 0;
	for (let star of stars) {
		ctx.fillStyle = (n = !n) ? "deeppink" : "lightseagreen";
		ctx.fillRect(Math.round(star.x), Math.round(star.y), 2, 2);
	}
}

function initBlast(
	x, y,
	angle = 0,
	range = 2 * Math.PI,
	power = 500,
	nRects = 30,
	fade = 2.5,
	sprite = null) {
	for (let i = 0; i < nRects; ++i) {
		let vx = Math.cos(Math.random() * range + angle) * power;
		let vy = Math.sin(Math.random() * range + angle) * power;
		blasts.push({x: x, y: y, vx: vx, vy: vy, t: 0.0, alpha: 1.0, fade: fade, sprite: sprite});
	}
}

function updateBlasts() {
	let newBlasts = [];
	for (let blast of blasts) {
		blast.t += dtFrame;
		blast.x += blast.vx * blast.t * dtFrame + (blast.sprite ? blast.sprite.velocityX * dtFrame : 0);
		blast.y -= blast.vy * blast.t * dtFrame;
		blast.alpha -= dtFrame * blast.fade;
		if (blast.t < 0.5) {
			newBlasts.push(blast);
		}
	}
	blasts = newBlasts;
}

function drawBlasts() {
	let n = false;
	for (let blast of blasts) {
		let green = (n = !n) ? 165 : 69; // for "Orange" or "OrangeRed"
		ctx.fillStyle = `rgba(255, ${green}, 0, ${blast.alpha})`;
		ctx.fillRect(Math.round(blast.x), Math.round(blast.y), 7, 7);
	}
}

function initLaser() {
	laser = {};
	laser.width = 5;
	laser.height = 15;
	laser.x = player.x - 2;
	laser.y = player.y - 8;
	laser.velocityY = -500;
	laser.color = "deepskyblue";
	laser.image = new Image();
	laser.image.src = "assets/laser.png";
}

function updateLaser() {
	laser.y += laser.velocityY * dtFrame;
	if (laser.y < 0) {
		laser = null;
	}
}

function initBomb(
	enemy) {
	let bombPath = {
		x: enemy.x,
		y: enemy.y + ((screenHeight - enemy.y) * 0.5) + enemy.width,
		width: enemy.width * 0.5,
		height: screenHeight - enemy.y
	};
	if (bombCollide(bombPath) && !bomb) {
		bomb = {};
		bomb.x = enemy.x;
		bomb.y = enemy.y + (enemy.width * 0.5);
		bomb.width = 10;
		bomb.height = 10;
		bomb.velocityY = 0;
		bombInterval = 1;
	}
}

function bombCollide(
	path) {
	for (let e of enemies) {
		if (collide(path, e)) {
			return false;
		}
	}
	return (collide(path, player));
}

function updateBomb() {
	let accelY = 400;
	accelY += bomb.velocityY;
	bomb.velocityY += accelY * dtFrame;
	bomb.y += Math.round(bomb.velocityY * dtFrame);
	let x = bomb.x - (bomb.width * 0.5 - 1);
	let y = bomb.y;
	let angle = 0;
	let range = 2 * Math.PI;
	let power = 200;
	let nRects = 4;
	let fade = 2.5;
	initBlast(x, y, angle, range, power, nRects, fade);
	if (bomb.y > screenHeight) {
		bomb = null;
	}
}

function drawSprite(
	sprite) {
	if (sprite.image) {
		let x = sprite.x - (sprite.width * 0.5);
		let y = sprite.y - (sprite.width * 0.5);
		ctx.drawImage(sprite.image, x, y);
	} else {
		ctx.fillStyle = sprite.color;
		ctx.fillRect(
			sprite.x - (sprite.width * 0.5),
			sprite.y - (sprite.height * 0.5),
			sprite.width,
			sprite.height);
	}
}

function initCanvas() {
	canvas = document.getElementById("main");
	canvas.width = screenWidth;
	canvas.height = screenHeight;
	ctx = canvas.getContext("2d");
	canvasScale = Math.floor(window.innerHeight / canvas.height);
	canvas.width *= canvasScale;
	canvas.height *= canvasScale;
	ctx.scale(canvasScale, canvasScale);
	ctx.imageSmoothingEnabled = false;
}

function clearScreen() {
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	ctxText.clearRect(0, 0, canvasText.width, canvasText.height);
}

function drawScreen() {
	if (showTitleScreen) {
		showTitle();
	} else if (showReadyScreen) {
		showReady();
	} else {
		ctx.drawImage(canvasBg, 0, 0, screenWidth, screenHeight);
		if (stars.length > 0) {
			drawStars();
		}
		if (!player.dead) {
			drawSprite(player);
		}
		for (let e of enemies) {
			drawSprite(e);
		}
		if (laser) {
			drawSprite(laser);
		}
		if (blasts.length > 0) {
			drawBlasts();
		}
		if (showDebug) {
			drawDebug();
		}
		if (gameOver) {
			showGameOver();
		}
		drawStats();
	}
	ctx.drawImage(canvasText, 0, 0, screenWidth, screenHeight);
}

function collide(
	sprite1,
	sprite2) {
	let box1 = {};
	let box2 = {};
	let minkDiff = {};
	// Coordinate difference between sprites
	let diffX = sprite2.x - sprite1.x;
	let diffY = sprite2.y - sprite1.y;
	// Top, bottom, left, right of sprite1
	box1.top = -sprite1.height * 0.5;
	box1.bottom = sprite1.height * 0.5;
	box1.left = -sprite1.width * 0.5;
	box1.right = sprite1.width * 0.5;
	// Top, bottom, left, right of sprite2
	box2.top = diffY - sprite2.height * 0.5;
	box2.bottom = diffY + sprite2.height * 0.5;
	box2.left = diffX - sprite2.width * 0.5;
	box2.right = diffX + sprite2.width * 0.5;
	// Minkowski difference of box2 and the comp
	minkDiff.top = box2.top - box1.bottom;
	minkDiff.bottom = box2.bottom - box1.top;
	minkDiff.left = box2.left - box1.right;
	minkDiff.right = box2.right - box1.left;
	// Does the Minkowski shape overlap the point of origin?
	return (
		minkDiff.left <= 0 &&
		minkDiff.right >= 0 &&
		minkDiff.top <= 0 &&
		minkDiff.bottom >= 0);
}

function measureSwarm() {
	let minX = screenWidth;
	let maxX = 0;
	let minY = screenHeight;
	let maxY = 0;
	for (let e of enemies) {
		// Find the swarm width and height.
		if (e.x < minX) {
			minX = e.x - (e.width * 0.5);
		}
		if (e.x > maxX) {
			maxX = e.x + (e.width * 0.5);
		}
		if (e.y < minY) {
			minY = e.y - (e.height * 0.5);
		}
		if (e.y > maxY) {
			maxY = e.y + (e.height * 0.5);
		}
	}
	swarm.x = (maxX + minX) * 0.5;
	swarm.y = (maxY + minY) * 0.5;
	swarm.width = maxX - minX;
	swarm.height = maxY - minY;
}

function findNextRow() {
	let nRows = 5;
	swarm.rowRestart = 0;
	while (--nRows >= 0) {
		--swarm.rowIndex;
		if (swarm.rowIndex < 0) {
			swarm.rowRestart = 1;
			swarm.rowIndex = swarm.initRows - 1;
		}
		for (let e of enemies) {
			if (e.row == swarm.rowIndex) {
				nRows = 0;
				break;
			}
		}
	}
}

function initEnemies() {
	enemies = [];
	let ybuffer = 30;
	for (let row = 0; row < swarm.initRows; ++row) {
		for (let col = 0; col < swarm.initCols; ++col) {
			let enemy = {};
			enemy.width = 32;
			enemy.height = 32;
			enemy.x = col * 48 + enemy.width;
			enemy.y = row * 48 + enemy.height + ybuffer;
			enemy.row = row;
			enemy.col = col;
			enemy.color = "darkred";
			enemy.image = new Image;
			if (row == 0) {
				enemy.image.src = "assets/horse.png";
			} else if (row == 1) {
				enemy.image.src = "assets/pig.png";
			} else if (row == 2) {
				enemy.image.src = "assets/deer.png";
			} else if (row == 3) {
				enemy.image.src = "assets/wolf.png";
			} else if (row == 4) {
				enemy.image.src = "assets/bird.png";
			}
			enemies.push(enemy);
		}
	}
}

function updateEnemies() {
	swarm.movementPhase = 0.85;
	swarm.accelPhase = swarm.movementPhase * 0.5;
	swarm.restPhase = 1.0 - swarm.movementPhase;
	if (swarm.frame == 0) {
		if (swarm.rowRestart) {
			// The duration of each cycle shortens as the enemies diminish. Add
			// a bias so we don't hit zero.
			let cycleMax = 1.4;
			let cycleBias = 0.2;
			swarm.cycle = cycleMax * (enemies.length / swarm.initSize) + cycleBias;
			// Solve for the acceleration required to travel half of a constant
			// distance per cycle. The other half is a symmetrical
			// deceleration.  Use the equation a = 2s/t^2 - 2u/t, where s is 16
			// pixels, t is the acceleration portion of the cycle, and u, the
			// initial velocity, is zero.
			let accel = (2 * 24) / Math.pow(swarm.cycle * swarm.accelPhase, 2);
			if (swarm.down) {
				swarm.accelY = swarm.down * accel;
			} else {
				swarm.accelX = swarm.direction * accel;
			}
		}
		measureSwarm();
		let bottomWall = {
			x: screenWidth * 0.5, y: screenHeight,
			width: screenWidth, height: 64
		};
		if (collide(swarm, bottomWall)) {
			score = 0;
			gameOver = true;
		}
		swarm.velocityX = 0;
		swarm.velocityY = 0;
	} else if (swarm.frame >= swarm.cycle * swarm.restPhase) {
		if (swarm.frame < swarm.cycle * (swarm.restPhase + swarm.accelPhase)) {
			swarm.velocityX += swarm.accelX * dtFrame;
			swarm.velocityY += swarm.accelY * dtFrame;
		} else {
			swarm.velocityX += -swarm.accelX * dtFrame;
			swarm.velocityY += -swarm.accelY * dtFrame;
		}
	}
	let newEnemies = [];
	for (let e of enemies) {
		if (e.row == swarm.rowIndex) {
			if (swarm.down) {
				e.y += swarm.velocityY * dtFrame;
			} else {
				e.x += swarm.velocityX * dtFrame;
			}
		}
		if (!gameOver && bombInterval == 0) {
			initBomb(e);
		}
		if (laser && collide(e, laser)) {
			laser = null;
			initBlast(e.x, e.y);
			score += 10;
			drawStats();
		} else {
			newEnemies.push(e);
		}
	}
	enemies = newEnemies;
	swarm.frame += dtFrame;
	if (swarm.frame >= swarm.cycle) {
		swarm.frame = 0;
		findNextRow();
		if (swarm.rowRestart) {
			measureSwarm();
			// Check collision ahead of movement
			let leftWall = {
				x: 0, y: screenHeight * 0.5,
				width: 96, height: screenHeight
			};
			let rightWall = {
				x: screenWidth, y: screenHeight * 0.5,
				width: 96, height: screenHeight
			};
			if (collide(swarm, leftWall) && !swarm.down) {
				swarm.down = 1;
				swarm.direction = 1;
			} else if (collide(swarm, rightWall) && !swarm.down) {
				swarm.down = 1;
				swarm.direction = -1;
			} else {
				swarm.down = 0;
			}
		}
	}
}

function initPlayer() {
	player = {};
	player.width = 32;
	player.height = 32;
	player.velocityX = 0;
	player.x = (screenWidth * 0.5);
	player.y = screenHeight - (player.height * 2);
	player.image = new Image();
	player.image.src = "assets/player.png";
	player.color = "blue";
	player.health = 5;
	player.dead = false;
}

function updatePlayer() {
	let accelX = 0;
	if (input.left) {
		accelX = -1200;
	}
	if (input.right) {
		accelX = 1200;
	}
	// Can only fire one laser beam at a time. Also, in the case where the
	// player hasn't been destroyed, but the game is over because the swarm has
	// reached the bottom of the screen, we don't want the player to be able to
	// continue firing.
	if (input.fire && !laser && !gameOver) {
		initLaser();
		input.fire = 0;
	}
	accelX += player.velocityX * -10;
	let vx = player.velocityX + (accelX * dtFrame);
	let tempPlayer = {
		x: player.x + (vx * dtFrame),
		y: player.y,
		width: player.width,
		height: player.height};
	let leftWall = {
		x: 0, y: screenHeight * 0.5,
		width: 32, height: screenHeight
	};
	let rightWall = {
		x: screenWidth, y: screenHeight * 0.5,
		width: 32, height: screenHeight
	};
	if (!collide(tempPlayer, leftWall ) && !collide(tempPlayer, rightWall)) {
		player.x = tempPlayer.x;
		player.velocityX = vx;
	} else {
		player.velocityX = 0;
	}
	let angle = (4 * Math.PI) / 3;
	let range = Math.PI / 3;
	let power = 300;
	let nRects = 2;
	let fade = 2.5;
	let x = player.x - 3 - (player.velocityX * dtFrame);
	let y = player.y + (player.width * 0.5 - 3);
	initBlast(x, y, angle, range, power, nRects, fade, player);
	if (bomb && collide(player, bomb)) {
		bomb = null;
		initBlast(player.x, player.y);
		--player.health
		drawStats();
		if (player.health == 0) {
			player.dead = true;
			gameOver = true;
			score = 0;
		}
	}
}

function initSwarm() {
	swarm = {};
	swarm.initRows = 5;
	swarm.initCols = 9;
	swarm.initSize = swarm.initRows * swarm.initCols;
	swarm.frame = 0;
	swarm.direction = 1;
	swarm.down = 1;
	swarm.rowIndex = swarm.initRows - 1;
	swarm.cycle = 0;
	swarm.accelX = 0;
	swarm.accelY = 0;
	swarm.velocityX = 0;
	swarm.velocityY = 0;
}

function mainLoop() {
	requestAnimationFrame(mainLoop);
	timeEnd = Date.now();
	timeDiff = timeEnd - timeStart;
	if (timeDiff > targetTime) {
		if (startGame) {
			input = {left: 0, right: 0, fire: 0};
			startGame = false;
			bombInterval = 1;
			blasts = [];
			initPlayer();
			initSwarm();
			initStars();
			initEnemies();
			drawBackground();
			playingGame = true;
			pause = false;
		}
		timeStart = timeEnd - (timeDiff % targetTime);
		secondsElapsed = timeDiff - (timeDiff % targetTime);
		if (playingGame && !pause) {
			if (!player.dead) {
				updatePlayer();
			}
			if (enemies.length > 0) {
				updateEnemies();
			} else {
				if (winInterval > 2) {
					winInterval = 0;
					clearScreen();
					playingGame = false;
					showReadyScreen = true;
				} else {
					winInterval += dtFrame;
				}
			}
			if (laser) {
				updateLaser();
			}
			if (bomb) {
				updateBomb();
			}
			if (bombInterval > 0) {
				bombInterval -= dtFrame;
			} else {
				bombInterval = 0;
			}
			if (blasts.length > 0) {
				updateBlasts();
			}
			if (stars.length > 0) {
				updateStars();
			}
		}
		drawScreen();
	}
}

function main() {
	initCanvas();
	initBackground();
	initText();
	showTitleScreen = true;
	timeStart = Date.now();
	requestAnimationFrame(mainLoop);
}

main();
