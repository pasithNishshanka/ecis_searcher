const ecisService = require("../services/ecis.service");
const pool = require("../config/database");
const faceProfiles = require("../services/faceProfile.service");


/*
 * ============================================================
 * ECIS CONTROLLER
 * ============================================================
 *
 * ECIS searches the existing longitudinal EHR and returns
 * candidate patients for authorized human review.
 *
 * Important:
 * - ECIS does not create a second patient database.
 * - ECIS does not automatically confirm identity.
 * - The returned score is an explainable heuristic score,
 *   not a medically validated probability.
 */


/*
 * ------------------------------------------------------------
 * FRONTEND -> SERVICE CRITERIA MAPPING
 * ------------------------------------------------------------
 *
 * The ECIS frontend uses descriptive field names while the
 * service uses shorter normalized names internally.
 */
function normalizeFrontendCriteria(criteria) {
  return {
    ...criteria,

    /* Demographic / direct fields */
    name:
      criteria.name ??
      criteria.partialName,

    phone:
      criteria.phone ??
      criteria.phoneFragment,

    occupation:
      criteria.occupation ??
      criteria.workplace,

    /* Longitudinal clinical evidence fields */
    surgery:
      criteria.surgery ??
      criteria.previousSurgery,

    device:
      criteria.device ??
      criteria.implantOrDevice,

    dental:
      criteria.dental ??
      criteria.dentalClue,

    observation:
      criteria.observation ??
      criteria.clinicalObservation,
  };
}


/*
 * ------------------------------------------------------------
 * EVIDENCE SOURCE TABLE LABELS
 * ------------------------------------------------------------
 */
const evidenceSourceTables = {
  gender: "patients",
  bloodGroup: "patients",
  age: "patients",
  height: "patients",
  weight: "patients",
  name: "patients",
  phone: "patients",
  occupation: "patients",
  surgery: "surgeries",
  fracture: "fractures",
  device: "medical_devices",
  dental: "dental_records",
  observation: "clinical_observations",
  treatment: "treatment_records",
  investigation: "investigations",
  face: "patient_face_profiles",
};


function mapEvidence(evidence) {
  return (evidence || []).map((item) => ({
    type:
      item.label ||
      item.key ||
      "Evidence",

    description:
      item.details ||
      item.label ||
      "Matching clinical evidence",

    sourceTable:
      evidenceSourceTables[item.key] ||
      "patients",

    /* Keep the original explainability information too. */
    key:
      item.key ||
      null,

    score:
      Number.isFinite(
        Number(item.score),
      )
        ? Number(item.score)
        : 0,
  }));
}


