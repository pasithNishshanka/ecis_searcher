<template>
  <div>
    <PageHeader
      eyebrow="Diagnostic services"
      title="Radiology / Imaging"
      description="Request imaging studies, record radiology findings and maintain verified imaging history in the patient's longitudinal EHR."
    >
      <BaseButton
        :disabled="
          !selectedPatient ||
          !selectedEncounter ||
          loading
        "
        @click="openOrderForm"
      >
        <template #icon>
          <Plus :size="16" />
        </template>

        New imaging request
      </BaseButton>
    </PageHeader>


    <div
      v-if="error"
      class="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
    >
      {{ error }}
    </div>


    <div
      class="grid gap-6 xl:grid-cols-[340px_1fr]"
    >
      <!-- ===================================================
           LEFT SIDE
           =================================================== -->

      <aside class="space-y-5">
        <section class="card p-5">
          <h2 class="section-title text-base">
            Select patient
          </h2>

          <p class="muted mt-1">
            Radiology records are linked to the same EHR patient and encounter used by the hospital workflow.
          </p>

          <PatientLookup
            v-model="selectedPatient"
            :patients="patients"
            class="mt-4"
            label=""
            placeholder="Search name / ID / NIC"
          />
        </section>


        <section
          v-if="selectedPatient"
          class="card p-5"
        >
          <div
            class="rounded-xl bg-teal-50 p-4"
          >
            <p
              class="text-xs font-black uppercase tracking-wider text-teal-700"
            >
              Patient
            </p>

            <p
              class="mt-1 font-black text-teal-950"
            >
              {{
                selectedPatient.firstName
              }}
              {{
                selectedPatient.lastName
              }}
            </p>

            <p
              class="text-xs text-teal-800"
            >
              {{
                selectedPatient.patientNumber
              }}
            </p>
          </div>


          <div class="mt-5">
            <h3 class="text-sm font-bold">
              Clinical encounter
            </h3>

            <p
              class="mt-1 text-xs text-slate-400"
            >
              Imaging must belong to an existing encounter.
            </p>
          </div>


          <div
            v-if="loadingEncounters"
            class="mt-4 text-sm text-slate-400"
          >
            Loading encounters...
          </div>


          <div
            v-else-if="encounters.length"
            class="mt-4 space-y-2"
          >
            <button
              v-for="encounter in encounters"
              :key="encounter.encounter_id"
              type="button"
              class="w-full rounded-xl border p-3 text-left transition"
              :class="
                selectedEncounter?.encounter_id ===
                encounter.encounter_id
                  ? 'border-teal-300 bg-teal-50'
                  : 'border-slate-200 hover:border-teal-200'
              "
              @click="
                selectEncounter(
                  encounter,
                )
              "
            >
              <div
                class="flex items-center justify-between gap-2"
              >
                <span
                  class="font-bold text-slate-900"
                >
                  {{
                    encounterTypeLabel(
                      encounter.encounter_type,
                    )
                  }}
                </span>

                <span
                  class="text-[11px] text-slate-400"
                >
                  {{
                    formatDate(
                      encounter.encounter_date,
                    )
                  }}
                </span>
              </div>

              <p
                class="mt-1 text-xs text-slate-500"
              >
                {{
                  encounter.status ||
                  "Encounter"
                }}

                <span
                  v-if="
                    encounter.admission_number
                  "
                >
                  ·
                  {{
                    encounter.admission_number
                  }}
                </span>
              </p>

              <p
                v-if="
                  encounter.ward_name ||
                  encounter.bed_number
                "
                class="mt-1 text-xs text-slate-400"
              >
                {{
                  encounter.ward_name ||
                  "Ward"
                }}

                <span
                  v-if="
                    encounter.bed_number
                  "
                >
                  · Bed
                  {{
                    encounter.bed_number
                  }}
                </span>
              </p>
            </button>
          </div>


          <div
            v-else
            class="mt-4 rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-400"
          >
            No encounters found for this patient.
          </div>
        </section>


        <section
          v-if="selectedPatient"
          class="card p-5"
        >
          <div
            class="flex items-center gap-3"
          >
            <div
              class="grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-600"
            >
              <ScanLine
                :size="18"
              />
            </div>

            <div>
              <p class="label">
                EHR source
              </p>

              <p
                class="mt-1 text-sm font-bold text-slate-800"
              >
                Existing investigations table
              </p>
            </div>
          </div>

          <p
            class="mt-3 text-xs leading-5 text-slate-500"
          >
            Imaging uses investigation records with type
            <b>IMAGING</b>,
            keeping radiology evidence in the same longitudinal data source used by ECIS.
          </p>
        </section>
      </aside>


      <!-- ===================================================
           RIGHT SIDE
           =================================================== -->

      <main>
        <section
          class="card overflow-hidden"
        >
          <div class="border-b p-5">
            <div
              class="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"
            >
              <div>
                <div
                  class="flex flex-wrap items-center gap-2"
                >
                  <span
                    class="badge bg-teal-50 text-teal-700"
                  >
                    Radiology
                  </span>

                  <span
                    v-if="selectedEncounter"
                    class="badge bg-slate-100 text-slate-600"
                  >
                    {{
                      encounterTypeLabel(
                        selectedEncounter.encounter_type,
                      )
                    }}
                  </span>
                </div>

                <h2
                  class="mt-2 section-title"
                >
                  Imaging history
                </h2>

                <p class="muted">
                  {{
                    selectedPatient?.firstName ||
                    "Select a patient"
                  }}
                  {{
                    selectedPatient?.lastName ||
                    ""
                  }}
                </p>
              </div>


              <BaseButton
                variant="secondary"
                size="sm"
                :disabled="
                  loadingOrders ||
                  !selectedPatient
                "
                @click="
                  loadOrders
                "
              >
                Refresh
              </BaseButton>
            </div>
          </div>


          <div
            v-if="loadingOrders"
            class="p-10 text-center text-sm text-slate-400"
          >
            Loading radiology history...
          </div>


          <div
            v-else-if="orders.length"
            class="divide-y divide-slate-100"
          >
            <article
              v-for="order in orders"
              :key="
                order.investigation_id
              "
              class="p-5"
            >
              <div
                class="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"
              >
                <div>
                  <div
                    class="flex flex-wrap items-center gap-2"
                  >
                    <span
                      class="badge bg-teal-50 text-teal-700"
                    >
                      {{
                        order.investigation_name
                      }}
                    </span>

                    <span
                      class="badge"
                      :class="
                        statusClass(
                          order.status,
                        )
                      "
                    >
                      {{
                        statusLabel(
                          order.status,
                        )
                      }}
                    </span>

                    <span
                      class="badge"
                      :class="
                        priorityClass(
                          order.priority,
                        )
                      "
                    >
                      {{
                        order.priority
                      }}
                    </span>
                  </div>

                  <p
                    class="mt-2 text-xs text-slate-400"
                  >
                    Requested
                    {{
                      formatDate(
                        order.requested_date,
                      )
                    }}

                    <span
                      v-if="
                        order.requested_by_name
                      "
                    >
                      ·
                      {{
                        order.requested_by_name
                      }}
                    </span>
                  </p>
                </div>


                <BaseButton
                  v-if="
                    order.status ===
                      'REQUESTED' ||
                    order.status ===
                      'COLLECTED' ||
                    order.status ===
                      'IN_PROCESS'
                  "
                  size="sm"
                  @click="
                    openReportForm(
                      order,
                    )
                  "
                >
                  Record report
                </BaseButton>


                <BaseButton
                  v-else-if="
                    order.status ===
                    'RESULTED'
                  "
                  size="sm"
                  @click="
                    openReportForm(
                      order,
                    )
                  "
                >
                  Review report
                </BaseButton>
              </div>


              <div
                class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
              >
                <div
                  class="rounded-xl bg-slate-50 p-3"
                >
                  <p class="label">
                    Body site
                  </p>

                  <p
                    class="mt-1 text-sm font-bold text-slate-800"
                  >
                    {{
                      order.body_site ||
                      "—"
                    }}
                  </p>
                </div>


                <div
                  class="rounded-xl bg-slate-50 p-3"
                >
                  <p class="label">
                    Performed
                  </p>

                  <p
                    class="mt-1 text-sm font-bold text-slate-800"
                  >
                    {{
                      formatDate(
                        order.performed_date,
                      )
                    }}
                  </p>
                </div>


                <div
                  class="rounded-xl bg-slate-50 p-3"
                >
                  <p class="label">
                    Report reference
                  </p>

                  <p
                    class="mt-1 text-sm font-bold text-slate-800"
                  >
                    {{
                      order.report_reference ||
                      "—"
                    }}
                  </p>
                </div>


                <div
                  class="rounded-xl bg-slate-50 p-3"
                >
                  <p class="label">
                    Verified
                  </p>

                  <p
                    class="mt-1 text-sm font-bold text-slate-800"
                  >
                    {{
                      formatDate(
                        order.verified_at,
                      )
                    }}
                  </p>
                </div>
              </div>


              <div
                v-if="
                  order.result_summary
                "
                class="mt-4 rounded-xl bg-teal-50/60 p-4"
              >
                <div
                  class="flex items-center justify-between gap-3"
                >
                  <p class="label">
                    Radiology findings / impression
                  </p>

                  <span
                    v-if="
                      order.verified_by_name
                    "
                    class="text-[11px] font-semibold text-emerald-700"
                  >
                    Verified by
                    {{
                      order.verified_by_name
                    }}
                  </span>
                </div>

                <p
                  class="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700"
                >
                  {{
                    order.result_summary
                  }}
                </p>
              </div>


              <div
                v-if="
                  order.clinical_notes
                "
                class="mt-3 rounded-xl bg-slate-50 p-4"
              >
                <p class="label">
                  Clinical notes
                </p>

                <p
                  class="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700"
                >
                  {{
                    order.clinical_notes
                  }}
                </p>
              </div>


              <div
                class="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4"
              >
                <p class="text-xs text-slate-400">
                  <span
                    v-if="
                      order.performed_by_name
                    "
                  >
                    Performed by
                    {{
                      order.performed_by_name
                    }}
                  </span>

                  <span
                    v-if="
                      order.verified_by_name
                    "
                  >
                    · Verified by
                    {{
                      order.verified_by_name
                    }}
                  </span>
                </p>

                <BaseButton
                  v-if="
                    order.status ===
                    'RESULTED'
                  "
                  variant="secondary"
                  size="sm"
                  @click="
                    verifyOrder(
                      order,
                    )
                  "
                >
                  <template #icon>
                    <CheckCircle2
                      :size="15"
                    />
                  </template>

                  Verify report
                </BaseButton>
              </div>
            </article>
          </div>


          <div
            v-else
            class="p-12 text-center"
          >
            <div
              class="mx-auto grid size-12 place-items-center rounded-2xl bg-teal-50 text-teal-700"
            >
              <ScanLine
                :size="24"
              />
            </div>

            <h3
              class="mt-4 font-bold"
            >
              No imaging records yet
            </h3>

            <p
              class="mx-auto mt-1 max-w-md text-sm text-slate-400"
            >
              Select a patient and encounter, then create the first radiology request.
            </p>
          </div>
        </section>
      </main>
    </div>


    <!-- =====================================================
         NEW REQUEST
         ===================================================== -->

    <Modal
      :open="
        orderFormOpen
      "
      title="New radiology / imaging request"
      description="Create an imaging request linked to the selected EHR encounter."
      @close="
        closeOrderForm
      "
    >
      <form
        class="grid gap-4 sm:grid-cols-2"
        @submit.prevent="
          saveOrder
        "
      >
        <div
          class="sm:col-span-2 rounded-xl bg-teal-50 p-4"
        >
          <p
            class="text-xs font-black uppercase tracking-wider text-teal-700"
          >
            Encounter
          </p>

          <p
            class="mt-1 font-black text-teal-950"
          >
            {{
              encounterTypeLabel(
                selectedEncounter?.encounter_type,
              )
            }}
          </p>

          <p class="text-xs text-teal-800">
            {{
              formatDate(
                selectedEncounter?.encounter_date,
              )
            }}
          </p>
        </div>


        <FormField
          label="Imaging study"
          required
        >
          <BaseInput
            v-model="
              orderForm.investigationName
            "
            required
            maxlength="200"
            placeholder="X-Ray Chest PA View"
            :disabled="
              savingOrder
            "
          />
        </FormField>


        <FormField
          label="Priority"
          required
        >
          <BaseSelect
            v-model="
              orderForm.priority
            "
            required
            :disabled="
              savingOrder
            "
          >
            <option value="ROUTINE">
              Routine
            </option>

            <option value="NORMAL">
              Normal
            </option>

            <option value="URGENT">
              Urgent
            </option>

            <option value="STAT">
              STAT
            </option>
          </BaseSelect>
        </FormField>


        <FormField label="Body site">
          <BaseInput
            v-model="
              orderForm.bodySite
            "
            maxlength="160"
            placeholder="Chest / right humerus / brain"
            :disabled="
              savingOrder
            "
          />
        </FormField>


        <FormField label="Clinical indication">
          <BaseInput
            v-model="
              orderForm.clinicalNotes
            "
            placeholder="Reason for imaging"
            :disabled="
              savingOrder
            "
          />
        </FormField>


        <div
          class="sm:col-span-2 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500"
        >
          The authenticated hospital user is recorded automatically as the requester.
        </div>


        <div
          class="sm:col-span-2 flex justify-end gap-2 border-t pt-4"
        >
          <BaseButton
            type="button"
            variant="secondary"
            :disabled="
              savingOrder
            "
            @click="
              closeOrderForm
            "
          >
            Cancel
          </BaseButton>

          <BaseButton
            type="submit"
            :disabled="
              savingOrder ||
              !canSaveOrder
            "
          >
            {{
              savingOrder
                ? "Requesting..."
                : "Create request"
            }}
          </BaseButton>
        </div>
      </form>
    </Modal>


    <!-- =====================================================
         REPORT
         ===================================================== -->

    <Modal
      :open="
        reportFormOpen
      "
      :title="
        selectedOrder
          ? `Radiology report · ${selectedOrder.investigation_name}`
          : 'Radiology report'
      "
      description="Record the radiology findings and impression. Verification remains a separate controlled step."
      @close="
        closeReportForm
      "
    >
      <form
        class="grid gap-4 sm:grid-cols-2"
        @submit.prevent="
          saveReport
        "
      >
        <div
          class="sm:col-span-2 rounded-xl bg-slate-50 p-4"
        >
          <div
            class="flex flex-wrap items-center gap-2"
          >
            <span
              class="badge bg-teal-50 text-teal-700"
            >
              {{
                selectedOrder?.investigation_name
              }}
            </span>

            <span
              v-if="
                selectedOrder
              "
              class="badge"
              :class="
                statusClass(
                  selectedOrder.status,
                )
              "
            >
              {{
                statusLabel(
                  selectedOrder.status,
                )
              }}
            </span>
          </div>

          <p
            class="mt-2 text-xs text-slate-500"
          >
            Requested
            {{
              formatDate(
                selectedOrder?.requested_date,
              )
            }}
          </p>
        </div>


        <FormField
          label="Performed date"
          required
        >
          <BaseInput
            v-model="
              reportForm.performedDate
            "
            type="datetime-local"
            required
            :disabled="
              savingReport
            "
          />
        </FormField>


        <FormField label="Report reference">
          <BaseInput
            v-model="
              reportForm.reportReference
            "
            maxlength="120"
            placeholder="RAD-2026-0001"
            :disabled="
              savingReport
            "
          />
        </FormField>


        <div
          class="sm:col-span-2"
        >
          <FormField
            label="Findings / impression"
            required
          >
            <BaseTextarea
              v-model="
                reportForm.reportText
              "
              rows="8"
              required
              placeholder="Findings: ...&#10;&#10;Impression: ..."
              :disabled="
                savingReport
              "
            />
          </FormField>
        </div>


        <div
          class="sm:col-span-2"
        >
          <FormField
            label="Clinical notes"
          >
            <BaseTextarea
              v-model="
                reportForm.clinicalNotes
              "
              rows="4"
              placeholder="Additional radiology notes..."
              :disabled="
                savingReport
              "
            />
          </FormField>
        </div>


        <div
          class="sm:col-span-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900"
        >
          Saving the report changes the order to
          <b>RESULTED</b>.
          A separate verification action is required to move it to
          <b>VERIFIED</b>.
        </div>


        <div
          class="sm:col-span-2 flex justify-end gap-2 border-t pt-4"
        >
          <BaseButton
            type="button"
            variant="secondary"
            :disabled="
              savingReport
            "
            @click="
              closeReportForm
            "
          >
            Cancel
          </BaseButton>

          <BaseButton
            type="submit"
            :disabled="
              savingReport ||
              !canSaveReport
            "
          >
            {{
              savingReport
                ? "Saving..."
                : "Save report"
            }}
          </BaseButton>
        </div>
      </form>
    </Modal>
  </div>
