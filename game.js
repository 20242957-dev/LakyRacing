const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const mapCanvas = document.getElementById("mapCanvas");
const mapCtx = mapCanvas.getContext("2d");

const menu = document.getElementById("menu");
const gameUI = document.getElementById("gameUI");
const finish = document.getElementById("finish");

const startButton = document.getElementById("startButton");
const restartButton = document.getElementById("restartButton");

const lapText = document.getElementById("lap");
const positionText = document.getElementById("position");
const timeText = document.getElementById("time");
const speedText = document.getElementById("speed");

const countdown = document.getElementById("countdown");

const finishTime = document.getElementById("finishTime");
const finishPosition = document.getElementById("finishPosition");

let width = 0;
let height = 0;

let running = false;
let raceStarted = false;
let raceFinished = false;

let raceStartTime = 0;
let elapsedTime = 0;

let lastTime = 0;

const keys = {};

window.addEventListener("keydown", event => {

    keys[event.key.toLowerCase()] = true;

    if (
        ["arrowup", "arrowdown", "arrowleft", "arrowright", " "]
        .includes(event.key.toLowerCase())
    ) {
        event.preventDefault();
    }

});

window.addEventListener("keyup", event => {
    keys[event.key.toLowerCase()] = false;
});


/* =========================
   RESIZE
========================= */

function resize() {

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    width = window.innerWidth;
    height = window.innerHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;

    canvas.style.width = width + "px";
    canvas.style.height = height + "px";

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    mapCanvas.width = 360;
    mapCanvas.height = 240;
}

window.addEventListener("resize", resize);
resize();


/* =========================
   TRACK
========================= */

const track = [
    { x: 0.18, y: 0.30 },
    { x: 0.28, y: 0.18 },
    { x: 0.50, y: 0.15 },
    { x: 0.70, y: 0.18 },
    { x: 0.82, y: 0.30 },
    { x: 0.85, y: 0.52 },
    { x: 0.76, y: 0.68 },
    { x: 0.58, y: 0.76 },
    { x: 0.37, y: 0.78 },
    { x: 0.20, y: 0.67 },
    { x: 0.14, y: 0.50 }
];

const trackWidth = 120;


/* =========================
   PLAYER
========================= */

const player = {
    x: 0,
    y: 0,

    angle: 0,

    speed: 0,

    width: 28,
    height: 48,

    maxSpeed: 420,
    acceleration: 280,
    braking: 450,

    friction: 130,

    turnSpeed: 2.8,

    lap: 1,

    checkpoint: 0,

    lastCheckpoint: 0
};


/* =========================
   INIT PLAYER
========================= */

function resetPlayer() {

    const start = getTrackPoint(0);
    const next = getTrackPoint(1);

    player.x = start.x;
    player.y = start.y;

    player.angle = Math.atan2(
        next.y - start.y,
        next.x - start.x
    );

    player.speed = 0;

    player.lap = 1;
    player.checkpoint = 0;
    player.lastCheckpoint = 0;

}


/* =========================
   TRACK POINT
========================= */

function getTrackPoint(index) {

    const p = track[index % track.length];

    return {
        x: p.x * width,
        y: p.y * height
    };

}


/* =========================
   DISTANCE
========================= */

function distance(a, b) {

    return Math.sqrt(
        Math.pow(a.x - b.x, 2) +
        Math.pow(a.y - b.y, 2)
    );

}


/* =========================
   CLOSEST TRACK POINT
========================= */

function getClosestTrackPoint(x, y) {

    let closest = 0;
    let minDistance = Infinity;

    for (let i = 0; i < track.length; i++) {

        const p = getTrackPoint(i);

        const d = distance(
            { x, y },
            p
        );

        if (d < minDistance) {

            minDistance = d;
            closest = i;

        }

    }

    return {
        index: closest,
        distance: minDistance
    };

}


/* =========================
   START GAME
========================= */

startButton.addEventListener("click", startGame);

restartButton.addEventListener("click", () => {

    finish.classList.add("hidden");

    startGame();

});


