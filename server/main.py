import asyncio
import json
import uuid

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Laky Racing")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


players = {}


class Player:
    def __init__(self, websocket):
        self.id = str(uuid.uuid4())[:8]
        self.websocket = websocket

        self.name = "Jugador"

        self.x = 0
        self.y = 0
        self.angle = 0
        self.lap = 1


async def broadcast():

    data = {
        "type": "players",

        "players": [
            {
                "id": p.id,
                "name": p.name,
                "x": p.x,
                "y": p.y,
                "angle": p.angle,
                "lap": p.lap,
            }

            for p in players.values()
        ]
    }

    message = json.dumps(data)

    disconnected = []

    for player in list(players.values()):

        try:
            await player.websocket.send_text(message)

        except Exception:
            disconnected.append(player.id)

    for player_id in disconnected:
        players.pop(player_id, None)


@app.get("/")
async def home():

    return {
        "game": "Laky Racing",
        "status": "online",
        "players": len(players)
    }


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):

    await websocket.accept()

    player = Player(websocket)

    players[player.id] = player

    print(
        f"[+] Jugador conectado: {player.id}"
    )

    await websocket.send_text(
        json.dumps({
            "type": "welcome",
            "id": player.id
        })
    )

    await broadcast()

    try:

        while True:

            raw = await websocket.receive_text()

            try:
                data = json.loads(raw)

            except json.JSONDecodeError:
                continue


            if data.get("type") == "update":

                player.x = float(
                    data.get("x", 0)
                )

                player.y = float(
                    data.get("y", 0)
                )

                player.angle = float(
                    data.get("angle", 0)
                )

                player.lap = int(
                    data.get("lap", 1)
                )

                if "name" in data:

                    player.name = str(
                        data["name"]
                    )[:20]


            elif data.get("type") == "ping":

                await websocket.send_text(
                    json.dumps({
                        "type": "pong"
                    })
                )

    except WebSocketDisconnect:

        players.pop(
            player.id,
            None
        )

        print(
            f"[-] Jugador desconectado: {player.id}"
        )

        await broadcast()

    except Exception as error:

        players.pop(
            player.id,
            None
        )

        print(
            f"[!] Error: {error}"
        )

        await broadcast()


async def server_loop():

    while True:

        await broadcast()

        await asyncio.sleep(0.05)


@app.on_event("startup")
async def startup():

    asyncio.create_task(
        server_loop()
    )
