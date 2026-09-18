/* =========================================================
   LAKY RACING
   WebRTC / PeerJS Multiplayer
========================================================= */


/* =========================================================
   DOM
========================================================= */

const menu = document.getElementById("menu");
const gameUI = document.getElementById("gameUI");

const createRoomButton =
    document.getElementById("createRoomButton");

const joinRoomButton =
    document.getElementById("joinRoomButton");

const copyRoomButton =
    document.getElementById("copyRoomButton");

const roomInput =
    document.getElementById("roomInput");

const roomInfo =
    document.getElementById("roomInfo");

const roomCodeElement =
    document.getElementById("roomCode");

const connectionStatus =
    document.getElementById("connectionStatus");

const playerNameInput =
    document.getElementById("playerName");

const canvas =
    document.getElementById("gameCanvas");

const ctx =
    canvas.getContext("2d");

const mapCanvas =
    document.getElementById("mapCanvas");

const mapCtx =
    mapCanvas.getContext("2d");

const lapElement =
    document.getElementById("lap");

const positionElement =
    document.getElementById("position");

const timeElement =
    document.getElementById("time");

const speedElement =
    document.getElementById("speed");

const countdownElement =
    document.getElementById("countdown");

const playersContainer =
    document.getElementById("playersContainer");

const finish =
    document.getElementById("finish");

const finishTime =
    document.getElementById("finishTime");

const finishPosition =
    document.getElementById("finishPosition");

const restartButton =
    document.getElementById("restartButton");


/* =========================================================
   CANVAS
========================================================= */

let width = window.innerWidth;
let height = window.innerHeight;

function resizeCanvas() {

    width = window.innerWidth;
    height = window.innerHeight;

    canvas.width = width;
    canvas.height = height;

    mapCanvas.width = 164;
    mapCanvas.height = 114;
}

window.addEventListener("resize", resizeCanvas);

resizeCanvas();


/* =========================================================
   PEERJS
========================================================= */

let peer = null;

let hostConnection = null;

const connections = new Map();

let isHost = false;

let myPeerId = "";

let roomCode = "";

let playerName = "Jugador";


/* =========================================================
   PLAYER
========================================================= */

const player = {

    id: "",

    name: "Jugador",

    x: 0,

    y: 0,

    angle: 0,

    speed: 0,

    lap: 1,

    checkpoint: 0,

    finished: false

};


/* =========================================================
   REMOTE PLAYERS
========================================================= */

const remotePlayers = new Map();


/* =========================================================
   TRACK
========================================================= */

const track = [

    { x: 0.15, y: 0.30 },

    { x: 0.30, y: 0.16 },

    { x: 0.55, y: 0.14 },

    { x: 0.78, y: 0.22 },

    { x: 0.86, y: 0.42 },

    { x: 0.78, y: 0.62 },

    { x: 0.58, y: 0.76 },

    { x: 0.32, y: 0.78 },

    { x: 0.14, y: 0.66 },

    { x: 0.10, y: 0.46 }

];


const TRACK_WIDTH = 130;


/* =========================================================
   GAME STATE
========================================================= */

let gameRunning = false;

let raceStarted = false;

let raceStartTime = 0;

let lastFrame = performance.now();

let totalLaps = 3;


/* =========================================================
   CONTROLS
========================================================= */

const keys = {};

window.addEventListener("keydown", event => {

    keys[event.key.toLowerCase()] = true;

    if (
        event.key === " " ||
        event.key.startsWith("Arrow")
    ) {
        event.preventDefault();
    }

});

window.addEventListener("keyup", event => {

    keys[event.key.toLowerCase()] = false;

});


/* =========================================================
   UTILS
========================================================= */

function randomCode(length = 6) {

    const chars =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let result = "";

    for (let i = 0; i < length; i++) {

        result +=
            chars[Math.floor(Math.random() * chars.length)];

    }

    return result;

}


function normalizeCode(code) {

    return code
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9_-]/g, "");

}


function setStatus(text) {

    connectionStatus.textContent = text;

}


function showGame() {

    menu.classList.add("hidden");

    gameUI.classList.remove("hidden");

}


