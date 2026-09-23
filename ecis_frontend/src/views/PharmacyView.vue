<template>
  <div class="space-y-6">

    <!-- =====================================================
         PAGE HEADER
         ===================================================== -->

    <PageHeader
      title="Pharmacy"
      description="Manage medication orders, dispensing and longitudinal medication history."
    />


    <!-- =====================================================
         ERROR
         ===================================================== -->

    <div
      v-if="error"
      class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
    >
      <div
        class="flex items-start justify-between gap-4"
      >
        <p>
          {{ error }}
        </p>

        <button
          type="button"
          class="text-xs font-bold text-red-700 underline"
          @click="error = ''"
        >
          Dismiss
        </button>
      </div>
    </div>


    <!-- =====================================================
         PATIENT SELECTION
         ===================================================== -->

    <section class="card p-5">

      <div>
        <h2 class="section-title">
          Select patient
        </h2>

        <p class="muted mt-1">
          Select an existing adult patient to view medication
          history and manage medication orders.
        </p>
      </div>


      <div class="mt-4">
        <PatientLookup
          v-model="selectedPatient"
          :patients="patients"
          label=""
          placeholder="Search name / ID / NIC"
        />
      </div>

    </section>


    <!-- =====================================================
         PATIENT SUMMARY + ADMISSION
         ===================================================== -->

    <section
      v-if="selectedPatient"
      class="card overflow-hidden"
    >

      <!-- Patient -->
      <div class="border-b p-5">

        <div class="rounded-xl bg-teal-50 p-4">

          <div
            class="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"
          >

            <div>

              <p
                class="text-xs font-black uppercase tracking-wider text-teal-700"
              >
                Patient
              </p>

              <h2
                class="mt-1 text-lg font-black text-teal-950"
              >
                {{ patientFullName }}
              </h2>

              <p
                class="mt-1 text-sm text-teal-800"
              >
                {{ selectedPatient.patientNumber || "No patient number" }}
              </p>

            </div>


            <div
              class="rounded-lg bg-white/70 px-3 py-2 text-right"
            >

              <p
                class="text-[10px] font-black uppercase tracking-wider text-slate-400"
              >
                Age
              </p>

              <p
                class="mt-1 text-sm font-black text-slate-800"
              >
                {{
                  patientAge !== null
                    ? `${patientAge} years`
                    : "—"
                }}
              </p>

            </div>

          </div>

        </div>

      </div>


      <!-- ===================================================
           ADMISSION
           =================================================== -->

      <div class="border-b p-5">

        <div
          class="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"
        >

          <div>

            <h3 class="section-title text-base">
              Encounter / Admission
            </h3>

            <p class="muted mt-1">
              Select the inpatient admission to which this
              medication order will be attached.
            </p>

          </div>


          <button
            type="button"
            class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-teal-200 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="loadingAdmissions"
            @click="loadAdmissions"
          >
            Refresh
          </button>

        </div>


        <!-- Loading -->
        <div
          v-if="loadingAdmissions"
          class="mt-4 rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-400"
        >
          Loading admissions...
        </div>


        <!-- Admissions -->
        <div
          v-else-if="admissions.length"
          class="mt-4 space-y-2"
        >

          <button
            v-for="admission in admissions"
            :key="getAdmissionKey(admission)"
            type="button"
            class="w-full rounded-xl border p-4 text-left transition"
            :class="
              getAdmissionId(selectedAdmission) ===
              getAdmissionId(admission)
                ? 'border-teal-300 bg-teal-50'
                : 'border-slate-200 hover:border-teal-200 hover:bg-slate-50'
            "
            @click="selectAdmission(admission)"
          >

            <div
              class="flex flex-col justify-between gap-2 sm:flex-row sm:items-center"
            >

              <div>

                <p
                  class="font-bold text-slate-900"
                >
                  {{
                    admission.admissionNumber ||
                    admission.admission_number ||
                    `Admission #${getAdmissionId(admission)}`
                  }}
                </p>


                <p
                  class="mt-1 text-xs text-slate-500"
                >
                  {{
                    admission.wardName ||
                    admission.ward_name ||
                    "Ward"
                  }}

                  <span
                    v-if="
                      admission.bedNumber ||
                      admission.bed_number
                    "
                  >
                    · Bed
                    {{
                      admission.bedNumber ||
                      admission.bed_number
                    }}
                  </span>
                </p>


                <p
                  class="mt-1 text-[11px] text-slate-400"
                >
                  Admitted:
                  {{
                    formatDate(
                      admission.admissionDate ||
                      admission.admission_date,
                    )
                  }}
                </p>

              </div>


              <span
                class="badge"
                :class="
                  admission.status === 'ADMITTED'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-emerald-100 text-emerald-700'
                "
              >
                {{ admission.status || "UNKNOWN" }}
              </span>

            </div>

          </button>

        </div>


        <!-- Empty -->
        <div
          v-else
          class="mt-4 rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-400"
        >
          No admissions found for this patient.
        </div>

      </div>


      <!-- ===================================================
           MEDICATION ACTION
           =================================================== -->

      <div
        class="flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center"
      >

        <div>

          <h3 class="section-title text-base">
            Medication management
          </h3>

          <p class="muted mt-1">
            Create medication orders and manage pharmacy
            dispensing for the selected admission.
          </p>

        </div>


        <button
          type="button"
          class="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="
            !selectedPatient ||
            !selectedAdmission ||
            selectedAdmission.status !== 'ADMITTED'
          "
          @click="openOrderForm"
        >
          Create medication order
        </button>

      </div>

    </section>


    <!-- =====================================================
         MEDICATION HISTORY
         ===================================================== -->

    <section
      v-if="selectedPatient"
      class="card overflow-hidden"
    >

      <div
        class="flex flex-col justify-between gap-3 border-b p-5 sm:flex-row sm:items-center"
      >

        <div>

          <h2 class="section-title">
            Medication history
          </h2>

          <p class="muted mt-1">
            Existing medication orders and dispensing history
            for the selected patient.
          </p>

        </div>


        <button
          type="button"
          class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-teal-200 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="loadingOrders"
          @click="loadOrders"
        >
          Refresh
        </button>

      </div>


      <!-- Loading -->
      <div
        v-if="loadingOrders"
        class="p-10 text-center text-sm text-slate-400"
      >
        Loading medication history...
      </div>


      <!-- Orders -->
      <div
        v-else-if="orders.length"
        class="divide-y divide-slate-100"
      >

        <article
          v-for="order in orders"
          :key="order.medication_order_id"
          class="p-5"
        >

          <div
            class="flex flex-col justify-between gap-5 xl:flex-row xl:items-start"
          >

            <!-- =================================================
                 MEDICATION
                 ================================================= -->

            <div class="min-w-0 flex-1">

              <div
                class="flex flex-wrap items-center gap-2"
              >

                <span
                  class="badge bg-teal-50 text-teal-700"
                >
                  MEDICATION
                </span>


                <span
                  class="badge"
                  :class="
                    statusClass(
                      order.order_status,
                    )
                  "
                >
                  {{
                    formatStatus(
                      order.order_status,
                    )
                  }}
                </span>

              </div>


              <h3
                class="mt-2 text-base font-black text-slate-900"
              >
                {{ order.medication_name }}
              </h3>


              <p
                v-if="order.strength"
                class="mt-1 text-sm font-medium text-slate-600"
              >
                {{ order.strength }}
              </p>


              <!-- Main information -->
              <div
                class="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
              >

                <InfoBox
                  label="Dosage"
                  :value="order.dosage"
                />

                <InfoBox
                  label="Frequency"
                  :value="order.frequency"
                />

                <InfoBox
                  label="Route"
                  :value="order.route || '—'"
                />

                <InfoBox
                  label="Quantity"
                  :value="formatQuantity(order)"
                />

              </div>


              <!-- Duration -->
              <div
                class="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
              >

                <InfoBox
                  label="Duration"
                  :value="formatDuration(order)"
                />

                <InfoBox
                  label="Start date"
                  :value="formatDate(order.start_date)"
                />

                <InfoBox
                  label="End date"
                  :value="formatDate(order.end_date)"
                />

              </div>


              <!-- Indication -->
              <div
                v-if="order.indication"
                class="mt-4 rounded-xl bg-slate-50 p-4"
              >

                <p class="label">
                  Indication
                </p>

                <p
                  class="mt-1 whitespace-pre-line text-sm leading-6 text-slate-700"
                >
                  {{ order.indication }}
                </p>

              </div>


              <!-- Instructions -->
              <div
                v-if="order.instructions"
                class="mt-2 rounded-xl bg-slate-50 p-4"
              >

                <p class="label">
                  Instructions
                </p>

                <p
                  class="mt-1 whitespace-pre-line text-sm leading-6 text-slate-700"
                >
                  {{ order.instructions }}
                </p>

              </div>


              <!-- Notes -->
              <div
                v-if="order.prescribed_notes"
                class="mt-2 rounded-xl bg-slate-50 p-4"
              >

                <p class="label">
                  Prescriber notes
                </p>

                <p
                  class="mt-1 whitespace-pre-line text-sm leading-6 text-slate-700"
                >
                  {{ order.prescribed_notes }}
                </p>

              </div>

            </div>


            <!-- =================================================
                 RIGHT SIDE
                 ================================================= -->

            <div
              class="w-full xl:max-w-sm"
            >

              <div
                class="rounded-xl border border-slate-200 bg-slate-50 p-4"
              >

                <p class="label">
                  Encounter
                </p>

                <p
                  class="mt-1 text-sm font-bold text-slate-800"
                >
                  {{ order.encounter_type || "Encounter" }}
                </p>

                <p
                  class="mt-1 text-xs text-slate-500"
                >
                  {{ formatDate(order.encounter_date) }}
                </p>


                <div
                  v-if="order.admission_number"
                  class="mt-3 border-t border-slate-200 pt-3"
                >

                  <p class="label">
                    Admission
                  </p>

                  <p
                    class="mt-1 text-sm font-bold text-slate-800"
                  >
                    {{ order.admission_number }}
                  </p>

                </div>


                <div
                  class="mt-3 border-t border-slate-200 pt-3"
                >

                  <p class="label">
                    Prescribed by
                  </p>

                  <p
                    class="mt-1 text-sm font-bold text-slate-800"
                  >
                    {{ order.prescriber_name || "—" }}
                  </p>

                </div>


                <div
                  class="mt-3 border-t border-slate-200 pt-3"
                >

                  <p class="label">
                    Dispensed
                  </p>

                  <p
                    class="mt-1 text-sm font-black text-slate-800"
                  >
                    {{ formatDispensed(order) }}
                  </p>

                  <p
                    v-if="order.last_dispensed_at"
                    class="mt-1 text-[11px] text-slate-400"
                  >
                    Last:
                    {{ formatDate(order.last_dispensed_at) }}
                  </p>

                </div>


                <!-- Actions -->
                <div
                  class="mt-4 flex flex-col gap-2"
                >

                  <button
                    type="button"
                    class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-teal-200 hover:text-teal-700"
                    @click="
                      openDispenseForm(order)
                    "
                  >
                    {{
                      canDispense(order)
                        ? "Dispense"
                        : "View dispensing"
                    }}
                  </button>


                  <button
                    v-if="
                      order.order_status === 'ORDERED' ||
                      order.order_status === 'PARTIALLY_DISPENSED'
                    "
                    type="button"
                    class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-red-200 hover:text-red-700"
                    @click="
                      openCancelForm(order)
                    "
                  >
                    Cancel order
                  </button>

                </div>

              </div>

            </div>

          </div>

        </article>

      </div>


      <!-- Empty -->
      <div
        v-else
        class="p-10 text-center"
      >

        <p
          class="text-sm font-bold text-slate-700"
        >
          No medication orders found
        </p>

        <p
          class="mt-1 text-xs text-slate-400"
        >
          Medication orders will appear here after they
          are created for this patient.
        </p>

      </div>

    </section>


    <!-- =====================================================
         CREATE MEDICATION ORDER MODAL
         ===================================================== -->

    <Modal
      :open="orderFormOpen"
      title="Create medication order"
      description="Create a medication order for the selected inpatient admission."
      @close="closeOrderForm"
    >

      <form
        class="grid gap-4 sm:grid-cols-2"
        @submit.prevent="submitOrder"
      >

        <!-- Patient -->
        <div
          class="sm:col-span-2 rounded-xl bg-teal-50 p-4"
        >

          <p
            class="text-xs font-black uppercase tracking-wider text-teal-700"
          >
            Patient
          </p>

          <p
            class="mt-1 font-black text-teal-950"
          >
            {{ patientFullName }}
          </p>

          <p
            class="text-xs text-teal-800"
          >
            {{
              selectedPatient?.patientNumber ||
              "—"
            }}
          </p>

          <p
            v-if="selectedAdmission"
            class="mt-2 text-xs text-teal-800"
          >
            Admission:
            {{
              selectedAdmission.admissionNumber ||
              selectedAdmission.admission_number ||
              "—"
            }}
          </p>

        </div>


        <!-- Medication -->
        <FormField
          label="Medication name"
        >
          <BaseInput
            v-model="
              orderForm.medicationName
            "
            placeholder="e.g. Amoxicillin"
            :disabled="savingOrder"
          />
        </FormField>


        <!-- Strength -->
        <FormField
          label="Strength"
        >
          <BaseInput
            v-model="
              orderForm.strength
            "
            placeholder="e.g. 500 mg"
            :disabled="savingOrder"
          />
        </FormField>


        <!-- Dosage -->
        <FormField
          label="Dosage"
        >
          <BaseInput
            v-model="
              orderForm.dosage
            "
            placeholder="e.g. 1 tablet"
            :disabled="savingOrder"
          />
        </FormField>


        <!-- Frequency -->
        <FormField
          label="Frequency"
        >
          <BaseInput
            v-model="
              orderForm.frequency
            "
            placeholder="e.g. Three times daily"
            :disabled="savingOrder"
          />
        </FormField>


        <!-- Route -->
        <FormField
          label="Route"
        >
          <BaseSelect
            v-model="
              orderForm.route
            "
            :disabled="savingOrder"
          >

            <option value="">
              Select route
            </option>

            <option value="ORAL">
              Oral
            </option>

            <option value="IV">
              IV
            </option>

            <option value="IM">
              IM
            </option>

            <option value="SC">
              Subcutaneous
            </option>

            <option value="TOPICAL">
              Topical
            </option>

            <option value="INHALATION">
              Inhalation
            </option>

            <option value="RECTAL">
              Rectal
            </option>

            <option value="OTHER">
              Other
            </option>

          </BaseSelect>
        </FormField>


        <!-- Quantity -->
        <FormField
          label="Quantity prescribed"
        >
          <BaseInput
            v-model="
              orderForm.quantityPrescribed
            "
            type="number"
            min="0.001"
            step="0.001"
            placeholder="e.g. 20"
            :disabled="savingOrder"
          />
        </FormField>


        <!-- Quantity unit -->
        <FormField
          label="Quantity unit"
        >
          <BaseSelect
            v-model="
              orderForm.quantityUnit
            "
            :disabled="savingOrder"
          >

            <option value="">
              Select unit
            </option>

            <option value="TABLETS">
              Tablets
            </option>

            <option value="CAPSULES">
              Capsules
            </option>

            <option value="BOTTLES">
              Bottles
            </option>

            <option value="VIALS">
              Vials
            </option>

            <option value="AMPOULES">
              Ampoules
            </option>

            <option value="TUBES">
              Tubes
            </option>

            <option value="ML">
              mL
            </option>

            <option value="OTHER">
              Other
            </option>

          </BaseSelect>
        </FormField>


        <!-- Duration value -->
        <FormField
          label="Duration"
        >
          <BaseInput
            v-model="
              orderForm.durationValue
            "
            type="number"
            min="0.001"
            step="0.001"
            placeholder="e.g. 5"
            :disabled="savingOrder"
          />
        </FormField>


        <!-- Duration unit -->
        <FormField
          label="Duration unit"
        >
          <BaseSelect
            v-model="
              orderForm.durationUnit
            "
            :disabled="savingOrder"
          >

            <option value="">
              Select duration
            </option>

            <option value="DAYS">
              Days
            </option>

            <option value="WEEKS">
              Weeks
            </option>

            <option value="MONTHS">
              Months
            </option>

            <option value="DOSES">
              Doses
            </option>

          </BaseSelect>
        </FormField>


        <!-- Start -->
        <FormField
          label="Start date"
        >
          <BaseInput
            v-model="
              orderForm.startDate
            "
            type="datetime-local"
            :disabled="savingOrder"
          />
        </FormField>


        <!-- End -->
        <FormField
          label="End date"
        >
          <BaseInput
            v-model="
              orderForm.endDate
            "
            type="datetime-local"
            :disabled="savingOrder"
          />
        </FormField>


        <!-- Indication -->
        <div
          class="sm:col-span-2"
        >
          <FormField
            label="Indication"
          >
            <BaseTextarea
              v-model="
                orderForm.indication
              "
              rows="3"
              placeholder="Reason for medication..."
              :disabled="savingOrder"
            />
          </FormField>
        </div>


        <!-- Instructions -->
        <div
          class="sm:col-span-2"
        >
          <FormField
            label="Instructions"
          >
            <BaseTextarea
              v-model="
                orderForm.instructions
              "
              rows="3"
              placeholder="Patient instructions / administration instructions..."
              :disabled="savingOrder"
            />
          </FormField>
        </div>


        <!-- Notes -->
        <div
          class="sm:col-span-2"
        >
          <FormField
            label="Prescriber notes"
          >
            <BaseTextarea
              v-model="
                orderForm.prescribedNotes
              "
              rows="3"
              placeholder="Additional clinical notes..."
              :disabled="savingOrder"
            />
          </FormField>
        </div>


        <!-- Security -->
        <div
          class="sm:col-span-2 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500"
        >
          The authenticated hospital user is recorded by
          the backend as the prescriber.
        </div>


        <!-- Buttons -->
        <div
          class="sm:col-span-2 flex justify-end gap-2 border-t pt-4"
        >

          <button
            type="button"
            class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="savingOrder"
            @click="closeOrderForm"
          >
            Cancel
          </button>


          <button
            type="submit"
            class="rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="
              savingOrder ||
              !canSubmitOrder
            "
          >
            {{
              savingOrder
                ? "Creating..."
                : "Create order"
            }}
          </button>

        </div>

      </form>

    </Modal>


    <!-- =====================================================
         DISPENSE MODAL
         ===================================================== -->

    <Modal
      :open="dispenseFormOpen"
      :title="
        selectedOrderForDispense
          ? `Dispense — ${selectedOrderForDispense.medication_name}`
          : 'Dispense medication'
      "
      description="Review the medication order and record pharmacy dispensing."
      @close="closeDispenseForm"
    >

      <div
        v-if="selectedOrderForDispense"
        class="space-y-4"
      >

        <!-- Order summary -->
        <div
          class="rounded-xl bg-teal-50 p-4"
        >

          <p
            class="text-xs font-black uppercase tracking-wider text-teal-700"
          >
            Medication
          </p>

          <p
            class="mt-1 font-black text-teal-950"
          >
            {{
              selectedOrderForDispense.medication_name
            }}
          </p>

          <p
            v-if="
              selectedOrderForDispense.strength
            "
            class="text-sm text-teal-800"
          >
            {{
              selectedOrderForDispense.strength
            }}
          </p>


          <div
            class="mt-3 grid gap-2 sm:grid-cols-3"
          >

            <InfoBox
              label="Prescribed"
              :value="
                formatQuantity(
                  selectedOrderForDispense,
                )
              "
            />

            <InfoBox
              label="Dispensed"
              :value="
                formatDispensed(
                  selectedOrderForDispense,
                )
              "
            />

            <InfoBox
              label="Status"
              :value="
                formatStatus(
                  selectedOrderForDispense.order_status,
                )
              "
            />

          </div>

        </div>


        <!-- Dispensing history -->
        <div
          v-if="
            selectedOrderDispensations.length
          "
          class="rounded-xl border border-slate-200"
        >

          <div
            class="border-b p-4"
          >
            <h3
              class="text-sm font-black text-slate-900"
            >
              Dispensing history
            </h3>
          </div>


          <div
            class="divide-y divide-slate-100"
          >

            <div
              v-for="
                item in selectedOrderDispensations
              "
              :key="
                item.medication_dispensation_id
              "
              class="p-4"
            >

              <div
                class="flex flex-col justify-between gap-2 sm:flex-row sm:items-center"
              >

                <div>

                  <p
                    class="text-sm font-bold text-slate-800"
                  >
                    {{
                      item.dispensed_quantity
                    }}
                    {{
                      item.quantity_unit
                    }}
                  </p>

                  <p
                    class="mt-1 text-xs text-slate-400"
                  >
                    {{
                      formatDate(
                        item.dispensed_at,
                      )
                    }}
                  </p>

                </div>


                <span
                  class="badge"
                  :class="
                    item.dispensing_status ===
                    'DISPENSED'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-600'
                  "
                >
                  {{
                    item.dispensing_status
                  }}
                </span>

              </div>


              <p
                v-if="item.dispensed_by_name"
                class="mt-2 text-xs text-slate-500"
              >
                Dispensed by:
                <span class="font-semibold">
                  {{
                    item.dispensed_by_name
                  }}
                </span>
              </p>


              <p
                v-if="item.pharmacy_notes"
                class="mt-2 whitespace-pre-line text-xs leading-5 text-slate-500"
              >
                {{
                  item.pharmacy_notes
                }}
              </p>

            </div>

          </div>

        </div>


        <!-- New dispensing -->
        <form
          v-if="
            canDispense(
              selectedOrderForDispense,
            )
          "
          class="grid gap-4 sm:grid-cols-2"
          @submit.prevent="submitDispense"
        >

          <FormField
            label="Dispensed quantity"
          >
            <BaseInput
              v-model="
                dispenseForm.dispensedQuantity
              "
              type="number"
              min="0.001"
              step="0.001"
              placeholder="Quantity"
              :disabled="savingDispense"
            />
          </FormField>


          <FormField
            label="Quantity unit"
          >
            <BaseInput
              v-model="
                dispenseForm.quantityUnit
              "
              :disabled="true"
            />
          </FormField>


          <div
            class="sm:col-span-2"
          >

            <FormField
              label="Dispensed date"
            >
              <BaseInput
                v-model="
                  dispenseForm.dispensedAt
                "
                type="datetime-local"
                :disabled="
                  savingDispense
                "
              />
            </FormField>

          </div>


          <div
            class="sm:col-span-2"
          >

            <FormField
              label="Pharmacy notes"
            >
              <BaseTextarea
                v-model="
                  dispenseForm.pharmacyNotes
                "
                rows="3"
                placeholder="Dispensing notes..."
                :disabled="
                  savingDispense
                "
              />
            </FormField>

          </div>


          <div
            class="sm:col-span-2 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500"
          >
            The authenticated hospital user is recorded by
            the backend as the dispensing staff member.
          </div>


          <div
            class="sm:col-span-2 flex justify-end gap-2 border-t pt-4"
          >

            <button
              type="button"
              class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="
                savingDispense
              "
              @click="closeDispenseForm"
            >
              Close
            </button>


            <button
              type="submit"
              class="rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="
                savingDispense ||
                !canSubmitDispense
              "
            >
              {{
                savingDispense
                  ? "Dispensing..."
                  : "Confirm dispensing"
              }}
            </button>

          </div>

        </form>


        <div
          v-else
          class="flex justify-end border-t pt-4"
        >

          <button
            type="button"
            class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            @click="closeDispenseForm"
          >
            Close
          </button>

        </div>

      </div>

    </Modal>


    <!-- =====================================================
         CANCEL MODAL
         ===================================================== -->

    <Modal
      :open="cancelFormOpen"
      title="Cancel medication order"
      description="Record the reason for cancelling this medication order."
      @close="closeCancelForm"
    >

      <form
        v-if="selectedOrderForCancel"
        class="space-y-4"
        @submit.prevent="submitCancel"
      >

        <div
          class="rounded-xl bg-amber-50 p-4"
        >

          <p
            class="text-xs font-black uppercase tracking-wider text-amber-700"
          >
            Medication order
          </p>

          <p
            class="mt-1 font-black text-amber-950"
          >
            {{
              selectedOrderForCancel.medication_name
            }}
          </p>

          <p
            class="mt-1 text-sm text-amber-800"
          >
            {{
              selectedOrderForCancel.dosage
            }}

            ·

            {{
              selectedOrderForCancel.frequency
            }}
          </p>

        </div>


        <FormField
          label="Cancellation reason"
        >
          <BaseTextarea
            v-model="
              cancelForm.reason
            "
            rows="4"
            placeholder="Enter the reason for cancelling this medication order..."
            :disabled="savingCancel"
          />
        </FormField>


        <div
          class="flex justify-end gap-2 border-t pt-4"
        >

          <button
            type="button"
            class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="savingCancel"
            @click="closeCancelForm"
          >
            Close
          </button>


          <button
            type="submit"
            class="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="
              savingCancel ||
              !cancelForm.reason.trim()
            "
          >
            {{
              savingCancel
                ? "Cancelling..."
                : "Cancel order"
            }}
          </button>

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


