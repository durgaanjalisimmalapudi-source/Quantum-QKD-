"""
Test script for FastAPI Quantum Engine HTTP and WebSocket endpoints.
Verifies Step 3 of UC025 specification.
"""

import asyncio
import json
import uvicorn
import websockets
from fastapi.testclient import TestClient
from api import app

client = TestClient(app)

def test_http_start_and_status():
    print("Testing HTTP /health...")
    resp = client.get("/health")
    assert resp.status_code == 200, resp.text
    print("Health OK:", resp.json())

    session_id = "test-http-session-1"
    print(f"Testing POST /engine/start for {session_id}...")
    start_resp = client.post("/engine/start", json={
        "session_id": session_id,
        "inject_eve": False,
        "target_key_bits": 32,
        "max_rounds": 100,
        "round_delay_ms": 1
    })
    assert start_resp.status_code == 200, start_resp.text
    print("Start response:", start_resp.json())

    # Wait briefly for execution
    import time
    time.sleep(1.0)

    print("Testing GET /engine/status...")
    stat_resp = client.get(f"/engine/status/{session_id}")
    assert stat_resp.status_code == 200, stat_resp.text
    print("Status response:", stat_resp.json())

    print("Testing GET /engine/result...")
    res_resp = client.get(f"/engine/result/{session_id}")
    assert res_resp.status_code == 200, res_resp.text
    print("Result summary:", res_resp.json())
    print("HTTP endpoints verified successfully!")

async def test_live_server_with_ws():
    """Starts uvicorn on localhost:8000 and connects via websockets."""
    config = uvicorn.Config(app=app, host="127.0.0.1", port=8000, log_level="warning")
    server = uvicorn.Server(config)
    server_task = asyncio.create_task(server.serve())

    # Wait for server to start
    await asyncio.sleep(1.0)

    try:
        import httpx
        session_id = "test-ws-session-eve"
        print(f"\nTesting WebSocket stream on http://127.0.0.1:8000 for session {session_id}...")

        # 1. Start session with Eve injected
        async with httpx.AsyncClient() as http_client:
            r = await http_client.post("http://127.0.0.1:8000/engine/start", json={
                "session_id": session_id,
                "inject_eve": True,
                "target_key_bits": 32,
                "max_rounds": 60,
                "round_delay_ms": 5
            })
            assert r.status_code == 200, r.text

        # 2. Connect to WebSocket stream
        ws_url = f"ws://127.0.0.1:8000/engine/ws/{session_id}"
        events_received = []
        alerts_received = []

        async with websockets.connect(ws_url) as ws:
            while True:
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=5.0)
                    data = json.loads(msg)
                    events_received.append(data.get("event"))
                    if data.get("event") == "eavesdrop_alert":
                        alerts_received.append(data)
                    if data.get("event") == "session_finished":
                        break
                except asyncio.TimeoutError:
                    print("Timeout waiting for WS message")
                    break

        print(f"WS Events received: {len(events_received)}")
        print(f"Eavesdrop alerts received: {len(alerts_received)}")
        assert "round_stats" in events_received, "Must receive round_stats events!"
        assert len(alerts_received) > 0, "Must receive eavesdrop_alert events when Eve injected!"
        print("WebSocket live streaming verified successfully!")

    finally:
        server.should_exit = True
        await server_task

if __name__ == "__main__":
    test_http_start_and_status()
    asyncio.run(test_live_server_with_ws())
    print("\nALL FASTAPI + WEBSOCKET ENGINE TESTS PASSED!")