function formatTime(ms) {

    const total =
        Math.max(0, ms);

    const minutes =
        Math.floor(total / 60000);

    const seconds =
        Math.floor((total % 60000) / 1000);

    const milliseconds =
        Math.floor(total % 1000);

    return (
        String(minutes).padStart(2, "0") +
        ":" +
        String(seconds).padStart(2, "0") +
        "." +
        String(milliseconds).padStart(3, "0")
    );

}


/* =========================================================
   PEER CREATION
========================================================= */

function createPeer(id) {

    return new Peer(id, {

        debug: 1,

        config: {

            iceServers: [

                {
                    urls:
                        "stun:stun.l.google.com:19302"
                }

            ]

        }

    });

}


/* =========================================================
   CREATE ROOM
========================================================= */

createRoomButton.addEventListener("click", () => {

    playerName =
        playerNameInput.value.trim() ||
        "Jugador";

    roomCode =
        randomCode(6);

    isHost = true;

    createRoomButton.disabled = true;

    joinRoomButton.disabled = true;

    roomCodeElement.textContent =
        roomCode;

    roomInfo.classList.remove("hidden");

    setStatus("Creando sala...");


    /*
       El código de sala también funciona
       como ID del host.
    */

    peer =
        createPeer("laky-" + roomCode);


    peer.on("open", id => {

        myPeerId = id;

        player.id = id;

        player.name = playerName;

        setStatus(
            "Sala creada. Esperando jugadores..."
        );

        startLocalGame();

    });


    peer.on("connection", connection => {

        setupHostConnection(connection);

    });


    peer.on("error", error => {

        console.error(error);

        setStatus(
            "Error: " + error.type
        );

        createRoomButton.disabled = false;

        joinRoomButton.disabled = false;

    });

});


/* =========================================================
   HOST CONNECTION
========================================================= */

function setupHostConnection(connection) {

    connection.on("open", () => {

        connections.set(
            connection.peer,
            connection
        );

        setStatus(
            "Jugador conectado"
        );


        connection.send({

            type: "welcome",

            id: player.id,

            host: true,

            players:
                getAllPlayers()

        });


        broadcastState();

    });


    connection.on("data", data => {

        handleNetworkData(
            data,
            connection
        );

    });


    connection.on("close", () => {

        connections.delete(
            connection.peer
        );

        remotePlayers.delete(
            connection.peer
        );

        updatePlayerList();

    });


    connection.on("error", error => {

        console.error(
            "Connection error:",
            error
        );

    });

}


/* =========================================================
   JOIN ROOM
========================================================= */

joinRoomButton.addEventListener("click", () => {

    const code =
        normalizeCode(roomInput.value);

    if (!code) {

        setStatus(
            "Escribe un código."
        );

        return;

    }


    playerName =
        playerNameInput.value.trim() ||
        "Jugador";


    roomCode = code;

    isHost = false;

    createRoomButton.disabled = true;

    joinRoomButton.disabled = true;

    setStatus(
        "Conectando a la sala..."
    );


    peer =
        createPeer();


    peer.on("open", id => {

        myPeerId = id;

        player.id = id;

        player.name = playerName;


        const hostId =
            "laky-" + roomCode;


        hostConnection =
            peer.connect(
                hostId,
                {
                    reliable: true
                }
            );


        hostConnection.on("open", () => {

            setStatus(
                "Conectado al host."
            );


            hostConnection.send({

                type: "join",

                id: player.id,

                name: player.name

            });


            startLocalGame();

        });


        hostConnection.on("data", data => {

            handleNetworkData(
                data,
                hostConnection
            );

        });


        hostConnection.on("close", () => {

            setStatus(
                "El host se desconectó."
            );

            stopGame();

        });


        hostConnection.on("error", error => {

            console.error(error);

            setStatus(
                "Error de conexión."
            );

        });

    });


    peer.on("error", error => {

        console.error(error);

        setStatus(
            "No se pudo encontrar la sala."
        );

        createRoomButton.disabled = false;

        joinRoomButton.disabled = false;

    });

});


/* =========================================================
   NETWORK DATA
========================================================= */