import PageHeader
  from "../components/PageHeader.vue";


import Modal
  from "../components/Modal.vue";


import PatientLookup
  from "../components/patient/PatientLookup.vue";


import FormField
  from "../components/forms/FormField.vue";


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


/* ============================================================
   LOCAL COMPONENT
   ============================================================ */

const InfoBox = {
  props: [
    "label",
    "value",
  ],

  template: `
    <div class="rounded-xl bg-white p-3">
      <p class="text-[10px] font-black uppercase tracking-wider text-slate-400">
        {{ label }}
      </p>

      <p class="mt-1 text-sm font-bold text-slate-800">
        {{ value || "—" }}
      </p>
    </div>
  `,
};


/* ============================================================
   STORE
   ============================================================ */

const {
  patients,
  getPatientAdmissions,
} =
  useEHR();


/* ============================================================
   STATE
   ============================================================ */

const selectedPatient =
  ref<any>(null);


const selectedAdmission =
  ref<any>(null);


const admissions =
  ref<any[]>([]);


const orders =
  ref<any[]>([]);


const loadingAdmissions =
  ref(false);


const loadingOrders =
  ref(false);


const savingOrder =
  ref(false);


const savingDispense =
  ref(false);


const savingCancel =
  ref(false);


const error =
  ref("");


