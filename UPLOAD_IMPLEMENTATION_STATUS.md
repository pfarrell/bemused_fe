# Upload Feature Implementation Status

## ✅ Completed

### 1. Database Schema
- Created migration: `server/migrations/001_add_upload_queue_and_file_hash.sql`
- Added `upload_queue` table for background processing
- Added `file_hash` column to `media_files` for deduplication
- Updated TypeScript schema in `server/src/db/database.ts`

**To apply migration:**
```bash
cd server
chmod +x scripts/run-migration.sh
./scripts/run-migration.sh
```

### 2. Upload API Endpoints
- Created `server/src/routes/upload.ts`
- **POST /admin/upload** - Upload files and queue for processing
  - Accepts: files, artist_name, artist_id, album_name, album_id, genre, track_pad, album_art_url
  - Calculates MD5 hash for deduplication
  - Stores files in `public/tmp/uploads/`
  - Adds to database queue
- **GET /admin/upload/status** - Get queue statistics
- **GET /admin/upload/recent** - Get recent uploads
- Registered routes in `server/src/index.ts`

## 🔧 To Do

### 3. Install NPM Packages
See `server/PACKAGES_TO_INSTALL.md` for commands:
```bash
cd server
npm install @hono/multipart node-id3 music-metadata
npm run build
```

### 4. Queue Worker Process
Create `server/src/workers/queue-handler.ts`:
- Poll `upload_queue` table for pending items
- Extract ID3 tags using `node-id3`
- Create/find Artist, Album, Track records
- Move files to final location: `$BEMUSED_UPLOAD_PATH/{artist}/{album}/{track}.mp3`
- Update `media_files` and link to track
- Extract duration using `music-metadata`
- Handle album art (download from URL or use embedded art)
- Update queue status to completed/failed

### 5. Frontend - Upload Page
Create `src/pages/AdminUpload.jsx`:
- Form with fields:
  - Artist name/ID input
  - Album name/ID input
  - Genre input
  - Track pad number input
  - Album art upload/URL
  - Multiple file picker
- Submit uploads to `/admin/upload`
- Show upload progress/status
- Display recent uploads from `/admin/upload/recent`

### 6. Frontend - API Service
Add to `src/services/api.js`:
```javascript
uploadTracks: (formData) => api.post('/admin/upload', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
}),
getUploadStatus: () => api.get('/admin/upload/status'),
getRecentUploads: () => api.get('/admin/upload/recent'),
```

### 7. Frontend - Routing
Add to `src/App.jsx`:
```javascript
<Route path="/admin/upload" element={<AdminUpload />} />
```

## 📋 Implementation Notes

### File Processing Flow
```
Upload Form → POST /admin/upload → upload_queue table
                                          ↓
Queue Worker polls → Extract ID3 → Create DB records → Move file → Mark complete
```

### Deduplication
- MD5 hash calculated on upload
- Checked against `media_files.file_hash`
- Duplicate files rejected immediately

### Priority for Metadata
1. Manual form input (highest)
2. ID3 tags
3. Filename parsing

### Album Art Handling
- Option 1: Upload image file with tracks
- Option 2: Provide URL and filename (downloads like admin image feature)
- Option 3: Extract from ID3 embedded art

### Worker Deployment
Create systemd service for queue worker:
```ini
[Unit]
Description=Bemused Upload Queue Worker
After=network.target postgresql.service

[Service]
Type=simple
User=pfarrell
WorkingDirectory=/var/www/bemused-node/current
ExecStart=/usr/bin/node /var/www/bemused-node/current/dist/workers/queue-handler.js
Restart=always
Environment=NODE_ENV=production
EnvironmentFile=/var/www/bemused-node/shared/.env

[Install]
WantedBy=multi-user.target
```

## 🧪 Testing Checklist

- [ ] Run database migration
- [ ] Install npm packages
- [ ] Build TypeScript
- [ ] Deploy backend
- [ ] Test upload endpoint manually (curl)
- [ ] Implement queue worker
- [ ] Test worker locally
- [ ] Build upload UI
- [ ] Test full flow (upload → process → verify in database)
- [ ] Deploy worker as systemd service
- [ ] Test deduplication
- [ ] Test multi-disc uploads with track_pad
- [ ] Test album art upload/download