function handleNetworkData(data, connection) {

    if (!data || !data.type) {
        return;
    }


    /* =====================
       JOIN
    ===================== */

    if (data.type === "join") {

        if (!isHost) {
            return;
        }


        remotePlayers.set(
            data.id,
            {

                id: data.id,

                name:
                    data.name || "Jugador",

                x: 0,

                y: 0,

                angle: 0,

                speed: 0,

                lap: 1,

                checkpoint: 0,

                finished: false

            }
        );


        updatePlayerList();


        /*
           Mandamos la posición inicial
           a todos.
        */

        broadcastState();

        return;
    }


    /* =====================
       WELCOME
    ===================== */

    if (data.type === "welcome") {

        if (!isHost) {

            if (Array.isArray(data.players)) {

                data.players.forEach(p => {

                    if (p.id !== player.id) {

                        remotePlayers.set(
                            p.id,
                            p
                        );

                    }

                });

            }

            updatePlayerList();

        }

        return;
    }


    /* =====================
       STATE
    ===================== */

    if (data.type === "state") {

        if (data.player) {

            const p =
                data.player;

            if (p.id !== player.id) {

                remotePlayers.set(
                    p.id,
                    p
                );

                updatePlayerList();

            }

        }

        return;
    }


    /* =====================
       FULL STATE
    ===================== */

    if (data.type === "fullState") {

        if (Array.isArray(data.players)) {

            data.players.forEach(p => {

                if (p.id !== player.id) {

                    remotePlayers.set(
                        p.id,
                        p
                    );

                }

            });

            updatePlayerList();

        }

        return;
    }

}


/* =========================================================
   PLAYER DATA
========================================================= */

function getPlayerData() {

    return {

        id: player.id,

        name: player.name,

        x: player.x,

        y: player.y,

        angle: player.angle,

        speed: player.speed,

        lap: player.lap,

        checkpoint:
            player.checkpoint,

        finished:
            player.finished

    };

}


function getAllPlayers() {

    const list = [
        getPlayerData()
    ];

    remotePlayers.forEach(p => {

        list.push(p);

    });

    return list;

}


/* =========================================================
   SEND STATE
========================================================= */

let lastNetworkUpdate = 0;

function sendState() {

    const now =
        performance.now();


    /*
       20 actualizaciones por segundo.
    */

    if (now - lastNetworkUpdate < 50) {
        return;
    }

    lastNetworkUpdate = now;


    const packet = {

        type: "state",

        player:
            getPlayerData()

    };


    if (isHost) {

        connections.forEach(conn => {

            if (conn.open) {

                conn.send(packet);

            }

        });

    } else {

        if (
            hostConnection &&
            hostConnection.open
        ) {

            hostConnection.send(packet);

        }

    }

}


/* =========================================================
   BROADCAST
========================================================= */

function broadcastState() {

    if (!isHost) {
        return;
    }


    const packet = {

        type: "fullState",

        players:
            getAllPlayers()

    };


    connections.forEach(conn => {

        if (conn.open) {

            conn.send(packet);

        }

    });

}


/* =========================================================
   START GAME
========================================================= */

function startLocalGame() {

    showGame();

    resetPlayer();

    gameRunning = true;

    raceStarted = false;

    finish.classList.add("hidden");

    startCountdown();

}


/* =========================================================
   RESET PLAYER
========================================================= */

function resetPlayer() {

    player.x =
        width * 0.15;

    player.y =
        height * 0.30;

    player.angle =
        0;

    player.speed =
        0;

    player.lap =
        1;

    player.checkpoint =
        0;

    player.finished =
        false;

}


/* =========================================================
   COUNTDOWN
========================================================= */

function startCountdown() {

    let number = 3;

    countdownElement.textContent =
        number;


    const interval =
        setInterval(() => {

            number--;


            if (number > 0) {

                countdownElement.textContent =
                    number;

            }

            else if (number === 0) {

                countdownElement.textContent =
                    "¡YA!";

                raceStarted = true;

                raceStartTime =
                    performance.now();

            }

            else {

                clearInterval(interval);

                countdownElement.textContent =
                    "";

            }

        }, 1000);

}


