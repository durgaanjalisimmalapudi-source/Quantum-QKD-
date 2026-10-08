"""
Dynamic E91 Quantum Key Distribution Protocol Implementation using Qiskit.
Performs round-by-round entangled pair generation, basis measurement,
QBER and CHSH calculation, eavesdropping detection, and key sifting.
"""

from typing import AsyncGenerator, Generator, Optional
import numpy as np
from qiskit import QuantumCircuit
from qiskit.quantum_info import Statevector

from eve_simulator import EveSimulator
from qber_chsh import QberChshCalculator


class E91Protocol:
    """
    Simulates the dynamic E91 protocol between Alice and Bob.
    """

    ALICE_BASIS_ANGLES = [0.0, np.pi / 4, np.pi / 2]  # a1, a2, a3
    BOB_BASIS_ANGLES = [np.pi / 4, np.pi / 2, 3 * np.pi / 4]  # b1, b2, b3

    ALICE_LABELS = ["a1 (0°)", "a2 (45°)", "a3 (90°)"]
    BOB_LABELS = ["b1 (45°)", "b2 (90°)", "b3 (135°)"]

    def __init__(
        self,
        session_id: str,
        inject_eve: bool = False,
        target_key_bits: int = 256,
        max_rounds: int = 1500,
        seed: Optional[int] = None,
    ):
        self.session_id = session_id
        self.inject_eve = inject_eve
        self.target_key_bits = target_key_bits
        self.max_rounds = max_rounds
        self.rng = np.random.default_rng(seed)

        self.eve = EveSimulator(seed=seed)
        self.calculator = QberChshCalculator(inject_eve=inject_eve)

        self.sifted_key_bits: list[int] = []
        self.rounds_log: list[dict] = []
        self.status = "running"  # 'running' | 'key_ready' | 'aborted' | 'completed'

    def create_bell_state(self) -> QuantumCircuit:
        """Creates maximally entangled Bell state |Phi+> = (|00> + |11>) / sqrt(2)"""
        qc = QuantumCircuit(2)
        qc.h(0)
        qc.cx(0, 1)
        return qc

    def run_single_round(self, round_num: int) -> dict:
        """
        Executes a single quantum round:
        1. Prepares Bell state.
        2. Assigns random bases to Alice and Bob.
        3. If Eve is active, intercepts and resends Bob's qubit.
        4. Alice and Bob measure in their respective bases.
        5. Computes running QBER and CHSH S.
        6. Applies security checks and sifts key material.
        """
        # Random basis selection
        a_idx = int(self.rng.integers(0, 3))
        b_idx = int(self.rng.integers(0, 3))
        ta = self.ALICE_BASIS_ANGLES[a_idx]
        tb = self.BOB_BASIS_ANGLES[b_idx]

        bell_circuit = self.create_bell_state()

        eve_intercepted = False
        eve_angle = None
        eve_bit = None

        if self.inject_eve:
            # Eve intercepts Bob's qubit (qubit 1) on the channel
            eve_intercepted = True
            post_sv, eve_angle, eve_bit = self.eve.intercept_and_resend(
                bell_circuit, qubit_index=1
            )
            # Rotate Alice in ta and Bob in tb
            qc_meas = QuantumCircuit(2)
            qc_meas.ry(-ta, 0)
            qc_meas.ry(-tb, 1)
            final_sv = post_sv.evolve(qc_meas)
        else:
            qc_meas = QuantumCircuit(2)
            qc_meas.compose(bell_circuit, inplace=True)
            qc_meas.ry(-ta, 0)
            qc_meas.ry(-tb, 1)
            final_sv = Statevector.from_instruction(qc_meas)

        # Sample measurement outcomes
        outcome_str, _ = final_sv.measure([0, 1])
        alice_bit = int(outcome_str[1])
        bob_bit = int(outcome_str[0])

        # Compute per-round QBER and CHSH
        stats = self.calculator.update(
            alice_idx=a_idx,
            bob_idx=b_idx,
            alice_bit=alice_bit,
            bob_bit=bob_bit,
            eve_active_this_round=eve_intercepted,
            inject_eve=self.inject_eve,
        )

        is_key_round = bool(stats["is_key_round"])
        discarded = bool(stats["discarded"])
        anomaly_flagged = bool(stats["anomaly_flagged"])

        # Sift valid key bits
        if is_key_round and not discarded and not anomaly_flagged:
            self.sifted_key_bits.append(alice_bit)

        round_data = {
            "session_id": self.session_id,
            "round_num": round_num,
            "alice_basis": self.ALICE_LABELS[a_idx],
            "bob_basis": self.BOB_LABELS[b_idx],
            "alice_idx": a_idx,
            "bob_idx": b_idx,
            "alice_bit": alice_bit,
            "bob_bit": bob_bit,
            "is_key_round": is_key_round,
            "is_chsh_round": bool(stats["is_chsh_round"]),
            "qber": float(stats["qber"]),
            "chsh_s": float(stats["chsh_s"]),
            "anomaly_flagged": anomaly_flagged,
            "discarded": discarded,
            "reason": str(stats["reason"]),
            "sifted_bits_count": len(self.sifted_key_bits),
            "target_bits": self.target_key_bits,
            "eve_intercepted": eve_intercepted,
            "eve_angle_deg": int(round(np.degrees(eve_angle))) if eve_angle is not None else None,
            "eve_bit": eve_bit,
        }

        self.rounds_log.append(round_data)
        return round_data

    def get_final_key_hex(self) -> str:
        """
        Converts the sifted bits into a hex string (up to target_key_bits).
        If shorter, key is derived/padded deterministically.
        """
        if not self.sifted_key_bits:
            return ""

        # Take the required target bits
        bits = self.sifted_key_bits[: self.target_key_bits]
        # Pack bits into bytes (MSB first)
        byte_arr = bytearray()
        for i in range(0, len(bits), 8):
            chunk = bits[i : i + 8]
            val = 0
            for bit in chunk:
                val = (val << 1) | bit
            # pad remaining bits if last chunk has < 8
            if len(chunk) < 8:
                val = val << (8 - len(chunk))
            byte_arr.append(val)

        return byte_arr.hex()

    def get_summary(self) -> dict:
        """Returns final session summary."""
        final_key_hex = self.get_final_key_hex() if self.status == "key_ready" else ""
        return {
            "session_id": self.session_id,
            "status": self.status,
            "inject_eve": self.inject_eve,
            "final_qber": self.calculator.running_qber,
            "final_chsh_s": self.calculator.running_chsh_s,
            "key_length_bits": len(self.sifted_key_bits),
            "total_rounds": len(self.rounds_log),
            "final_key_hex": final_key_hex,
        }