function startGame() {

    menu.classList.add("hidden");
    gameUI.classList.remove("hidden");

    raceFinished = false;
    raceStarted = false;

    elapsedTime = 0;

    resetPlayer();

    countdown.textContent = "3";

    setTimeout(() => {
        countdown.textContent = "2";
    }, 700);

    setTimeout(() => {
        countdown.textContent = "1";
    }, 1400);

    setTimeout(() => {

        countdown.textContent = "GO!";

        raceStarted = true;
        raceStartTime = performance.now();

        setTimeout(() => {
            countdown.textContent = "";
        }, 600);

    }, 2100);

    running = true;

    lastTime = performance.now();

    requestAnimationFrame(gameLoop);

}


/* =========================
   UPDATE
========================= */

function update(delta) {

    if (!raceStarted || raceFinished) {
        return;
    }

    const forward =
        keys["w"] ||
        keys["arrowup"];

    const backward =
        keys["s"] ||
        keys["arrowdown"];

    const left =
        keys["a"] ||
        keys["arrowleft"];

    const right =
        keys["d"] ||
        keys["arrowright"];

    const drifting = keys[" "];


    /* ACCELERATION */

    if (forward) {

        player.speed +=
            player.acceleration * delta;

    }

    if (backward) {

        player.speed -=
            player.braking * delta;

    }


    /* FRICTION */

    if (!forward && !backward) {

        if (player.speed > 0) {

            player.speed -=
                player.friction * delta;

            if (player.speed < 0) {
                player.speed = 0;
            }

        } else if (player.speed < 0) {

            player.speed +=
                player.friction * delta;

            if (player.speed > 0) {
                player.speed = 0;
            }

        }

    }


    /* DRIFT */

    let maxSpeed = player.maxSpeed;

    if (drifting) {

        maxSpeed *= 0.82;

    }

    player.speed = Math.max(
        -120,
        Math.min(
            maxSpeed,
            player.speed
        )
    );


    /* TURN */

    if (Math.abs(player.speed) > 10) {

        const direction =
            player.speed >= 0 ? 1 : -1;

        const speedFactor =
            Math.min(
                Math.abs(player.speed) / 220,
                1
            );

        let steering =
            player.turnSpeed *
            speedFactor *
            delta;

        if (drifting) {
            steering *= 1.35;
        }

        if (left) {
            player.angle -= steering * direction;
        }

        if (right) {
            player.angle += steering * direction;
        }

    }


    /* MOVE */

    player.x +=
        Math.cos(player.angle) *
        player.speed *
        delta;

    player.y +=
        Math.sin(player.angle) *
        player.speed *
        delta;


    /* TRACK LIMIT */

    const closest =
        getClosestTrackPoint(
            player.x,
            player.y
        );

    if (closest.distance > trackWidth / 2) {

        player.speed *= 0.92;

    }


    /* WRAP SCREEN */

    if (player.x < -30) {
        player.x = width + 30;
    }

    if (player.x > width + 30) {
        player.x = -30;
    }

    if (player.y < -30) {
        player.y = height + 30;
    }

    if (player.y > height + 30) {
        player.y = -30;
    }


    /* CHECKPOINTS */

    checkProgress();

}


/* =========================
   LAP SYSTEM
========================= */

function checkProgress() {

    const closest =
        getClosestTrackPoint(
            player.x,
            player.y
        );

    let index = closest.index;

    const total = track.length;

    const expected =
        player.checkpoint;

    const difference =
        (index - expected + total) % total;

    if (
        difference > 0 &&
        difference <= 2
    ) {

        player.checkpoint =
            (index + 1) % total;

    }


    /*
       Para completar una vuelta:
       el jugador debe pasar por todos
       los puntos y regresar al inicio.
    */

    if (
        player.checkpoint === 0 &&
        player.lastCheckpoint === total - 1
    ) {

        player.lap++;

        player.lastCheckpoint = 0;

        if (player.lap > 3) {

            finishRace();

        }

    }

    if (
        player.checkpoint !== 0
    ) {

        player.lastCheckpoint =
            player.checkpoint - 1;

    }

}