/* =========================================================
   STOP GAME
========================================================= */

function stopGame() {

    gameRunning = false;

}


/* =========================================================
   PHYSICS
========================================================= */

function updatePlayer(dt) {

    if (!raceStarted || player.finished) {
        return;
    }


    const accelerate =
        keys["w"] ||
        keys["arrowup"];

    const brake =
        keys["s"] ||
        keys["arrowdown"];

    const left =
        keys["a"] ||
        keys["arrowleft"];

    const right =
        keys["d"] ||
        keys["arrowright"];

    const drift =
        keys[" "];


    /* =====================
       ACCELERATION
    ===================== */

    if (accelerate) {

        player.speed +=
            0.35 * dt * 60;

    }


    if (brake) {

        player.speed -=
            0.45 * dt * 60;

    }


    /* =====================
       FRICTION
    ===================== */

    if (!accelerate && !brake) {

        player.speed *=
            Math.pow(0.985, dt * 60);

    }


    /* =====================
       DRIFT
    ===================== */

    if (drift) {

        player.speed *=
            Math.pow(0.993, dt * 60);

    }


    /* =====================
       LIMIT
    ===================== */

    const maxSpeed =
        drift ? 9 : 8;


    player.speed =
        Math.max(
            -3,
            Math.min(
                maxSpeed,
                player.speed
            )
        );


    /* =====================
       STEERING
    ===================== */

    if (
        Math.abs(player.speed) > 0.1
    ) {

        const direction =
            player.speed >= 0
                ? 1
                : -1;


        if (left) {

            player.angle -=
                0.045 *
                direction *
                dt *
                60;

        }


        if (right) {

            player.angle +=
                0.045 *
                direction *
                dt *
                60;

        }

    }


    /* =====================
       MOVEMENT
    ===================== */

    player.x +=
        Math.cos(player.angle) *
        player.speed *
        dt *
        60;

    player.y +=
        Math.sin(player.angle) *
        player.speed *
        dt *
        60;


    /* =====================
       SCREEN WRAP
    ===================== */

    if (player.x < 0) {
        player.x = width;
    }

    if (player.x > width) {
        player.x = 0;
    }

    if (player.y < 0) {
        player.y = height;
    }

    if (player.y > height) {
        player.y = 0;
    }


    checkProgress();

}


/* =========================================================
   CHECKPOINTS
========================================================= */

function getTrackPosition(index) {

    const p =
        track[
            index %
            track.length
        ];

    return {

        x: p.x * width,

        y: p.y * height

    };

}


function distance(a, b) {

    return Math.hypot(
        a.x - b.x,
        a.y - b.y
    );

}


function checkProgress() {

    const nextIndex =
        (player.checkpoint + 1) %
        track.length;


    const next =
        getTrackPosition(
            nextIndex
        );


    const current = {

        x: player.x,

        y: player.y

    };


    /*
       Si estamos cerca del
       siguiente checkpoint.
    */

    if (
        distance(
            current,
            next
        ) < 110
    ) {

        player.checkpoint =
            nextIndex;


        /*
           Completamos vuelta cuando
           pasamos por el último checkpoint
           y regresamos al primero.
        */

        if (
            player.checkpoint === 0
        ) {

            player.lap++;


            if (
                player.lap > totalLaps
            ) {

                finishRace();

            }

        }

    }

}


/* =========================================================
   FINISH
========================================================= */

function finishRace() {

    player.finished = true;

    player.speed = 0;


    const elapsed =
        performance.now() -
        raceStartTime;


    finishTime.textContent =
        "Tiempo: " +
        formatTime(elapsed);


    finishPosition.textContent =
        "Posición: " +
        calculatePosition() +
        "º";


    finish.classList.remove(
        "hidden"
    );


    sendState();

}


/* =========================================================
   POSITION
========================================================= */

function calculatePosition() {

    let position = 1;


    remotePlayers.forEach(p => {

        if (
            p.lap > player.lap
        ) {

            position++;

        }

    });


    return position;

}


/* =========================================================
   DRAW TRACK
========================================================= */