const orderFormOpen =
  ref(false);


const dispenseFormOpen =
  ref(false);


const cancelFormOpen =
  ref(false);


const selectedOrderForDispense =
  ref<any>(null);


const selectedOrderForCancel =
  ref<any>(null);


const selectedOrderDispensations =
  ref<any[]>([]);


/* ============================================================
   ORDER FORM
   ============================================================ */

const orderForm =
  reactive({
    medicationName: "",
    strength: "",
    dosage: "",
    route: "",
    frequency: "",
    durationValue: "",
    durationUnit: "",
    quantityPrescribed: "",
    quantityUnit: "",
    indication: "",
    instructions: "",
    prescribedNotes: "",
    startDate: "",
    endDate: "",
  });


/* ============================================================
   DISPENSE FORM
   ============================================================ */

const dispenseForm =
  reactive({
    dispensedQuantity: "",
    quantityUnit: "",
    dispensedAt: "",
    pharmacyNotes: "",
  });


/* ============================================================
   CANCEL FORM
   ============================================================ */

const cancelForm =
  reactive({
    reason: "",
  });


/* ============================================================
   PATIENT HELPERS
   ============================================================ */

const patientFullName =
  computed(() => {
    if (
      !selectedPatient.value
    ) {
      return "—";
    }

    return [
      selectedPatient.value.firstName,
      selectedPatient.value.middleName,
      selectedPatient.value.lastName,
    ]
      .filter(Boolean)
      .join(" ");
  });


