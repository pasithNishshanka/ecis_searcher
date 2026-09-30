const assert = require("node:assert/strict");
const { after, test } = require("node:test");
const pool = require("../src/config/database");
const { dispenseMedication } = require("../src/services/pharmacy.service");

const originalConnect = pool.connect;
after(() => { pool.connect = originalConnect; });

function mockDispense({ status = "ORDERED", prescribed = "10", alreadyDispensed = "0" } = {}) {
  const statements = [];
  const client = {
    async query(sql, params) {
      const statement = String(sql).trim().replace(/\s+/g, " ");
      statements.push({ statement, params });
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(statement)) return { rowCount: 0, rows: [] };
      if (statement.includes("FROM public.medication_orders") && statement.includes("FOR UPDATE")) {
        return { rowCount: 1, rows: [{ medication_order_id: 7, hospital_id: 2, patient_id: 3,
          quantity_prescribed: prescribed, quantity_unit: "tablets", order_status: status }] };
      }
      if (statement.includes("FROM public.medication_dispensations")) {
        return { rowCount: 1, rows: [{ total_dispensed: alreadyDispensed }] };
      }
      if (statement.startsWith("INSERT INTO public.medication_dispensations")) {
        return { rowCount: 1, rows: [{ medication_dispensation_id: 11 }] };
      }
      if (statement.startsWith("UPDATE public.medication_orders")) return { rowCount: 1, rows: [] };
      if (statement.startsWith("INSERT INTO public.audit_logs")) return { rowCount: 1, rows: [] };
      throw new Error(`Unexpected SQL: ${statement}`);
    },
    release() {},
  };
  pool.connect = async () => client;
  return statements;
}

const actor = { hospitalId: 2, userId: 5 };
const dispense = (quantity) => dispenseMedication(7, {
  dispensedQuantity: quantity, quantityUnit: "tablets",
}, actor);

test("partial dispense updates the order before committing and audits the event", async () => {
  const statements = mockDispense({ prescribed: "10", alreadyDispensed: "2" });
  await dispense(3);
  const update = statements.find(({ statement }) => statement.startsWith("UPDATE public.medication_orders"));
  assert.equal(update.params[2], "PARTIALLY_DISPENSED");
  assert.ok(statements.some(({ statement }) => statement.startsWith("INSERT INTO public.audit_logs")));
  assert.equal(statements.at(-1).statement, "COMMIT");
});

test("full dispense marks the order DISPENSED", async () => {
  const statements = mockDispense({ prescribed: "10", alreadyDispensed: "7" });
  await dispense(3);
  const update = statements.find(({ statement }) => statement.startsWith("UPDATE public.medication_orders"));
  assert.equal(update.params[2], "DISPENSED");
});

test("already dispensed orders cannot be dispensed again", async () => {
  const statements = mockDispense({ status: "DISPENSED" });
  await assert.rejects(dispense(1), /cannot be dispensed/);
  assert.equal(statements.at(-1).statement, "ROLLBACK");
  assert.ok(!statements.some(({ statement }) => statement.startsWith("INSERT INTO public.medication_dispensations")));
});

test("over-dispensing rolls back without creating a record", async () => {
  const statements = mockDispense({ prescribed: "10", alreadyDispensed: "8" });
  await assert.rejects(dispense(3), /exceeds the prescribed quantity/);
  assert.equal(statements.at(-1).statement, "ROLLBACK");
  assert.ok(!statements.some(({ statement }) => statement.startsWith("INSERT INTO public.medication_dispensations")));
});
