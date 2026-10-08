"""
Eve Simulator for Dynamic E91 QKD Protocol.
Simulates intercept-resend eavesdropping on the transmitted quantum channel.
"""

import numpy as np
from qiskit import QuantumCircuit
from qiskit.quantum_info import Statevector


class EveSimulator:
    """
    Simulates an eavesdropper (Eve) performing an intercept-resend attack
    on Bob's entangled qubit before Bob performs his measurement.
    """

    def __init__(self, seed: int | None = None):
        self.rng = np.random.default_rng(seed)
        # Eve measures in one of the standard measurement bases
        self.basis_angles = [0.0, np.pi / 4, np.pi / 2, 3 * np.pi / 4]

    def intercept_and_resend(
        self,
        bell_circuit: QuantumCircuit,
        qubit_index: int = 1,
    ) -> tuple[Statevector, float, int]:
        """
        Intercepts the designated qubit from the Bell circuit, measures it
        in a randomly chosen basis, and prepares an eigenstate in that basis
        to resend to Bob.

        Returns:
            post_sv: The post-measurement Statevector for the two-qubit system
                     where qubit 0 remains entangled/collapsed accordingly and
                     qubit 1 has been re-prepared by Eve.
            eve_angle: The basis angle Eve chose.
            eve_bit: Eve's measured outcome (0 or 1).
        """
        eve_angle = float(self.rng.choice(self.basis_angles))

        # Evolve Bell pair and rotate Eve's intercepted qubit into her measurement basis
        qc_eve = QuantumCircuit(2)
        qc_eve.compose(bell_circuit, inplace=True)
        qc_eve.ry(-eve_angle, qubit_index)

        sv_eve = Statevector.from_instruction(qc_eve)

        # Eve measures qubit_index, collapsing the joint quantum state
        outcome_str, sv_collapsed = sv_eve.measure([qubit_index])
        eve_bit = int(outcome_str)

        # Eve re-prepares the measured eigenstate to resend along the channel
        qc_resend = QuantumCircuit(2)
        qc_resend.ry(eve_angle, qubit_index)
        post_sv = sv_collapsed.evolve(qc_resend)

        return post_sv, eve_angle, eve_bit