const patientAge =
  computed(() => {
    if (
      !selectedPatient.value
    ) {
      return null;
    }

    const value =
      selectedPatient.value.dateOfBirth ||
      selectedPatient.value.date_of_birth;

    if (!value) {
      return null;
    }

    const dob =
      new Date(value);

    if (
      Number.isNaN(
        dob.getTime(),
      )
    ) {
      return null;
    }

    const today =
      new Date();

    let age =
      today.getFullYear() -
      dob.getFullYear();

    const monthDifference =
      today.getMonth() -
      dob.getMonth();

    if (
      monthDifference < 0 ||
      (
        monthDifference === 0 &&
        today.getDate() <
          dob.getDate()
      )
    ) {
      age -= 1;
    }

    return age;
  });


/* ============================================================
   VALIDATION
   ============================================================ */

const canSubmitOrder =
  computed(() => {
    return (
      Boolean(
        selectedPatient.value?.id,
      ) &&
      Boolean(
        getAdmissionId(
          selectedAdmission.value,
        ),
      ) &&
      selectedAdmission.value?.status ===
        "ADMITTED" &&
      Boolean(
        orderForm.medicationName.trim(),
      ) &&
      Boolean(
        orderForm.dosage.trim(),
      ) &&
      Boolean(
        orderForm.frequency.trim(),
      )
    );
  });


