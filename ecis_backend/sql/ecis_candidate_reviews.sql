CREATE TABLE IF NOT EXISTS public.ecis_candidate_reviews (
    review_id BIGSERIAL PRIMARY KEY,

    emergency_case_id BIGINT NOT NULL,

    patient_id BIGINT NOT NULL,

    reviewed_by BIGINT NOT NULL,

    review_status VARCHAR(30) NOT NULL,

    review_reason TEXT,

    reviewed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_ecis_review_status
        CHECK (
            review_status IN (
                'CONFIRMED',
                'REJECTED',
                'NEEDS_MORE_EVIDENCE'
            )
        ),

    CONSTRAINT fk_ecis_review_emergency_case
        FOREIGN KEY (emergency_case_id)
        REFERENCES public.emergency_cases(emergency_case_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_ecis_review_patient
        FOREIGN KEY (patient_id)
        REFERENCES public.patients(patient_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_ecis_review_user
        FOREIGN KEY (reviewed_by)
        REFERENCES public.hospital_users(user_id)
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_ecis_reviews_emergency_case
    ON public.ecis_candidate_reviews(emergency_case_id);

CREATE INDEX IF NOT EXISTS idx_ecis_reviews_patient
    ON public.ecis_candidate_reviews(patient_id);

CREATE INDEX IF NOT EXISTS idx_ecis_reviews_reviewed_by
    ON public.ecis_candidate_reviews(reviewed_by);

CREATE INDEX IF NOT EXISTS idx_ecis_reviews_status
    ON public.ecis_candidate_reviews(review_status);

CREATE INDEX IF NOT EXISTS idx_ecis_reviews_reviewed_at
    ON public.ecis_candidate_reviews(reviewed_at);