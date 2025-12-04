# Instructions to Add pax_file_path Column to Database

## What Happened

The `pax_file_path` column was added to the TypeScript schema, which means Drizzle now tries to SELECT it in all queries. However, the column doesn't exist in the production database yet, causing SQL errors.

## Solution: Add the Column to Your Neon Database

You have **two options**:

### Option 1: Run SQL Directly in Neon Dashboard (Easiest)

1. Go to your Neon dashboard: https://console.neon.tech
2. Select your project
3. Click on "SQL Editor" or "Query"
4. Run this SQL command:

```sql
ALTER TABLE "generated_reports" 
ADD COLUMN IF NOT EXISTS "pax_file_path" text;
```

5. Click "Run" or press Ctrl+Enter
6. Done! The column is now added.

### Option 2: Use psql Command Line (If you have connection string)

If you have the database connection string, you can run:

```bash
psql "YOUR_DATABASE_CONNECTION_STRING" -c "ALTER TABLE generated_reports ADD COLUMN IF NOT EXISTS pax_file_path text;"
```

Or if you prefer to use the migration file:

```bash
psql "YOUR_DATABASE_CONNECTION_STRING" -f migrations/0001_add_pax_file_path_column.sql
```

## Verify the Column Was Added

After running the SQL, verify it worked by running:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'generated_reports' 
AND column_name = 'pax_file_path';
```

You should see one row with `pax_file_path` and `text` as the data type.

## What This Fixes

- ✅ All report generation will work again (desktop and mobile)
- ✅ All report updates will work again
- ✅ The app will stop throwing SQL errors about missing column
- ✅ Future reports will be saved with `pax_file_path` in the database

## After Adding the Column

Once the column is added, you can:
1. Deploy the current code (it will work with the column)
2. Generate new reports (they'll be saved with `pax_file_path`)
3. Update existing reports (they'll work correctly)

The error handling code I added will still work as a safety net, but it won't be needed once the column exists.

