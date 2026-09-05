DROP TABLE IF EXISTS ecis_search_logs;

CREATE TABLE ecis_search_logs (
    search_log_id BIGSERIAL PRIMARY KEY,

    emergency_case_id BIGINT NULL,

    searched_by BIGINT NOT NULL,

    search_criteria JSONB NOT NULL,

    result_count INTEGER NOT NULL DEFAULT 0,

    searched_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_ecis_result_count
        CHECK (result_count >= 0)
);

CREATE INDEX idx_ecis_search_logs_emergency_case
    ON ecis_search_logs(emergency_case_id);

CREATE INDEX idx_ecis_search_logs_searched_by
    ON ecis_search_logs(searched_by);

CREATE INDEX idx_ecis_search_logs_searched_at
    ON ecis_search_logs(searched_at);