</template>


<script setup lang="ts">
import {
  computed,
  reactive,
  ref,
  watch,
} from "vue";

import {
  CheckCircle2,
  Plus,
  ScanLine,
} from "lucide-vue-next";

import PageHeader
  from "../components/PageHeader.vue";

import Modal
  from "../components/Modal.vue";

import PatientLookup
  from "../components/patient/PatientLookup.vue";

import FormField
  from "../components/forms/FormField.vue";

import BaseButton
  from "../components/ui/BaseButton.vue";

import BaseInput
  from "../components/ui/BaseInput.vue";

import BaseSelect
  from "../components/ui/BaseSelect.vue";

import BaseTextarea
  from "../components/ui/BaseTextarea.vue";

import {
  apiGet,
  apiPost,
  apiPut,
} from "../services/api";

import {
  useEHR,
} from "../stores/ehr";


const {
  patients,
} =
  useEHR();


const selectedPatient =
  ref<any>(null);

const selectedEncounter =
  ref<any>(null);

const selectedOrder =
  ref<any>(null);


const encounters =
  ref<any[]>([]);

const orders =
  ref<any[]>([]);


const loadingEncounters =
  ref(false);

const loadingOrders =
  ref(false);

const savingOrder =
  ref(false);

const savingReport =
  ref(false);