function mapCandidate(candidate) {
  const patient =
    candidate?.patient ||
    {};

  const fullName = [
    patient.firstName,
    patient.middleName,
    patient.lastName,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return {
    patientId:
      patient.patientId ??
      null,

    hospitalId:
      patient.hospitalId ??
      null,

    patientNumber:
      patient.patientNumber ??
      null,

    name:
      fullName ||
      "Unknown patient",

    firstName:
      patient.firstName ??
      null,

    middleName:
      patient.middleName ??
      null,

    lastName:
      patient.lastName ??
      null,

    dateOfBirth:
      patient.dateOfBirth ??
      null,

    age:
      patient.age ??
      null,

    gender:
      patient.gender ??
      null,

    bloodGroup:
      patient.bloodGroup ??
      null,

    heightCm:
      patient.heightCm ??
      null,

    weightKg:
      patient.weightKg ??
      null,

    primaryPhone:
      patient.primaryPhone ??
      null,

    occupation:
      patient.occupation ??
      null,

    nationality:
      patient.nationality ??
      null,

    district:
      patient.district ??
      null,

    province:
      patient.province ??
      null,

    score:
      Number.isFinite(
        Number(
          candidate?.normalizedScore,
        ),
      )
        ? Number(
            candidate.normalizedScore,
          )
        : 0,

    rawScore:
      Number.isFinite(
        Number(
          candidate?.score,
        ),
      )
        ? Number(
            candidate.score,
          )
        : 0,

    evidence:
      mapEvidence(
        candidate?.evidence,
      ),

    sourceCounts:
      candidate?.sourceCounts ||
      {},
  };
}


/*
 * ============================================================
 * POST /api/ecis/search
 * ============================================================
 */
const searchECISCandidates = async (
  req,
  res,
) => {
  try {
    const criteria =
      req.body ||
      {};

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message:
          "Authenticated user information is required",
      });
    }


    const hospitalId =
      Number(
        req.user.hospitalId,
      );

    if (
      !Number.isInteger(
        hospitalId,
      ) ||
      hospitalId <= 0
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Authenticated hospital information is required",
      });
    }


    /*
     * Emergency case is optional.
     *
     * ECIS can search the existing EHR directly.
     * When emergencyCaseId is supplied, the search is linked
     * to that unidentified emergency case and audited.
     */
    const emergencyCaseId =
      criteria.emergencyCaseId !==
        undefined &&
      criteria.emergencyCaseId !==
        null &&
      criteria.emergencyCaseId !==
        ""
        ? Number(
            criteria.emergencyCaseId,
          )
        : null;

    let emergencyCase =
      null;


    if (
      emergencyCaseId !==
      null
    ) {
      if (
        !Number.isInteger(
          emergencyCaseId,
        ) ||
        emergencyCaseId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "emergencyCaseId must be a valid positive number",
        });
      }


      const emergencyCaseResult =
        await pool.query(
          `
            SELECT
              emergency_case_id,
              hospital_id,
              patient_id,
              case_number,
              unidentified_patient,
              status
            FROM public.emergency_cases
            WHERE emergency_case_id = $1
            LIMIT 1;
          `,
          [
            emergencyCaseId,
          ],
        );


      if (
        emergencyCaseResult
          .rows
          .length === 0
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Emergency case not found",
        });
      }


      emergencyCase =
        emergencyCaseResult.rows[0];


      if (
        Number(
          emergencyCase.hospital_id,
        ) !==
        hospitalId
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You do not have access to this emergency case",
        });
      }


      if (
        !emergencyCase.unidentified_patient
      ) {
        return res.status(400).json({
          success: false,
          message:
            "ECIS case-linked search is only available for unidentified emergency cases",
        });
      }
    }


    /*
     * Remove only the request-routing field before normalizing.
     *
     * The remaining frontend aliases must stay available here so
     * normalizeFrontendCriteria() can map partialName, phoneFragment,
     * and the other UI field names to their database search filters.
     */
    const {
      emergencyCaseId:
        _ignored,
      faceDescriptor,
      faceModelId,
      facePatientIds: _ignoredFacePatientIds,
      ...directCriteria
    } = criteria;

    const faceSearch = faceDescriptor !== undefined;
    const faceMatches = faceSearch
      ? await faceProfiles.findMatches(faceDescriptor, faceModelId)
      : [];


    const serviceCriteria =
      normalizeFrontendCriteria(
        directCriteria,
      );

    if (faceSearch && faceMatches.length) {
      // Only server-computed candidate IDs can constrain the clinical search.
      serviceCriteria.facePatientIds = faceMatches.map((match) => match.patientId);
    }


    /*
     * The current ecis.service.js exports searchPatients().
     */
    if (
      typeof
        ecisService.searchPatients !==
      "function"
    ) {
      throw new Error(
        "ECIS service searchPatients() is not available",
      );
    }


    const serviceResult = faceSearch && !faceMatches.length
      ? { candidates: [], weightModel: null }
      : await ecisService.searchPatients(serviceCriteria, hospitalId);


    /*
     * Current service returns:
     *
     * {
     *   searchCriteria,
     *   weightModel,
     *   count,
     *   candidates
     * }
     *
     * Keep the controller compatible with that structure.
     */
    const rawCandidates =
      Array.isArray(
        serviceResult,
      )
        ? serviceResult
        : Array.isArray(
            serviceResult?.candidates,
          )
          ? serviceResult.candidates
          : [];


    const candidates =
      rawCandidates.map(
        mapCandidate,
      );

    if (faceSearch) {
      const byPatient = new Map(faceMatches.map((match) => [match.patientId, match]));
      for (const candidate of candidates) {
        const match = byPatient.get(Number(candidate.patientId));
        if (match) {
          candidate.faceDistance = Number(match.distance.toFixed(3));
          candidate.evidence.unshift({
            type: "Possible face match",
            description: "Biometric clue only. Review clinical evidence before confirming identity.",
            sourceTable: "patient_face_profiles",
            key: "face",
            score: 0,
          });
        }
      }
      candidates.sort((a, b) => a.faceDistance - b.faceDistance || b.rawScore - a.rawScore);
    }


    /*
     * Search is audited.
     *
     * emergency_case_id may be NULL for a standalone
     * EHR search.
     */
    await pool.query(
      `
        INSERT INTO public.ecis_search_logs (
          emergency_case_id,
          searched_by,
          search_criteria,
          result_count,
          candidate_patient_ids
        )
        VALUES ($1, $2, $3, $4, $5::BIGINT[]);
      `,
      [
        emergencyCaseId,
        req.user.userId,
        JSON.stringify({
          ...directCriteria,
          faceClueUsed: faceSearch,
        }),
        candidates.length,
        candidates.map((candidate) => candidate.patientId),
      ],
    );


    return res.status(200).json({
      success: true,

      message:
        "ECIS candidate search completed successfully",

      emergencyCase:
        emergencyCase
          ? {
              emergencyCaseId:
                emergencyCase
                  .emergency_case_id,

              caseNumber:
                emergencyCase
                  .case_number,

              hospitalId:
                emergencyCase
                  .hospital_id,

              patientId:
                emergencyCase
                  .patient_id,

              status:
                emergencyCase
                  .status,

              unidentifiedPatient:
                emergencyCase
                  .unidentified_patient,
            }
          : null,

      resultCount:
        candidates.length,

      weightModel:
        serviceResult?.weightModel ||
        null,

      candidates,
    });
  } catch (error) {
    console.error(
      "ECIS search error:",
      error,
    );

    return res.status(error.statusCode || 500).json({
      success: false,

      message:
        error.expose ? error.message : "Failed to perform ECIS candidate search",

      error:
        error.expose ? error.message : undefined,
    });
  }
};


module.exports = {
  searchECISCandidates,
};
