# Testing Blob Storage Locally

This guide will help you test Vercel Blob Storage functionality locally before deploying to production.

## Prerequisites

1. **Vercel Blob Storage Token**: You need a `BLOB_READ_WRITE_TOKEN` from your Vercel project
   - Go to your Vercel project dashboard
   - Navigate to Settings → Environment Variables
   - Copy the `BLOB_READ_WRITE_TOKEN` value

## Setup Steps

### 1. Add Environment Variables to `.env.local`

Add or update these variables in your `.env.local` file:

```bash
# Enable blob storage for local testing
USE_BLOB=true

# Your Vercel Blob Storage token (same as production)
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Other required variables
DATABASE_URL=your_database_url
JWT_SECRET=your_jwt_secret
```

### 2. Restart Your Development Server

After updating `.env.local`, restart your dev server:

```bash
# Stop the current server (Ctrl+C)
# Then restart
npm run dev
```

### 3. Verify Blob Storage is Enabled

Check your server logs when it starts. You should see:
- No errors about missing `BLOB_READ_WRITE_TOKEN`
- The server should start normally

## Testing Checklist

### ✅ Test 1: Upload a Template

1. Navigate to `/templates/edit` (or `/templates/edit/ship-a`)
2. Upload a dispatch template
3. **Expected Result**: 
   - Template uploads successfully
   - Check server logs for: `✓ BlobStorage: Uploaded file to https://...`
   - The template's `filePath` in the database should be a blob URL (starts with `https://`)

**How to Verify**:
- Check your database: `SELECT filePath FROM dispatch_templates WHERE isActive = true;`
- The `filePath` should be a URL like `https://[project].public.blob.vercel-storage.com/...`

### ✅ Test 2: Load Template in Create Dispatch Page

1. Navigate to `/create-dispatch` (or `/create-dispatch/ship-a`)
2. **Expected Result**:
   - Template loads successfully
   - No "Failed to fetch template" errors
   - The spreadsheet editor opens with the template data

**How to Verify**:
- Open browser DevTools → Network tab
- Look for a request to a blob URL (not `/api/files/...`)
- The request should return status 200

### ✅ Test 3: Edit and Save Dispatch Sheet

1. On the create dispatch page, click "Edit Spreadsheet"
2. Make some changes to the data
3. Click "Save File"
4. **Expected Result**:
   - File saves successfully
   - Check server logs for: `✓ BlobStorage: Saved workbook to https://...`
   - The saved dispatch version's `filePath` should be a blob URL

**How to Verify**:
- Check database: `SELECT filePath FROM dispatch_versions ORDER BY createdAt DESC LIMIT 1;`
- Should be a blob URL

### ✅ Test 4: Generate PAX Report

1. After saving a dispatch sheet, generate a PAX report
2. **Expected Result**:
   - PAX report generates successfully
   - Check server logs for blob storage operations
   - The generated report's path should be a blob URL

**How to Verify**:
- Check server logs for: `✓ BlobStorage: Saved workbook to https://...`
- The output should be a blob URL, not a local file path

### ✅ Test 5: Generate EOD Report

1. Generate an EOD report from a saved dispatch
2. **Expected Result**:
   - EOD report generates successfully
   - File is saved to blob storage

**How to Verify**:
- Check server logs for blob storage upload messages
- Verify the file path is a blob URL

## Troubleshooting

### Issue: "BLOB_READ_WRITE_TOKEN is not configured"

**Solution**:
- Make sure `BLOB_READ_WRITE_TOKEN` is set in `.env.local`
- Restart your dev server after adding it
- Check that there are no typos in the variable name

### Issue: "Failed to fetch template" error

**Solution**:
- Verify the template was uploaded with blob storage enabled
- Check the database - the `filePath` should be a blob URL
- If it's still a local path, re-upload the template with `USE_BLOB=true`

### Issue: Files still saving to local filesystem

**Solution**:
- Verify `USE_BLOB=true` is in `.env.local` (not just `.env`)
- Restart your dev server
- Check server logs - you should see blob storage messages

### Issue: CORS errors when fetching from blob URL

**Solution**:
- Blob URLs should be publicly accessible
- If you see CORS errors, check your Vercel Blob Storage settings
- Make sure the blob was uploaded with `access: 'public'`

## Switching Back to Local Filesystem

To disable blob storage and use local filesystem again:

1. Remove or comment out `USE_BLOB=true` in `.env.local`:
   ```bash
   # USE_BLOB=true
   ```

2. Restart your dev server

3. The app will now use local filesystem storage again

## Verification Commands

### Check if blob storage is enabled:
```bash
# In your server logs, look for:
# "Production mode - BLOB_READ_WRITE_TOKEN: SET"
```

### Check database for blob URLs:
```sql
-- Check dispatch templates
SELECT id, filename, filePath FROM dispatch_templates WHERE filePath LIKE 'https://%';

-- Check dispatch versions
SELECT id, filePath FROM dispatch_versions WHERE filePath LIKE 'https://%' ORDER BY createdAt DESC LIMIT 5;
```

### Test blob URL directly:
```bash
# Copy a blob URL from your database and test it:
curl -I "https://[your-blob-url]"

# Should return 200 OK
```

## Expected Log Messages

When blob storage is working correctly, you should see these log messages:

```
✓ BlobStorage: Uploaded file to https://...
✓ BlobStorage: Downloaded file from https://... (X bytes)
✓ BlobStorage: Loaded workbook from https://...
✓ BlobStorage: Saved workbook to https://...
```

## Next Steps

Once local testing is successful:
1. Commit your changes
2. Push to GitHub
3. Vercel will automatically deploy
4. The production environment will use blob storage automatically (no `USE_BLOB` needed - it detects `VERCEL=1`)