const canSubmitDispense =
  computed(() => {
    return (
      Boolean(
        selectedOrderForDispense.value,
      ) &&
      Number(
        dispenseForm.dispensedQuantity,
      ) > 0 &&
      Boolean(
        dispenseForm.quantityUnit,
      )
    );
  });


/* ============================================================
   GENERAL HELPERS
   ============================================================ */

function formatStatus(
  value:
    | string
    | null
    | undefined,
): string {
  if (!value) {
    return "Unknown";
  }

  return value
    .replaceAll(
      "_",
      " ",
    )
    .toLowerCase()
    .replace(
      /\b\w/g,
      (
        character,
      ) =>
        character.toUpperCase(),
    );
}


function statusClass(
  status:
    | string
    | null
    | undefined,
): string {
  switch (status) {
    case "ORDERED":
      return "bg-blue-100 text-blue-700";

    case "PARTIALLY_DISPENSED":
      return "bg-amber-100 text-amber-700";

    case "DISPENSED":
      return "bg-emerald-100 text-emerald-700";

    case "COMPLETED":
      return "bg-teal-100 text-teal-700";

    case "DISCONTINUED":
      return "bg-slate-100 text-slate-600";

    case "CANCELLED":
      return "bg-red-100 text-red-700";

    default:
      return "bg-slate-100 text-slate-600";
  }
}


