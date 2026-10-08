-- UC025 PostgreSQL Schema for Dynamic E91 QKD Platform
CREATE TABLE IF NOT EXISTS sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_a_name     VARCHAR(100) NOT NULL,
    site_b_name     VARCHAR(100) NOT NULL,
    inject_eve      BOOLEAN NOT NULL DEFAULT FALSE,
    status          VARCHAR(20) NOT NULL DEFAULT 'running',
        -- 'running' | 'key_ready' | 'aborted' | 'completed' | 'failed'
    final_qber      NUMERIC(6,4),
    final_chsh_s    NUMERIC(6,4),
    key_length_bits INTEGER,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at        TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS round_logs (
    id              BIGSERIAL PRIMARY KEY,
    session_id      UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    round_num       INTEGER NOT NULL,
    qber            NUMERIC(6,4) NOT NULL,
    chsh_s          NUMERIC(6,4) NOT NULL,
    anomaly_flagged BOOLEAN NOT NULL DEFAULT FALSE,
    discarded       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_round_logs_session ON round_logs(session_id, round_num);

CREATE TABLE IF NOT EXISTS message_logs (
    id              BIGSERIAL PRIMARY KEY,
    session_id      UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    direction       VARCHAR(10) NOT NULL, -- 'A_to_B' | 'B_to_A'
    ciphertext      TEXT NOT NULL,
    iv              TEXT NOT NULL,
    auth_tag        TEXT NOT NULL,
    sent_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_message_logs_session ON message_logs(session_id);