const loading =
  ref(false);

const error =
  ref("");


const orderFormOpen =
  ref(false);

const reportFormOpen =
  ref(false);


const orderForm =
  reactive({
    investigationName:
      "",

    priority:
      "NORMAL",

    bodySite:
      "",

    clinicalNotes:
      "",
  });


const reportForm =
  reactive({
    performedDate:
      getDefaultDateTime(),

    reportText:
      "",

    reportReference:
      "",

    clinicalNotes:
      "",
  });


const canSaveOrder =
  computed(() => {
    return Boolean(
      selectedPatient.value?.id &&
        selectedEncounter.value
          ?.encounter_id &&
        orderForm.investigationName.trim(),
    );
  });


const canSaveReport =
  computed(() => {
    return Boolean(
      selectedOrder.value
        ?.investigation_id &&
        reportForm.performedDate &&
        reportForm.reportText.trim(),
    );
  });


function getDefaultDateTime() {
  const now =
    new Date();

  const offset =
    now.getTimezoneOffset() *
    60000;

  return new Date(
    now.getTime() -
      offset,
  )
    .toISOString()
    .slice(
      0,
      16,
    );
}


function formatDate(
  value:
    | string
    | null
    | undefined,
) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return date.toLocaleString(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  );
}


function encounterTypeLabel(
  type:
    | string
    | null
    | undefined,
) {
  const labels:
    Record<
      string,
      string
    > = {
      OPD:
        "OPD",

      CLINIC:
        "Clinic",

      EMERGENCY:
        "Emergency",

      ADMISSION:
        "Inpatient admission",

      WARD:
        "Ward",
    };

  const value =
    String(
      type || "",
    );

  return (
    labels[value] ||
    value
      .replaceAll(
        "_",
        " ",
      )
      .replace(
        /\b\w/g,
        (
          character,
        ) =>
          character.toUpperCase(),
      ) ||
    "Encounter"
  );
}