function formatDate(
  value:
    | string
    | null
    | undefined,
): string {
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
    return String(value);
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


function getDefaultDateTime(): string {
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


function formatDuration(
  order: any,
): string {
  if (
    order.duration_value ===
      null ||
    order.duration_value ===
      undefined
  ) {
    return "—";
  }

  return `${order.duration_value} ${
    order.duration_unit || ""
  }`.trim();
}


function formatQuantity(
  order: any,
): string {
  if (
    order.quantity_prescribed ===
      null ||
    order.quantity_prescribed ===
      undefined
  ) {
    return "—";
  }

  return `${order.quantity_prescribed} ${
    order.quantity_unit || ""
  }`.trim();
}


function formatDispensed(
  order: any,
): string {
  const amount =
    Number(
      order.total_dispensed_quantity ||
        0,
    );

  const unit =
    order.quantity_unit ||
    "";

  return `${amount} ${unit}`.trim();
}


function canDispense(
  order: any,
): boolean {
  return (
    order?.order_status ===
      "ORDERED" ||
    order?.order_status ===
      "PARTIALLY_DISPENSED"
  );
}


/* ============================================================
   ADMISSION HELPERS
   ============================================================ */

function getAdmissionId(
  admission: any,
): number | null {
  if (
    !admission
  ) {
    return null;
  }

  const value =
    admission.id ??
    admission.admissionId ??
    admission.admission_id;

  const number =
    Number(value);

  if (
    !Number.isInteger(
      number,
    ) ||
    number <= 0
  ) {
    return null;
  }

  return number;
}


function getAdmissionKey(
  admission: any,
): string {
  const id =
    getAdmissionId(admission);

  if (id !== null) {
    return String(id);
  }

  return `admission-${String(
    admission?.admissionNumber ??
    admission?.admission_number ??
    "unknown",
  )}`;
}


function getEncounterId(
  admission: any,
): number | null {
  if (
    !admission
  ) {
    return null;
  }

  const value =
    admission.encounterId ??
    admission.encounter_id;

  const number =
    Number(value);

  if (
    !Number.isInteger(
      number,
    ) ||
    number <= 0
  ) {
    return null;
  }

  return number;
}


/* ============================================================
   LOAD ADMISSIONS
   ============================================================ */

async function loadAdmissions(): Promise<void> {
  if (
    !selectedPatient.value?.id
  ) {
    admissions.value =
      [];

    selectedAdmission.value =
      null;

    return;
  }

  loadingAdmissions.value =
    true;

  error.value =
    "";

  try {
    const result =
      await getPatientAdmissions(
        selectedPatient.value.id,
      );

    admissions.value =
      Array.isArray(
        result,
      )
        ? result
        : [];

    const activeAdmission =
      admissions.value.find(
        (
          admission,
        ) =>
          admission.status ===
          "ADMITTED",
      );

    selectedAdmission.value =
      activeAdmission ||
      admissions.value[0] ||
      null;

  } catch (err) {
    admissions.value =
      [];

    selectedAdmission.value =
      null;

    error.value =
      err instanceof Error
        ? err.message
        : "Unable to load patient admissions.";
  } finally {
    loadingAdmissions.value =
      false;
  }
}


/* ============================================================
   SELECT ADMISSION
   ============================================================ */

function selectAdmission(
  admission: any,
): void {
  selectedAdmission.value =
    admission;

  error.value =
    "";
}


/* ============================================================
   LOAD MEDICATION ORDERS
   ============================================================ */

async function loadOrders(): Promise<void> {
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
        count: number;
        data: any[];
      }>(
        `/pharmacy/patients/${Number(
          selectedPatient.value.id,
        )}/orders`,
      );

    orders.value =
      Array.isArray(
        response.data,
      )
        ? response.data
        : [];

  } catch (err) {
    orders.value =
      [];

    error.value =
      err instanceof Error
        ? err.message
        : "Unable to load medication history.";
  } finally {
    loadingOrders.value =
      false;
  }
}