function drawTrack() {

    if (track.length < 2) {
        return;
    }


    ctx.lineJoin =
        "round";

    ctx.lineCap =
        "round";


    /* GRASS */

    ctx.fillStyle =
        "#28752c";

    ctx.fillRect(
        0,
        0,
        width,
        height
    );


    /* ROAD */

    ctx.beginPath();

    const first =
        getTrackPosition(0);

    ctx.moveTo(
        first.x,
        first.y
    );


    for (let i = 1; i <= track.length; i++) {

        const point =
            getTrackPosition(i);

        ctx.lineTo(
            point.x,
            point.y
        );

    }

    ctx.closePath();


    ctx.strokeStyle =
        "#151515";

    ctx.lineWidth =
        TRACK_WIDTH + 35;

    ctx.stroke();


    ctx.strokeStyle =
        "#555";

    ctx.lineWidth =
        TRACK_WIDTH;

    ctx.stroke();


    /* ROAD CENTER */

    ctx.setLineDash([
        20,
        20
    ]);

    ctx.strokeStyle =
        "#ddd";

    ctx.lineWidth =
        3;

    ctx.stroke();


    ctx.setLineDash([]);


    /* START LINE */

    const start =
        getTrackPosition(0);

    ctx.save();

    ctx.translate(
        start.x,
        start.y
    );

    ctx.rotate(0);

    const tileSize = 12;

    for (
        let x = -TRACK_WIDTH / 2;
        x < TRACK_WIDTH / 2;
        x += tileSize
    ) {

        for (
            let y = -20;
            y < 20;
            y += tileSize
        ) {

            const odd =
                Math.floor(
                    (x + TRACK_WIDTH / 2) /
                    tileSize
                ) %
                2;

            ctx.fillStyle =
                (
                    (Math.floor(
                        (y + 20) /
                        tileSize
                    ) + odd) %
                    2 === 0
                )
                    ? "#fff"
                    : "#111";


            ctx.fillRect(
                x,
                y,
                tileSize,
                tileSize
            );

        }

    }

    ctx.restore();

}


/* =========================================================
   DRAW CAR
========================================================= */

function drawCar(
    p,
    local = false
) {

    ctx.save();

    ctx.translate(
        p.x,
        p.y
    );

    ctx.rotate(
        p.angle
    );


    /* shadow */

    ctx.fillStyle =
        "rgba(0,0,0,0.35)";

    ctx.fillRect(
        -17,
        -10,
        34,
        20
    );


    /* body */

    ctx.fillStyle =
        local
            ? "#e53935"
            : "#3498db";

    ctx.fillRect(
        -18,
        -9,
        36,
        18
    );


    /* hood */

    ctx.fillStyle =
        local
            ? "#ff5555"
            : "#5dade2";

    ctx.fillRect(
        3,
        -7,
        12,
        14
    );


    /* windows */

    ctx.fillStyle =
        "#111";

    ctx.fillRect(
        -5,
        -7,
        8,
        14
    );


    /* wheels */

    ctx.fillStyle =
        "#080808";

    ctx.fillRect(
        -11,
        -12,
        7,
        5
    );

    ctx.fillRect(
        -11,
        7,
        7,
        5
    );

    ctx.fillRect(
        9,
        -12,
        7,
        5
    );

    ctx.fillRect(
        9,
        7,
        7,
        5
    );


    ctx.restore();


    /* name */

    ctx.save();

    ctx.font =
        "12px Arial";

    ctx.textAlign =
        "center";

    ctx.fillStyle =
        "white";

    ctx.shadowColor =
        "black";

    ctx.shadowBlur =
        4;

    ctx.fillText(
        p.name,
        p.x,
        p.y - 20
    );

    ctx.restore();

}


/* =========================================================
   DRAW MINIMAP
========================================================= */

