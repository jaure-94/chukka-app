# Testing on iPhone from Local Dev Server

## Quick Setup Guide

### Step 1: Ensure Both Devices Are on Same Network
- Make sure your Mac/PC and iPhone are connected to the **same Wi-Fi network**
- This is required for local network access

### Step 2: Find Your Local IP Address

**On Mac:**
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```
Look for an IP like `192.168.x.x` or `10.0.x.x`

**On Windows:**
```bash
ipconfig
```
Look for "IPv4 Address" under your active network adapter

**On Linux:**
```bash
hostname -I
```

**Your current local IP appears to be:** `192.168.100.6`

### Step 3: Start the Dev Server
```bash
npm run dev
```

The server will start on port 5000 and is already configured to accept connections from your local network.

### Step 4: Access from iPhone

1. **Open Safari on your iPhone**
2. **Navigate to:** `http://192.168.100.6:5000`
   - Replace `192.168.100.6` with your actual local IP if different
   - The port is `5000` (as configured in `server/index.ts`)

### Step 5: Test the iOS Keyboard Fix

1. Navigate to the dispatch sheet page
2. Tap on any editable cell
3. The keyboard should automatically appear
4. Test with different cell types:
   - Numeric cells (should show numeric keyboard)
   - Text cells (should show text keyboard)
   - Date/time cells (should show text keyboard)

## Troubleshooting

### Can't Connect from iPhone

**Check Firewall:**
- macOS: System Settings → Network → Firewall
- Make sure port 5000 is allowed, or temporarily disable firewall for testing
- Windows: Check Windows Defender Firewall settings

**Verify Network:**
- Ensure both devices are on the same Wi-Fi network
- Try pinging your Mac from iPhone (not directly possible, but verify network connectivity)
- Check if other devices on the network can access

**Check Server Logs:**
- Look for connection attempts in your terminal
- Server should show: `serving on port 5000`

**Try Different IP:**
- Your IP might change if you reconnect to Wi-Fi
- Re-run the IP detection command to get current IP

### Vite HMR (Hot Module Reload) Issues

If you see Vite connection errors:
- This is normal - HMR may not work perfectly over network
- The app will still work, just refresh manually when you make changes
- You can ignore HMR errors in the console

### SSL/HTTPS Warnings

- If you see security warnings, that's normal for local development
- Safari may warn about insecure connections
- Click "Advanced" → "Proceed to [your-ip]" to continue

## Alternative: Use ngrok (If Local Network Doesn't Work)

If you can't get local network access working:

1. **Install ngrok:**
   ```bash
   brew install ngrok  # Mac
   # or download from https://ngrok.com/
   ```

2. **Start your dev server:**
   ```bash
   npm run dev
   ```

3. **In another terminal, start ngrok:**
   ```bash
   ngrok http 5000
   ```

4. **Use the ngrok URL** (e.g., `https://abc123.ngrok.io`) on your iPhone
   - This creates a secure tunnel
   - Works even if devices aren't on same network
   - Free tier has limitations (session timeout, random URLs)

## Notes

- The server is configured to listen on `0.0.0.0` (all network interfaces)
- Vite is configured to allow local network hosts
- Port 5000 is used (as configured in `server/index.ts`)
- Changes made to the code will hot-reload (if HMR works) or require manual refresh

## Security Note

⚠️ **Only use this setup for local development testing**
- Don't expose your dev server to the public internet
- The current configuration is safe for local network access only
- When done testing, stop the dev server





