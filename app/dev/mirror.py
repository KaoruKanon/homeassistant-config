"""Read-only mirror of production states into the dev01 test instance.

dev01 cannot reach the Zigbee stick or the MQTT broker (both on hass01), so
those entities are unavailable there. This script listens to production
(subscribe only: it never calls a service there) and writes the states of
those entities into dev01 through POST /api/states, so the panel shows real
temperatures, windows, energy, plugs...

Only entities that are unavailable/unknown/missing on dev01 are mirrored:
anything dev01 runs itself (lights over LAN, weather...) is left alone.
A state written this way has no integration behind it on dev01, so a service
call there reaches nothing.

  PROD_URL=http://192.168.1.206:8123 PROD_TOKEN_FILE=~/.config/hass-dev/prod.token \
  DEV_URL=http://localhost:8124 DEV_TOKEN_FILE=~/.config/hass-dev/dev.token python3 mirror.py

Requires: websocket-client.
"""
import json
import os
import pathlib
import threading
import time
import urllib.request

import websocket

PROD_URL = os.environ.get("PROD_URL", "http://192.168.1.206:8123")
DEV_URL = os.environ.get("DEV_URL", "http://localhost:8124")
PROD_TOKEN = pathlib.Path(os.path.expanduser(os.environ["PROD_TOKEN_FILE"])).read_text().strip()
DEV_TOKEN = pathlib.Path(os.path.expanduser(os.environ["DEV_TOKEN_FILE"])).read_text().strip()

DOMAINS = {
    "sensor", "binary_sensor", "light", "switch", "fan", "media_player", "person",
    "device_tracker", "alarm_control_panel", "input_boolean", "input_number",
    "input_datetime", "timer", "calendar", "camera", "update", "number", "select",
}
DEAD = {"unavailable", "unknown"}


def dev_states() -> dict:
    req = urllib.request.Request(f"{DEV_URL}/api/states", headers={"Authorization": f"Bearer {DEV_TOKEN}"})
    return {s["entity_id"]: s for s in json.load(urllib.request.urlopen(req, timeout=20))}


def push(entity_id: str, state: dict) -> None:
    body = json.dumps({"state": state["state"], "attributes": {**state["attributes"], "kh_mirrored": True}}).encode()
    req = urllib.request.Request(
        f"{DEV_URL}/api/states/{entity_id}",
        body,
        {"Authorization": f"Bearer {DEV_TOKEN}", "Content-Type": "application/json"},
    )
    urllib.request.urlopen(req, timeout=10).read()


class Mirror:
    def __init__(self) -> None:
        self.mirrored: set[str] = set()
        self.msg_id = 0

    def wanted(self, entity_id: str, dev: dict) -> bool:
        if entity_id.split(".")[0] not in DOMAINS:
            return False
        if entity_id in self.mirrored:
            return True
        here = dev.get(entity_id)
        return here is None or here["state"] in DEAD or here["attributes"].get("kh_mirrored", False)

    def send(self, ws, payload: dict) -> int:
        self.msg_id += 1
        ws.send(json.dumps({"id": self.msg_id, **payload}))
        return self.msg_id

    def run_once(self) -> None:
        ws = websocket.create_connection(PROD_URL.replace("http", "ws", 1) + "/api/websocket", timeout=60)
        ws.recv()
        ws.send(json.dumps({"type": "auth", "access_token": PROD_TOKEN}))
        if json.loads(ws.recv()).get("type") != "auth_ok":
            raise SystemExit("production refused the token")
        # Read-only calls only: get_states and subscribe_events.
        states_id = self.send(ws, {"type": "get_states"})
        sub_id = self.send(ws, {"type": "subscribe_events", "event_type": "state_changed"})
        dev = dev_states()
        while True:
            msg = json.loads(ws.recv())
            if msg.get("id") == states_id and msg.get("type") == "result":
                for s in msg["result"]:
                    if self.wanted(s["entity_id"], dev):
                        self.mirrored.add(s["entity_id"])
                        push(s["entity_id"], s)
                print(f"mirroring {len(self.mirrored)} entities", flush=True)
            elif msg.get("id") == sub_id and msg.get("type") == "event":
                new = msg["event"]["data"].get("new_state")
                if new and new["entity_id"] in self.mirrored:
                    push(new["entity_id"], new)

    def run(self) -> None:
        while True:
            try:
                self.run_once()
            except SystemExit:
                raise
            except Exception as exc:  # network blip, HA restart...
                print(f"reconnecting in 15 s: {exc}", flush=True)
                time.sleep(15)


if __name__ == "__main__":
    Mirror().run()