function drawMinimap() {

    mapCtx.clearRect(
        0,
        0,
        mapCanvas.width,
        mapCanvas.height
    );


    mapCtx.fillStyle =
        "#28752c";

    mapCtx.fillRect(
        0,
        0,
        mapCanvas.width,
        mapCanvas.height
    );


    mapCtx.beginPath();


    track.forEach(
        (point, index) => {

            const x =
                point.x *
                mapCanvas.width;

            const y =
                point.y *
                mapCanvas.height;


            if (index === 0) {

                mapCtx.moveTo(
                    x,
                    y
                );

            }

            else {

                mapCtx.lineTo(
                    x,
                    y
                );

            }

        }
    );


    mapCtx.closePath();


    mapCtx.strokeStyle =
        "#555";

    mapCtx.lineWidth =
        25;

    mapCtx.stroke();


    mapCtx.strokeStyle =
        "#777";

    mapCtx.lineWidth =
        18;

    mapCtx.stroke();


    /* local */

    mapCtx.fillStyle =
        "#e53935";

    mapCtx.beginPath();

    mapCtx.arc(
        player.x / width * mapCanvas.width,
        player.y / height * mapCanvas.height,
        4,
        0,
        Math.PI * 2
    );

    mapCtx.fill();


    /* remote */

    remotePlayers.forEach(p => {

        mapCtx.fillStyle =
            "#3498db";

        mapCtx.beginPath();

        mapCtx.arc(
            p.x / width * mapCanvas.width,
            p.y / height * mapCanvas.height,
            4,
            0,
            Math.PI * 2
        );

        mapCtx.fill();

    });

}


/* =========================================================
   PLAYER LIST
========================================================= */

function updatePlayerList() {

    playersContainer.innerHTML = "";


    const localEntry =
        document.createElement("div");

    localEntry.className =
        "player-entry";

    localEntry.innerHTML =
        `<span>${escapeHTML(player.name)}</span>
         <span>🏎️</span>`;

    playersContainer.appendChild(
        localEntry
    );


    remotePlayers.forEach(p => {

        const entry =
            document.createElement("div");

        entry.className =
            "player-entry";

        entry.innerHTML =
            `<span>${escapeHTML(p.name)}</span>
             <span>🏎️</span>`;

        playersContainer.appendChild(
            entry
        );

    });

}


function escapeHTML(text) {

    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


/* =========================================================
   GAME LOOP
========================================================= */

function gameLoop(now) {

    const dt =
        Math.min(
            0.05,
            (now - lastFrame) /
            1000
        );

    lastFrame =
        now;


    if (gameRunning) {

        updatePlayer(dt);

        sendState();

        draw();

        updateUI();

    }


    requestAnimationFrame(
        gameLoop
    );

}


/* =========================================================
   DRAW
========================================================= */

function draw() {

    ctx.clearRect(
        0,
        0,
        width,
        height
    );


    drawTrack();


    /*
       Remote players
       primero para que nuestro
       carro quede visible encima.
    */

    remotePlayers.forEach(p => {

        drawCar(
            p,
            false
        );

    });


    drawCar(
        player,
        true
    );


    drawMinimap();

}


/* =========================================================
   UI
========================================================= */

function updateUI() {

    lapElement.textContent =
        Math.min(
            player.lap,
            totalLaps
        ) +
        " / " +
        totalLaps;


    positionElement.textContent =
        calculatePosition() +
        "º";


    speedElement.textContent =
        Math.round(
            Math.abs(player.speed) * 25
        ) +
        " km/h";


    if (raceStarted) {

        timeElement.textContent =
            formatTime(
                performance.now() -
                raceStartTime
            );

    }

}


/* =========================================================
   COPY ROOM
========================================================= */

copyRoomButton.addEventListener(
    "click",
    async () => {

        try {

            await navigator.clipboard.writeText(
                roomCode
            );

            copyRoomButton.textContent =
                "COPIADO";

            setTimeout(() => {

                copyRoomButton.textContent =
                    "COPIAR CÓDIGO";

            }, 1500);

        }

        catch {

            alert(
                "Código de sala: " +
                roomCode
            );

        }

    }
);


/* =========================================================
   RESTART
========================================================= */

restartButton.addEventListener(
    "click",
    () => {

        finish.classList.add(
            "hidden"
        );

        resetPlayer();

        raceStarted = false;

        startCountdown();

    }
);


/* =========================================================
   INIT
========================================================= */

updatePlayerList();

requestAnimationFrame(
    gameLoop
);
