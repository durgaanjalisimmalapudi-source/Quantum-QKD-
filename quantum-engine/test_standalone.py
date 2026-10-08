"""
Standalone test script for E91 Protocol and Eavesdropper Detection.
Verifies Step 2 of UC025 specification.
"""

from e91_protocol import E91Protocol

def test_session(inject_eve: bool, rounds: int = 250):
    mode_str = "WITH EAVESDROPPER" if inject_eve else "CLEAN (NO EAVESDROPPER)"
    print(f"\n==========================================")
    print(f"Running E91 Protocol: {mode_str}")
    print(f"==========================================")

    protocol = E91Protocol(
        session_id="test-session-" + ("eve" if inject_eve else "clean"),
        inject_eve=inject_eve,
        target_key_bits=64, # small target for fast standalone test
        max_rounds=rounds,
        seed=123
    )

    anomalies = 0
    discarded = 0
    key_rounds = 0

    for r in range(1, rounds + 1):
        round_data = protocol.run_single_round(r)
        if round_data["is_key_round"]:
            key_rounds += 1
        if round_data["anomaly_flagged"]:
            anomalies += 1
        if round_data["discarded"]:
            discarded += 1

        if r % 50 == 0 or r == rounds:
            print(f"Round {r:3d} | QBER: {round_data['qber']:.4f} | CHSH S: {round_data['chsh_s']:.4f} "
                  f"| Sifted: {round_data['sifted_bits_count']}/{protocol.target_key_bits} "
                  f"| Anomaly: {round_data['anomaly_flagged']} | Discarded: {round_data['discarded']}")

    summary = protocol.get_summary()
    print("\nSession Summary:")
    print(f"  Total Rounds: {summary['total_rounds']}")
    print(f"  Key Rounds Observed: {key_rounds}")
    print(f"  Final QBER: {summary['final_qber']:.4f}")
    print(f"  Final CHSH S: {summary['final_chsh_s']:.4f}")
    print(f"  Anomalies Flagged: {anomalies}")
    print(f"  Rounds Discarded: {discarded}")
    print(f"  Sifted Key Bits: {summary['key_length_bits']}")
    if summary['final_key_hex']:
        print(f"  Key Hex (first 16 chars): {summary['final_key_hex'][:16]}...")
    return summary

if __name__ == "__main__":
    clean_summary = test_session(inject_eve=False, rounds=250)
    eve_summary = test_session(inject_eve=True, rounds=250)

    print("\n----------------- VERIFICATION -----------------")
    print(f"Clean Run -> QBER: {clean_summary['final_qber']:.4f} (<= 0.05), CHSH S: {clean_summary['final_chsh_s']:.4f} (~2.82)")
    print(f"Eve Run   -> QBER: {eve_summary['final_qber']:.4f} (> 0.11), CHSH S: {eve_summary['final_chsh_s']:.4f} (<= 2.0)")

    assert clean_summary['final_qber'] <= 0.05, "Clean QBER should be low!"
    assert clean_summary['final_chsh_s'] > 2.0, "Clean CHSH S should violate Bell inequality (> 2.0)!"
    assert eve_summary['final_qber'] > 0.11, "Eve QBER should exceed 11% abort threshold!"
    assert eve_summary['final_chsh_s'] < 2.0, "Eve CHSH S should drop below quantum threshold 2.0!"
    print("ALL STANDALONE VERIFICATION CHECKS PASSED!")
