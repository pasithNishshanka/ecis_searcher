const bcrypt = require("bcryptjs");

const pool = require("../config/database");

const ASSIGNABLE_ROLES = new Set([
  "ADMIN",
  "HOSPITAL_ADMIN",
  "DOCTOR",
  "NURSE",
  "SURGEON",
  "RADIOLOGIST",
  "LAB_TECHNICIAN",
  "PHARMACIST",
  "RECEPTIONIST",
  "ECIS_SEARCHER",
  "SYSTEM_ADMIN",
]);

function optionalText(value, fieldName, maxLength) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const text = String(value).trim();

  if (text.length > maxLength) {
    throw new Error(`${fieldName} must be ${maxLength} characters or fewer.`);
  }

  return text || null;
}

function requiredText(value, fieldName, maxLength) {
  const text = optionalText(value, fieldName, maxLength);

  if (!text) {
    throw new Error(`${fieldName} is required.`);
  }

  return text;
}

function positiveInteger(value, fieldName) {
  const number = Number(value);

  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }

  return number;
}

function optionalDate(value, fieldName) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const date = String(value).trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`${fieldName} must use YYYY-MM-DD.`);
  }

  const parsed = new Date(`${date}T00:00:00Z`);

  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error(`${fieldName} must be a valid date.`);
  }

  return date;
}

function normalizedRole(value) {
  const role = requiredText(value, "role", 64).toUpperCase();

  if (!ASSIGNABLE_ROLES.has(role)) {
    throw new Error("The selected role is not available for hospital assignments.");
  }

  return role;
}

function isSystemAdministrator(actorRole) {
  return String(actorRole || "").trim().toUpperCase() === "SYSTEM_ADMIN";
}

function isHospitalAdministrator(actorRole) {
  const role = String(actorRole || "").trim().toUpperCase();
  return role === "ADMIN" || role === "HOSPITAL_ADMIN";
}

function hospitalResponse(row) {
  return {
    hospitalId: Number(row.hospital_id),
    hospitalCode: row.hospital_code,
    hospitalName: row.hospital_name,
    hospitalType: row.hospital_type,
    province: row.province,
    district: row.district,
    address: row.address,
    phone: row.phone,
    email: row.email,
    isActive: row.is_active,
  };
}

async function listHospitals() {
  const result = await pool.query(
    `
      SELECT
        hospital_id,
        hospital_code,
        hospital_name,
        hospital_type,
        province,
        district,
        address,
        phone,
        email,
        is_active
      FROM public.hospitals
      ORDER BY hospital_name, hospital_id;
    `,
  );

  return result.rows.map(hospitalResponse);
}

async function createHospital(input) {
  const hospitalCode = requiredText(input.hospitalCode, "hospitalCode", 50).toUpperCase();
  const hospitalName = requiredText(input.hospitalName, "hospitalName", 200);

  const result = await pool.query(
    `
      INSERT INTO public.hospitals (
        hospital_code,
        hospital_name,
        hospital_type,
        province,
        district,
        address,
        phone,
        email,
        is_active,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING
        hospital_id,
        hospital_code,
        hospital_name,
        hospital_type,
        province,
        district,
        address,
        phone,
        email,
        is_active;
    `,
    [
      hospitalCode,
      hospitalName,
      optionalText(input.hospitalType, "hospitalType", 100),
      optionalText(input.province, "province", 100),
      optionalText(input.district, "district", 100),
      optionalText(input.address, "address", 1000),
      optionalText(input.phone, "phone", 50),
      optionalText(input.email, "email", 254),
    ],
  );

  return hospitalResponse(result.rows[0]);
}

async function searchStaff(query) {
  const text = requiredText(query, "q", 100);

  if (text.length < 2) {
    throw new Error("Enter at least two characters to search staff.");
  }

  const pattern = `%${text.replace(/[\\%_]/g, "\\$&")}%`;
  const result = await pool.query(
    `
      SELECT
        u.user_id,
        u.employee_number,
        u.full_name,
        u.username,
        u.role AS account_role,
        u.department AS account_department,
        u.hospital_id AS home_hospital_id,
        h.hospital_name AS home_hospital_name
      FROM public.hospital_users u
      INNER JOIN public.hospitals h
        ON h.hospital_id = u.hospital_id
      WHERE
        u.is_active = TRUE
        AND (
          u.employee_number ILIKE $1 ESCAPE '\\'
          OR u.full_name ILIKE $1 ESCAPE '\\'
          OR u.username ILIKE $1 ESCAPE '\\'
        )
      ORDER BY u.full_name, u.user_id
      LIMIT 25;
    `,
    [pattern],
  );

  return result.rows.map((row) => ({
    userId: Number(row.user_id),
    employeeNumber: row.employee_number,
    fullName: row.full_name,
    username: row.username,
    accountRole: row.account_role,
    accountDepartment: row.account_department,
    homeHospitalId: Number(row.home_hospital_id),
    homeHospitalName: row.home_hospital_name,
  }));
}

