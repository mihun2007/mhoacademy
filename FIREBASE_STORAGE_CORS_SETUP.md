# Firebase Storage CORS Configuration

**IMPORTANT:** You need to configure CORS for Firebase Storage to allow images to load and download properly.

## Quick Fix Using gsutil (Recommended)

1. **Install Google Cloud SDK** (if not already installed):
   - Download from: https://cloud.google.com/sdk/docs/install
   - Or use: `brew install google-cloud-sdk` (on macOS)

2. **Authenticate**:
   ```bash
   gcloud auth login
   ```

3. **Create a CORS configuration file** named `cors.json`:
   ```json
   [
     {
       "origin": ["*"],
       "method": ["GET", "HEAD"],
       "maxAgeSeconds": 3600
     }
   ]
   ```
   
   **Note:** The `responseHeader` field is optional and can cause errors. The simplified version above works best for Firebase Storage.

4. **Apply CORS configuration**:
   ```bash
   gsutil cors set cors.json gs://mho-music-academy.firebasestorage.app
   ```

5. **Verify it worked**:
   ```bash
   gsutil cors get gs://mho-music-academy.firebasestorage.app
   ```

## Alternative: Using Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `mho-music-academy`
3. Go to **Storage** → **Rules** tab
4. Make sure rules allow reads:
   ```
   rules_version = '2';
   service firebase.storage {
     match /b/{bucket}/o {
       match /{allPaths=**} {
         allow read: if true;
         allow write: if request.auth != null;
       }
     }
   }
   ```

**Note:** Storage Rules are different from CORS. You need BOTH:
- Storage Rules (for Firebase permissions)
- CORS configuration (for browser cross-origin requests)

## After Configuring CORS

Once CORS is configured, refresh your gallery page and the images should:
- ✅ Display properly
- ✅ Download when clicking the download button