function statusLabel(
  status:
    | string
    | null
    | undefined,
) {
  const labels:
    Record<
      string,
      string
    > = {
      REQUESTED:
        "Requested",

      COLLECTED:
        "Collected",

      IN_PROCESS:
        "In process",

      RESULTED:
        "Resulted",

      VERIFIED:
        "Verified",

      CANCELLED:
        "Cancelled",
    };

  return (
    labels[
      String(
        status || "",
      )
    ] ||
    String(
      status || "—",
    )
  );
}


function statusClass(
  status:
    | string
    | null
    | undefined,
) {
  switch (status) {
    case "VERIFIED":
      return "bg-emerald-100 text-emerald-700";

    case "RESULTED":
      return "bg-blue-100 text-blue-700";

    case "REQUESTED":
    case "COLLECTED":
    case "IN_PROCESS":
      return "bg-amber-100 text-amber-700";

    case "CANCELLED":
      return "bg-red-100 text-red-700";

    default:
      return "bg-slate-100 text-slate-600";
  }
}


function priorityClass(
  priority:
    | string
    | null
    | undefined,
) {
  switch (priority) {
    case "STAT":
      return "bg-red-100 text-red-700";

    case "URGENT":
      return "bg-orange-100 text-orange-700";

    case "ROUTINE":
      return "bg-slate-100 text-slate-600";

    default:
      return "bg-blue-50 text-blue-700";
  }
}


