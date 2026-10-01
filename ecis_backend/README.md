# ECIS backend database setup

The canonical **schema-only** definition is [`sql/00_baseline.sql`](sql/00_baseline.sql). It creates the 39 application tables, their sequences, keys, indexes, constraints, functions, and triggers. It inserts **no patients, staff, hospitals, or clinical records**. The old `record_normalization_backup` table is deliberately not part of a new installation; it remains untouched in the existing working database.

## Existing working database

Keep your current `ecis_ehr` database and `.env`. Run `npm run db:check` (or `node scripts/setupDatabase.js`) to check that the baseline tables exist. This is read-only. `npm run db:setup` also makes no changes when all baseline tables already exist. If a database has only some tables, setup stops without modifying it. Do not run individual SQL files against a working database unless you have reviewed the exact migration and have a backup.

## New, empty database

1. Install PostgreSQL 18 and create a **new empty** database in pgAdmin. Set `DB_NAME` in `.env` to that database. Do not reuse or empty the working database.
2. Copy `.env.example` to `.env` and supply the database credentials, a long random `JWT_SECRET`, and a distinct 32-byte `ECIS_FACE_TEMPLATE_KEY` encoded as 64 hexadecimal characters. Keep `.env` private. You can generate a key with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
3. From `ecis_backend`, run `npm install`, then `npm run db:check` to confirm the database is empty. Run `npm run db:setup` once. The setup command applies the schema in one transaction and refuses to run over a partial database.
4. Create the first real hospital. In Command Prompt, for example:

   ```cmd
   set ECIS_BOOTSTRAP_HOSPITAL_NAME=Colombo General Hospital
   set ECIS_BOOTSTRAP_HOSPITAL_TYPE=General Hospital
   set ECIS_BOOTSTRAP_PROVINCE=Western Province
   set ECIS_BOOTSTRAP_DISTRICT=Colombo
   npm run bootstrap:hospital
   ```

   The command prints the new hospital ID. It refuses to run if any hospital already exists. Supply your real hospital details rather than the example above.
5. Provision the first administrator using the printed hospital ID:

   ```cmd
   set ECIS_BOOTSTRAP_HOSPITAL_ID=1
   set ECIS_BOOTSTRAP_EMPLOYEE_NUMBER=SYS-001
   set ECIS_BOOTSTRAP_FULL_NAME=Your Administrator Name
   set ECIS_BOOTSTRAP_USERNAME=systemadmin
   set ECIS_BOOTSTRAP_PASSWORD=Choose-a-strong-password-of-12-characters-or-more
   npm run provision:system-admin
   ```

   Replace `1` with the ID printed in step 4 and set a private password. Then run `npm start` and create other hospitals and staff through Settings.

The optional `npm run db:verify-bootstrap` test requires a PostgreSQL role with `CREATEDB`. It creates a randomly named empty test database, installs the baseline, checks table/trigger counts, and removes **only that newly created test database**. It does not touch `ecis_ehr`.

The baseline is for **new installations**, not a replacement for a backup or an upgrade script for an older partial schema. It does not copy any data from the current database.