/* ============================================================
   RESET ORDER FORM
   ============================================================ */

function resetOrderForm(): void {
  Object.assign(
    orderForm,
    {
      medicationName: "",
      strength: "",
      dosage: "",
      route: "",
      frequency: "",
      durationValue: "",
      durationUnit: "",
      quantityPrescribed: "",
      quantityUnit: "",
      indication: "",
      instructions: "",
      prescribedNotes: "",
      startDate:
        getDefaultDateTime(),
      endDate: "",
    },
  );
}


/* ============================================================
   OPEN ORDER
   ============================================================ */

function openOrderForm(): void {
  if (
    !selectedPatient.value
  ) {
    error.value =
      "Please select a patient first.";

    return;
  }

  if (
    !selectedAdmission.value
  ) {
    error.value =
      "Please select an admission.";

    return;
  }

  if (
    selectedAdmission.value.status !==
    "ADMITTED"
  ) {
    error.value =
      "Medication orders can only be created for an active admission.";

    return;
  }

  const encounterId =
    getEncounterId(
      selectedAdmission.value,
    );

  const admissionId =
    getAdmissionId(
      selectedAdmission.value,
    );

  if (!encounterId) {
    error.value =
      "The selected admission does not contain a valid encounter ID.";

    return;
  }

  if (!admissionId) {
    error.value =
      "The selected admission does not contain a valid admission ID.";

    return;
  }

  error.value =
    "";

  resetOrderForm();

  orderFormOpen.value =
    true;
}


/* ============================================================
   CLOSE ORDER
   ============================================================ */

function closeOrderForm(): void {
  if (
    savingOrder.value
  ) {
    return;
  }

  orderFormOpen.value =
    false;

  resetOrderForm();
}


/* ============================================================
   SUBMIT ORDER
   ============================================================ */

