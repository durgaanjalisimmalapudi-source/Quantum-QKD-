"""
FastAPI Quantum Engine Service for Dynamic E91 QKD Protocol.
Exposes HTTP and WebSocket endpoints to control and stream quantum simulations.
"""

import asyncio
from typing import Dict, List, Optional
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from e91_protocol import E91Protocol

app = FastAPI(
    title="Dynamic E91 Quantum Engine",
    description="Qiskit-powered E91 QKD simulation service with per-round QBER and CHSH streaming.",
    version="1.0.0",
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class StartSessionRequest(BaseModel):
    session_id: str
    inject_eve: bool = False
    target_key_bits: int = 256
    max_rounds: int = 1500
    round_delay_ms: int = 30  # delay between rounds for live stream visualization


class SessionState:
    def __init__(
        self,
        session_id: str,
        inject_eve: bool,
        target_key_bits: int,
        max_rounds: int,
        round_delay_ms: int,
    ):
        self.session_id = session_id
        self.inject_eve = inject_eve
        self.target_key_bits = target_key_bits
        self.max_rounds = max_rounds
        self.round_delay_ms = round_delay_ms
        self.protocol = E91Protocol(
            session_id=session_id,
            inject_eve=inject_eve,
            target_key_bits=target_key_bits,
            max_rounds=max_rounds,
        )
        self.subscribers: List[WebSocket] = []
        self.is_running = False
        self.is_completed = False
        self.task: Optional[asyncio.Task] = None
        self.event_history: List[dict] = []


active_sessions: Dict[str, SessionState] = {}


async def run_protocol_loop(state: SessionState):
    """Asynchronously executes protocol rounds and pushes events over WebSocket."""
    state.is_running = True
    protocol = state.protocol
    round_num = 0

    try:
        while round_num < state.max_rounds:
            round_num += 1
            round_data = protocol.run_single_round(round_num)

            # 1. Round stats event
            event_stats = {
                "event": "round_stats",
                "session_id": state.session_id,
                "data": round_data,
            }
            state.event_history.append(event_stats)
            await broadcast(state, event_stats)

            # 2. Check if eavesdrop alert should be dispatched
            if round_data["anomaly_flagged"]:
                alert_event = {
                    "event": "eavesdrop_alert",
                    "session_id": state.session_id,
                    "round_num": round_num,
                    "qber": round_data["qber"],
                    "chsh_s": round_data["chsh_s"],
                    "reason": round_data["reason"],
                    "discarded": round_data["discarded"],
                }
                state.event_history.append(alert_event)
                await broadcast(state, alert_event)

            # Check completion criteria:
            # If target key reached
            if round_data["sifted_bits_count"] >= state.target_key_bits:
                protocol.status = "key_ready"
                break

            # If Eve injected and high QBER sustained, mark aborted if max rounds reached or key cannot form
            if state.inject_eve and round_num >= min(200, state.max_rounds):
                if protocol.calculator.running_qber > 0.11 or protocol.calculator.running_chsh_s < 2.0:
                    protocol.status = "aborted"
                    break

            if state.round_delay_ms > 0:
                await asyncio.sleep(state.round_delay_ms / 1000.0)

        if protocol.status == "running":
            protocol.status = "completed" if len(protocol.sifted_key_bits) >= state.target_key_bits else "aborted"

    except Exception as e:
        protocol.status = "failed"
        error_event = {
            "event": "session_error",
            "session_id": state.session_id,
            "error": str(e),
        }
        await broadcast(state, error_event)
    finally:
        state.is_running = False
        state.is_completed = True
        complete_event = {
            "event": "session_finished",
            "session_id": state.session_id,
            "summary": protocol.get_summary(),
        }
        state.event_history.append(complete_event)
        await broadcast(state, complete_event)


async def broadcast(state: SessionState, message: dict):
    """Broadcasts a JSON message to all connected WebSocket clients."""
    disconnected = []
    for ws in state.subscribers:
        try:
            await ws.send_json(message)
        except Exception:
            disconnected.append(ws)
    for ws in disconnected:
        if ws in state.subscribers:
            state.subscribers.remove(ws)


@app.post("/engine/start")
async def start_engine_session(req: StartSessionRequest):
    """Begins an E91 QKD simulation session."""
    session_state = SessionState(
        session_id=req.session_id,
        inject_eve=req.inject_eve,
        target_key_bits=req.target_key_bits,
        max_rounds=req.max_rounds,
        round_delay_ms=req.round_delay_ms,
    )
    active_sessions[req.session_id] = session_state
    session_state.task = asyncio.create_task(run_protocol_loop(session_state))

    return {
        "status": "started",
        "session_id": req.session_id,
        "inject_eve": req.inject_eve,
        "target_key_bits": req.target_key_bits,
    }


@app.get("/engine/status/{session_id}")
async def get_session_status(session_id: str):
    """Retrieves current session status and summary statistics."""
    if session_id not in active_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    state = active_sessions[session_id]
    summary = state.protocol.get_summary()
    return {
        "session_id": session_id,
        "is_running": state.is_running,
        "is_completed": state.is_completed,
        "summary": summary,
    }


@app.get("/engine/result/{session_id}")
async def get_session_result(session_id: str):
    """
    Returns the final sifted key (hex-encoded) and metrics once the session completes.
    Strictly transmitted directly to Node backend memory.
    """
    if session_id not in active_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    state = active_sessions[session_id]
    summary = state.protocol.get_summary()
    return summary


@app.websocket("/engine/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """WebSocket stream for round_stats and eavesdrop_alert events."""
    await websocket.accept()

    if session_id not in active_sessions:
        await websocket.send_json({"event": "error", "message": "Session not registered"})
        await websocket.close()
        return

    state = active_sessions[session_id]
    state.subscribers.append(websocket)

    # Replay past events if client connected slightly late
    for past_event in list(state.event_history):
        try:
            await websocket.send_json(past_event)
        except Exception:
            break

    try:
        while True:
            # Keep connection open and await any client pings
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        if websocket in state.subscribers:
            state.subscribers.remove(websocket)
    except Exception:
        if websocket in state.subscribers:
            state.subscribers.remove(websocket)


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "quantum-engine"}