async function loadPatientData() {
  if (
    !selectedPatient.value?.id
  ) {
    encounters.value = [];
    orders.value = [];
    selectedEncounter.value =
      null;
    selectedOrder.value =
      null;

    return;
  }

  loadingEncounters.value =
    true;

  loadingOrders.value =
    true;

  loading.value =
    true;

  error.value =
    "";

  try {
    const patientId =
      Number(
        selectedPatient.value.id,
      );

    const [
      encounterResponse,
      orderResponse,
    ] =
      await Promise.all([
        apiGet<{
          success: boolean;
          data: any[];
        }>(
          `/radiology/patients/${patientId}/encounters`,
        ),

        apiGet<{
          success: boolean;
          data: any[];
        }>(
          `/radiology/patients/${patientId}/orders`,
        ),
      ]);

    encounters.value =
      encounterResponse.data ||
      [];

    orders.value =
      orderResponse.data ||
      [];

    selectedEncounter.value =
      encounters.value.find(
        (
          encounter,
        ) =>
          encounter.admission_status ===
          "ADMITTED",
      ) ||
      encounters.value[0] ||
      null;

    selectedOrder.value =
      null;
  } catch (err) {
    encounters.value =
      [];

    orders.value =
      [];

    selectedEncounter.value =
      null;

    selectedOrder.value =
      null;

    error.value =
      err instanceof Error
        ? err.message
        : "Unable to load radiology data.";
  } finally {
    loadingEncounters.value =
      false;

    loadingOrders.value =
      false;

    loading.value =
      false;
  }
}