/* =========================
   DRAW TRACK
========================= */

function drawTrack() {

    ctx.clearRect(
        0,
        0,
        width,
        height
    );


    /* GRASS */

    ctx.fillStyle = "#39733c";

    ctx.fillRect(
        0,
        0,
        width,
        height
    );


    /* GRASS DETAILS */

    ctx.fillStyle =
        "rgba(255,255,255,0.025)";

    for (let x = 0; x < width; x += 40) {

        for (let y = 0; y < height; y += 40) {

            ctx.fillRect(
                x,
                y,
                2,
                2
            );

        }

    }


    /* ROAD */

    drawTrackPath(
        trackWidth + 18,
        "#d5d5d5"
    );

    drawTrackPath(
        trackWidth,
        "#303030"
    );


    /* ROAD STRIPES */

    ctx.lineWidth = 3;

    ctx.strokeStyle =
        "rgba(255,255,255,0.35)";

    ctx.setLineDash([20, 20]);

    drawTrackPath(
        trackWidth - 12,
        null,
        true
    );

    ctx.setLineDash([]);


    /* START LINE */

    const start = getTrackPoint(0);
    const next = getTrackPoint(1);

    const angle =
        Math.atan2(
            next.y - start.y,
            next.x - start.x
        ) + Math.PI / 2;

    ctx.save();

    ctx.translate(
        start.x,
        start.y
    );

    ctx.rotate(angle);

    const squares = 8;
    const size = trackWidth / squares;

    for (let i = 0; i < squares; i++) {

        ctx.fillStyle =
            i % 2 === 0
                ? "#ffffff"
                : "#111111";

        ctx.fillRect(
            -trackWidth / 2 +
            i * size,
            -5,
            size,
            10
        );

    }

    ctx.restore();

}


/* =========================
   TRACK PATH
========================= */

function drawTrackPath(
    lineWidth,
    color,
    dashed = false
) {

    ctx.beginPath();

    track.forEach((point, index) => {

        const p = getTrackPoint(index);

        if (index === 0) {

            ctx.moveTo(
                p.x,
                p.y
            );

        } else {

            ctx.lineTo(
                p.x,
                p.y
            );

        }

    });

    const first = getTrackPoint(0);

    ctx.lineTo(
        first.x,
        first.y
    );

    if (color) {

        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = color;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";

        ctx.stroke();

    } else {

        ctx.lineWidth = lineWidth;
        ctx.stroke();

    }

}


/* =========================
   DRAW PLAYER
========================= */

function drawPlayer() {

    ctx.save();

    ctx.translate(
        player.x,
        player.y
    );

    ctx.rotate(
        player.angle + Math.PI / 2
    );


    /* SHADOW */

    ctx.fillStyle =
        "rgba(0,0,0,0.35)";

    ctx.beginPath();

    ctx.roundRect(
        -player.width / 2 + 4,
        -player.height / 2 + 5,
        player.width,
        player.height,
        7
    );

    ctx.fill();


    /* CAR BODY */

    ctx.fillStyle = "#e53935";

    ctx.beginPath();

    ctx.roundRect(
        -player.width / 2,
        -player.height / 2,
        player.width,
        player.height,
        7
    );

    ctx.fill();


    /* WINDOWS */

    ctx.fillStyle = "#171717";

    ctx.beginPath();

    ctx.roundRect(
        -9,
        -14,
        18,
        13,
        4
    );

    ctx.fill();


    /* FRONT WINDOW */

    ctx.fillStyle = "#555";

    ctx.beginPath();

    ctx.roundRect(
        -8,
        -12,
        16,
        6,
        2
    );

    ctx.fill();


    /* HEADLIGHTS */

    ctx.fillStyle = "#fff";

    ctx.fillRect(
        -9,
        -22,
        6,
        4
    );

    ctx.fillRect(
        3,
        -22,
        6,
        4
    );


    /* REAR LIGHTS */

    ctx.fillStyle = "#8b0000";

    ctx.fillRect(
        -9,
        18,
        6,
        4
    );

    ctx.fillRect(
        3,
        18,
        6,
        4
    );


    /* WHEELS */

    ctx.fillStyle = "#111";

    ctx.fillRect(
        -17,
        -13,
        5,
        13
    );

    ctx.fillRect(
        12,
        -13,
        5,
        13
    );

    ctx.fillRect(
        -17,
        0,
        5,
        13
    );

    ctx.fillRect(
        12,
        0,
        5,
        13
    );


    ctx.restore();

}