async function submitOrder(): Promise<void> {
  if (
    !selectedPatient.value ||
    !selectedAdmission.value
  ) {
    return;
  }

  const patientId =
    Number(
      selectedPatient.value.id,
    );

  const encounterId =
    getEncounterId(
      selectedAdmission.value,
    );

  const admissionId =
    getAdmissionId(
      selectedAdmission.value,
    );

  if (
    !patientId ||
    !encounterId ||
    !admissionId
  ) {
    error.value =
      "Patient, encounter and admission information are required.";

    return;
  }

  savingOrder.value =
    true;

  error.value =
    "";

  try {
    await apiPost(
      "/pharmacy/orders",
      {
        patientId,

        encounterId,

        admissionId,

        medicationName:
          orderForm.medicationName.trim(),

        strength:
          orderForm.strength.trim() ||
          null,

        dosage:
          orderForm.dosage.trim(),

        route:
          orderForm.route ||
          null,

        frequency:
          orderForm.frequency.trim(),

        durationValue:
          orderForm.durationValue ||
          null,

        durationUnit:
          orderForm.durationUnit ||
          null,

        quantityPrescribed:
          orderForm.quantityPrescribed ||
          null,

        quantityUnit:
          orderForm.quantityUnit ||
          null,

        indication:
          orderForm.indication.trim() ||
          null,

        instructions:
          orderForm.instructions.trim() ||
          null,

        prescribedNotes:
          orderForm.prescribedNotes.trim() ||
          null,

        startDate:
          orderForm.startDate ||
          null,

        endDate:
          orderForm.endDate ||
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
        : "Unable to create medication order.";
  } finally {
    savingOrder.value =
      false;
  }
}


/* ============================================================
   OPEN DISPENSE
   ============================================================ */

async function openDispenseForm(
  order: any,
): Promise<void> {
  selectedOrderForDispense.value =
    order;

  selectedOrderDispensations.value =
    [];

  dispenseForm.dispensedQuantity =
    "";

  dispenseForm.quantityUnit =
    order.quantity_unit ||
    "";

  dispenseForm.dispensedAt =
    getDefaultDateTime();

  dispenseForm.pharmacyNotes =
    "";

  error.value =
    "";

  dispenseFormOpen.value =
    true;

  try {
    const response =
      await apiGet<{
        success: boolean;
        count: number;
        data: any[];
      }>(
        `/pharmacy/orders/${Number(
          order.medication_order_id,
        )}/dispensations`,
      );

    selectedOrderDispensations.value =
      Array.isArray(
        response.data,
      )
        ? response.data
        : [];

  } catch (err) {
    error.value =
      err instanceof Error
        ? err.message
        : "Unable to load dispensing history.";
  }
}


/* ============================================================
   CLOSE DISPENSE
   ============================================================ */

function closeDispenseForm(): void {
  if (
    savingDispense.value
  ) {
    return;
  }

  dispenseFormOpen.value =
    false;

  selectedOrderForDispense.value =
    null;

  selectedOrderDispensations.value =
    [];
}


/* ============================================================
   SUBMIT DISPENSE
   ============================================================ */

async function submitDispense(): Promise<void> {
  const order =
    selectedOrderForDispense.value;

  if (!order) {
    return;
  }

  const quantity =
    Number(
      dispenseForm.dispensedQuantity,
    );

  if (
    !Number.isFinite(
      quantity,
    ) ||
    quantity <= 0
  ) {
    error.value =
      "Dispensed quantity must be greater than zero.";

    return;
  }

  savingDispense.value =
    true;

  error.value =
    "";

  try {
    await apiPost(
      `/pharmacy/orders/${Number(
        order.medication_order_id,
      )}/dispense`,
      {
        dispensedQuantity:
          quantity,

        quantityUnit:
          dispenseForm.quantityUnit,

        dispensedAt:
          dispenseForm.dispensedAt ||
          null,

        pharmacyNotes:
          dispenseForm.pharmacyNotes.trim() ||
          null,
      },
    );

    await loadOrders();

    const refreshedOrder =
      orders.value.find(
        (
          item,
        ) =>
          Number(
            item.medication_order_id,
          ) ===
          Number(
            order.medication_order_id,
          ),
      );

    if (
      refreshedOrder
    ) {
      selectedOrderForDispense.value =
        refreshedOrder;

      const response =
        await apiGet<{
          success: boolean;
          count: number;
          data: any[];
        }>(
          `/pharmacy/orders/${Number(
            refreshedOrder.medication_order_id,
          )}/dispensations`,
        );

      selectedOrderDispensations.value =
        Array.isArray(
          response.data,
        )
          ? response.data
          : [];
    }

    dispenseForm.dispensedQuantity =
      "";

    dispenseForm.dispensedAt =
      getDefaultDateTime();

    dispenseForm.pharmacyNotes =
      "";

  } catch (err) {
    error.value =
      err instanceof Error
        ? err.message
        : "Unable to dispense medication.";
  } finally {
    savingDispense.value =
      false;
  }
}


/* ============================================================
   OPEN CANCEL
   ============================================================ */

function openCancelForm(
  order: any,
): void {
  selectedOrderForCancel.value =
    order;

  cancelForm.reason =
    "";

  error.value =
    "";

  cancelFormOpen.value =
    true;
}


/* ============================================================
   CLOSE CANCEL
   ============================================================ */

function closeCancelForm(): void {
  if (
    savingCancel.value
  ) {
    return;
  }

  cancelFormOpen.value =
    false;

  selectedOrderForCancel.value =
    null;

  cancelForm.reason =
    "";
}


/* ============================================================
   SUBMIT CANCEL
   ============================================================ */

async function submitCancel(): Promise<void> {
  const order =
    selectedOrderForCancel.value;

  if (!order) {
    return;
  }

  const reason =
    cancelForm.reason.trim();

  if (!reason) {
    error.value =
      "Cancellation reason is required.";

    return;
  }

  savingCancel.value =
    true;

  error.value =
    "";

  try {
    await apiPut(
      `/pharmacy/orders/${Number(
        order.medication_order_id,
      )}/cancel`,
      {
        reason,
      },
    );

    cancelFormOpen.value =
      false;

    selectedOrderForCancel.value =
      null;

    cancelForm.reason =
      "";

    await loadOrders();

  } catch (err) {
    error.value =
      err instanceof Error
        ? err.message
        : "Unable to cancel medication order.";
  } finally {
    savingCancel.value =
      false;
  }
}


/* ============================================================
   WATCH PATIENT
   ============================================================ */

watch(
  () =>
    selectedPatient.value?.id,

  async () => {
    admissions.value =
      [];

    selectedAdmission.value =
      null;

    orders.value =
      [];

    if (
      !selectedPatient.value?.id
    ) {
      return;
    }

    await loadAdmissions();

    await loadOrders();
  },
);


/* ============================================================
   INITIAL FORM
   ============================================================ */

resetOrderForm();

</script>