async function loadOrders() {
  if (
    !selectedPatient.value?.id
  ) {
    orders.value =
      [];

    return;
  }

  loadingOrders.value =
    true;

  error.value =
    "";

  try {
    const response =
      await apiGet<{
        success: boolean;
        data: any[];
      }>(
        `/radiology/patients/${Number(
          selectedPatient.value.id,
        )}/orders`,
      );

    orders.value =
      response.data ||
      [];
  } catch (err) {
    error.value =
      err instanceof Error
        ? err.message
        : "Unable to load radiology history.";
  } finally {
    loadingOrders.value =
      false;
  }
}


function selectEncounter(
  encounter: any,
) {
  selectedEncounter.value =
    encounter;
}


function resetOrderForm() {
  Object.assign(
    orderForm,
    {
      investigationName:
        "",

      priority:
        "NORMAL",

      bodySite:
        "",

      clinicalNotes:
        "",
    },
  );
}


function openOrderForm() {
  if (
    !selectedEncounter.value
  ) {
    error.value =
      "Select a clinical encounter before creating a radiology request.";

    return;
  }

  error.value =
    "";

  resetOrderForm();

  orderFormOpen.value =
    true;
}


function closeOrderForm() {
  if (
    savingOrder.value
  ) {
    return;
  }

  orderFormOpen.value =
    false;

  resetOrderForm();
}