/* =========================
   MINIMAP
========================= */

function drawMinimap() {

    const w = mapCanvas.width;
    const h = mapCanvas.height;

    mapCtx.clearRect(
        0,
        0,
        w,
        h
    );


    mapCtx.fillStyle = "#39733c";

    mapCtx.fillRect(
        0,
        0,
        w,
        h
    );


    function drawMiniTrack(
        width,
        color
    ) {

        mapCtx.beginPath();

        track.forEach((point, index) => {

            const x = point.x * w;
            const y = point.y * h;

            if (index === 0) {

                mapCtx.moveTo(
                    x,
                    y
                );

            } else {

                mapCtx.lineTo(
                    x,
                    y
                );

            }

        });

        const first = track[0];

        mapCtx.lineTo(
            first.x * w,
            first.y * h
        );

        mapCtx.lineWidth = width;
        mapCtx.strokeStyle = color;
        mapCtx.lineJoin = "round";
        mapCtx.lineCap = "round";

        mapCtx.stroke();

    }


    drawMiniTrack(
        60,
        "#ccc"
    );

    drawMiniTrack(
        50,
        "#303030"
    );


    /* PLAYER */

    mapCtx.fillStyle = "#e53935";

    mapCtx.beginPath();

    mapCtx.arc(
        (player.x / width) * w,
        (player.y / height) * h,
        6,
        0,
        Math.PI * 2
    );

    mapCtx.fill();

}


/* =========================
   UI
========================= */

function updateUI() {

    lapText.textContent =
        Math.min(player.lap, 3) +
        " / 3";

    positionText.textContent =
        "1.º";

    const totalSeconds =
        elapsedTime / 1000;

    const minutes =
        Math.floor(totalSeconds / 60);

    const seconds =
        Math.floor(totalSeconds % 60);

    const milliseconds =
        Math.floor(elapsedTime % 1000);

    timeText.textContent =
        String(minutes).padStart(2, "0") +
        ":" +
        String(seconds).padStart(2, "0") +
        "." +
        String(milliseconds).padStart(3, "0");


    const kmh =
        Math.round(
            Math.abs(player.speed) * 0.35
        );

    speedText.textContent =
        kmh + " km/h";

}


/* =========================
   FINISH
========================= */

function finishRace() {

    raceFinished = true;

    const totalSeconds =
        elapsedTime / 1000;

    const minutes =
        Math.floor(totalSeconds / 60);

    const seconds =
        Math.floor(totalSeconds % 60);

    const milliseconds =
        Math.floor(elapsedTime % 1000);

    const formatted =
        String(minutes).padStart(2, "0") +
        ":" +
        String(seconds).padStart(2, "0") +
        "." +
        String(milliseconds).padStart(3, "0");

    finishTime.textContent =
        "Tiempo: " + formatted;

    finishPosition.textContent =
        "Posición: 1.º";

    finish.classList.remove("hidden");

}


/* =========================
   GAME LOOP
========================= */

function gameLoop(currentTime) {

    if (!running) {
        return;
    }

    const delta =
        Math.min(
            (currentTime - lastTime) / 1000,
            0.05
        );

    lastTime = currentTime;


    if (raceStarted && !raceFinished) {

        elapsedTime =
            currentTime - raceStartTime;

        update(delta);

    }


    drawTrack();
    drawPlayer();
    drawMinimap();
    updateUI();


    requestAnimationFrame(gameLoop);

}
