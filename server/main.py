import asyncio
import json
import uuid

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Laky Racing Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


players = {}


class Player:
    def __init__(self, websocket):
        self.id = str(uuid.uuid4())[:8]
        self.websocket = websocket

        self.x = 0
        self.y = 0
        self.angle = 0

        self.name = "Jugador"


async def broadcast():
    data = {
        "type": "players",
        "players": [
            {
                "id": player.id,
                "name": player.name,
                "x": player.x,
                "y": player.y,
                "angle": player.angle,
            }
            for player in players.values()
        ],
    }

    message = json.dumps(data)

    disconnected = []

    for player in players.values():

        try:
            await player.websocket.send_text(message)

        except Exception:
            disconnected.append(player.id)

    for player_id in disconnected:
        players.pop(player_id, None)


@app.get("/")
async def root():
    return {
        "game": "Laky Racing",
        "status": "online",
        "players": len(players),
    }


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):

    await websocket.accept()

    player = Player(websocket)

    players[player.id] = player

    await websocket.send_text(
        json.dumps({
            "type": "welcome",
            "id": player.id,
        })
    )

    await broadcast()

    try:

        while True:

            message = await websocket.receive_text()

            try:
                data = json.loads(message)

            except json.JSONDecodeError:
                continue

            message_type = data.get("type")

            if message_type == "update":

                player.x = float(data.get("x", 0))
                player.y = float(data.get("y", 0))
                player.angle = float(data.get("angle", 0))

                if "name" in data:
                    player.name = str(data["name"])[:20]

            elif message_type == "ping":

                await websocket.send_text(
                    json.dumps({
                        "type": "pong"
                    })
                )

    except WebSocketDisconnect:

        players.pop(player.id, None)

        await broadcast()

    except Exception:

        players.pop(player.id, None)

        await broadcast()


async def game_loop():

    while True:

        await broadcast()

        await asyncio.sleep(0.05)


@app.on_event("startup")
async def startup():

    asyncio.create_task(game_loop())