async function saveOrder() {
  if (
    !canSaveOrder.value
  ) {
    return;
  }

  savingOrder.value =
    true;

  error.value =
    "";

  try {
    await apiPost(
      "/radiology/orders",
      {
        patientId:
          Number(
            selectedPatient.value.id,
          ),

        encounterId:
          Number(
            selectedEncounter.value
              .encounter_id,
          ),

        investigationName:
          orderForm.investigationName.trim(),

        priority:
          orderForm.priority,

        bodySite:
          orderForm.bodySite.trim() ||
          null,

        clinicalNotes:
          orderForm.clinicalNotes.trim() ||
          null,
      },
    );

    orderFormOpen.value =
      false;

    resetOrderForm();

    await loadOrders();
  } catch (err) {
    error.value =
      err instanceof Error
        ? err.message
        : "Unable to create radiology request.";
  } finally {
    savingOrder.value =
      false;
  }
}


function resetReportForm(
  order: any,
) {
  Object.assign(
    reportForm,
    {
      performedDate:
        order?.performed_date
          ? toLocalDateTime(
              order.performed_date,
            )
          : getDefaultDateTime(),

      reportText:
        order?.result_summary ||
        "",

      reportReference:
        order?.report_reference ||
        "",

      clinicalNotes:
        order?.clinical_notes ||
        "",
    },
  );
}


function toLocalDateTime(
  value: string,
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return getDefaultDateTime();
  }

  const offset =
    date.getTimezoneOffset() *
    60000;

  return new Date(
    date.getTime() -
      offset,
  )
    .toISOString()
    .slice(
      0,
      16,
    );
}


function openReportForm(
  order: any,
) {
  selectedOrder.value =
    order;

  resetReportForm(
    order,
  );

  reportFormOpen.value =
    true;

  error.value =
    "";
}


function closeReportForm() {
  if (
    savingReport.value
  ) {
    return;
  }

  reportFormOpen.value =
    false;

  selectedOrder.value =
    null;
}


async function saveReport() {
  if (
    !canSaveReport.value ||
    !selectedOrder.value
  ) {
    return;
  }

  savingReport.value =
    true;

  error.value =
    "";

  try {
    await apiPut(
      `/radiology/orders/${Number(
        selectedOrder.value
          .investigation_id,
      )}/report`,
      {
        performedDate:
          reportForm.performedDate,

        reportText:
          reportForm.reportText.trim(),

        reportReference:
          reportForm.reportReference.trim() ||
          null,

        clinicalNotes:
          reportForm.clinicalNotes.trim() ||
          null,
      },
    );

    reportFormOpen.value =
      false;

    selectedOrder.value =
      null;

    await loadOrders();
  } catch (err) {
    error.value =
      err instanceof Error
        ? err.message
        : "Unable to record radiology report.";
  } finally {
    savingReport.value =
      false;
  }
}


async function verifyOrder(
  order: any,
) {
  if (
    !order?.investigation_id
  ) {
    return;
  }

  error.value =
    "";

  try {
    await apiPost(
      `/radiology/orders/${Number(
        order.investigation_id,
      )}/verify`,
      {},
    );

    await loadOrders();
  } catch (err) {
    error.value =
      err instanceof Error
        ? err.message
        : "Unable to verify radiology report.";
  }
}


watch(
  () =>
    selectedPatient.value?.id,

  () => {
    void loadPatientData();
  },
);
</script>