function staffResponse(row) {
  return {
    userId: Number(row.user_id),
    employeeNumber: row.employee_number,
    fullName: row.full_name,
    username: row.username,
    accountRole: row.account_role,
    accountDepartment: row.account_department,
    homeHospitalId: Number(row.home_hospital_id),
    homeHospitalName: row.home_hospital_name,
  };
}

async function createStaffAccount({ actor, input }) {
  const actorRole = String(actor?.role || "").trim().toUpperCase();
  const actorHospitalId = positiveInteger(actor?.hospitalId, "Authenticated hospitalId");

  if (!isSystemAdministrator(actorRole) && !isHospitalAdministrator(actorRole)) {
    throw new Error("Only a system or hospital administrator can create staff accounts.");
  }

  const hospitalId = positiveInteger(input.hospitalId, "hospitalId");
  const role = normalizedRole(input.role);
  if (role === "SYSTEM_ADMIN") {
    throw new Error("System administrator accounts must be provisioned separately.");
  }
  const employeeNumber = requiredText(input.employeeNumber, "employeeNumber", 100);
  const fullName = requiredText(input.fullName, "fullName", 200);
  const username = requiredText(input.username, "username", 100).toLowerCase();
  const password = requiredText(input.password, "password", 200);
  const department = optionalText(input.department, "department", 150);
  const designation = optionalText(input.designation, "designation", 150);
  const licenseNumber = optionalText(input.licenseNumber, "licenseNumber", 100);
  const phone = optionalText(input.phone, "phone", 50);
  const email = optionalText(input.email, "email", 254);

  if (password.length < 12) {
    throw new Error("password must be at least 12 characters.");
  }

  if (!isSystemAdministrator(actorRole) && hospitalId !== actorHospitalId) {
    throw new Error("A hospital administrator can only create staff for their current hospital.");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const hospitalResult = await client.query(
      `
        SELECT hospital_id, hospital_name
        FROM public.hospitals
        WHERE hospital_id = $1 AND is_active = TRUE
        FOR KEY SHARE;
      `,
      [hospitalId],
    );

    if (hospitalResult.rowCount === 0) {
      throw new Error("The selected hospital is inactive or does not exist.");
    }

    const duplicateResult = await client.query(
      `
        SELECT user_id
        FROM public.hospital_users
        WHERE LOWER(username) = $1 OR employee_number = $2
        LIMIT 1
        FOR KEY SHARE;
      `,
      [username, employeeNumber],
    );

    if (duplicateResult.rowCount > 0) {
      throw new Error("A staff account already uses this username or employee number.");
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userResult = await client.query(
      `
        INSERT INTO public.hospital_users (
          hospital_id,
          employee_number,
          full_name,
          username,
          password_hash,
          role,
          department,
          phone,
          email,
          is_active,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING user_id, employee_number, full_name, username, role, department, hospital_id;
      `,
      [
        hospitalId,
        employeeNumber,
        fullName,
        username,
        passwordHash,
        role,
        department,
        phone,
        email,
      ],
    );

    const user = userResult.rows[0];
    await client.query(
      `
        INSERT INTO public.hospital_user_assignments (
          user_id,
          hospital_id,
          role,
          department,
          designation,
          license_number,
          start_date,
          status,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
      `,
      [
        user.user_id,
        hospitalId,
        role,
        department,
        designation,
        licenseNumber,
      ],
    );

    await client.query("COMMIT");

    return {
      userId: Number(user.user_id),
      employeeNumber: user.employee_number,
      fullName: user.full_name,
      username: user.username,
      accountRole: user.role,
      accountDepartment: user.department,
      homeHospitalId: Number(user.hospital_id),
      homeHospitalName: hospitalResult.rows[0].hospital_name,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function createOrUpdateAssignment({ actor, input }) {
  const actorRole = String(actor?.role || "").trim().toUpperCase();
  const actorHospitalId = positiveInteger(actor?.hospitalId, "Authenticated hospitalId");

  if (!isSystemAdministrator(actorRole) && !isHospitalAdministrator(actorRole)) {
    throw new Error("Only a system or hospital administrator can manage hospital assignments.");
  }

  const userId = positiveInteger(input.userId, "userId");
  const hospitalId = positiveInteger(input.hospitalId, "hospitalId");
  const role = normalizedRole(input.role);
  if (role === "SYSTEM_ADMIN" &&
      (!isSystemAdministrator(actorRole) || userId !== Number(actor?.userId))) {
    throw new Error("Only the current system administrator may add their own system administrator hospital assignment.");
  }
  const startDate = optionalDate(input.startDate, "startDate") || new Date().toISOString().slice(0, 10);
  const endDate = optionalDate(input.endDate, "endDate");

  if (endDate && endDate < startDate) {
    throw new Error("endDate cannot be earlier than startDate.");
  }

  if (!isSystemAdministrator(actorRole)) {
    if (hospitalId !== actorHospitalId) {
      throw new Error("A hospital administrator can only manage assignments at their current hospital.");
    }

    if (role === "SYSTEM_ADMIN") {
      throw new Error("A hospital administrator cannot grant the system administrator role.");
    }
  }

  const department = optionalText(input.department, "department", 150);
  const designation = optionalText(input.designation, "designation", 150);
  const licenseNumber = optionalText(input.licenseNumber, "licenseNumber", 100);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const [userResult, hospitalResult] = await Promise.all([
      client.query(
        `
          SELECT user_id
          FROM public.hospital_users
          WHERE user_id = $1 AND is_active = TRUE
          FOR KEY SHARE;
        `,
        [userId],
      ),
      client.query(
        `
          SELECT hospital_id
          FROM public.hospitals
          WHERE hospital_id = $1 AND is_active = TRUE
          FOR KEY SHARE;
        `,
        [hospitalId],
      ),
    ]);

    if (userResult.rowCount === 0) {
      throw new Error("The selected staff account is inactive or does not exist.");
    }

    if (hospitalResult.rowCount === 0) {
      throw new Error("The selected hospital is inactive or does not exist.");
    }

    const existingResult = await client.query(
      `
        SELECT assignment_id
        FROM public.hospital_user_assignments
        WHERE user_id = $1 AND hospital_id = $2 AND role = $3
        ORDER BY
          CASE WHEN status = 'ACTIVE' THEN 0 ELSE 1 END,
          assignment_id DESC
        LIMIT 1
        FOR UPDATE;
      `,
      [userId, hospitalId, role],
    );

    const assignmentId = existingResult.rows[0]?.assignment_id || null;
    const assignmentResult = assignmentId
      ? await client.query(
        `
          UPDATE public.hospital_user_assignments
          SET
            department = $2,
            designation = $3,
            license_number = $4,
            start_date = $5,
            end_date = $6,
            status = 'ACTIVE',
            updated_at = CURRENT_TIMESTAMP
          WHERE assignment_id = $1
          RETURNING assignment_id, user_id, hospital_id, role, department, designation, license_number, start_date, end_date, status;
        `,
        [assignmentId, department, designation, licenseNumber, startDate, endDate],
      )
      : await client.query(
        `
          INSERT INTO public.hospital_user_assignments (
            user_id,
            hospital_id,
            role,
            department,
            designation,
            license_number,
            start_date,
            end_date,
            status,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          RETURNING assignment_id, user_id, hospital_id, role, department, designation, license_number, start_date, end_date, status;
        `,
        [userId, hospitalId, role, department, designation, licenseNumber, startDate, endDate],
      );

    const assignment = assignmentResult.rows[0];
    await client.query(
      `INSERT INTO public.audit_logs (
         hospital_id, user_id, action_type, entity_type, entity_id,
         new_values
       ) VALUES ($1, $2, 'HOSPITAL_ASSIGNMENT_SAVED', 'hospital_user_assignment', $3, $4::jsonb);`,
      [hospitalId, actor.userId, assignment.assignment_id, JSON.stringify(assignment)],
    );
    await client.query("COMMIT");
    return {
      assignmentId: Number(assignment.assignment_id),
      userId: Number(assignment.user_id),
      hospitalId: Number(assignment.hospital_id),
      role: assignment.role,
      department: assignment.department,
      designation: assignment.designation,
      licenseNumber: assignment.license_number,
      startDate: assignment.start_date,
      endDate: assignment.end_date,
      status: assignment.status,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  listHospitals,
  createHospital,
  searchStaff,
  createStaffAccount,
  createOrUpdateAssignment,
};
