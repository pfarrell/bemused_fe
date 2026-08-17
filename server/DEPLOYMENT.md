# Deployment Guide - Bemused Node.js Backend

This guide covers developing and deploying the Bemused Node.js/Hono backend.

## Development

### Local Setup

1. **Install dependencies**:
   ```bash
   cd server
   npm install
   ```

2. **Configure environment**:
   Create a `.env` file in the `server/` directory:
   ```bash
   BEMUSED_DB=postgres://user:password@localhost:5432/bemused
   PORT=3000
   # Optional: proxy streams from production when NAS unavailable locally
   BEMUSED_DEV=https://patf.com/pshare
   ```

3. **Start development server**:
   ```bash
   npm run dev
   ```

   The API will be available at `http://localhost:3000`

4. **Start the upload queue worker** (in a separate terminal, required for uploads):
   ```bash
   cd server
   npm run worker
   ```

5. **Start the frontend** (in a separate terminal):
   ```bash
   cd /home/pfarrell/proj/bemused
   npm run dev
   ```

   The frontend dev server will proxy `/api/*` requests to the backend on port 3000.

### Development Workflow

- **Backend changes**: The dev server (tsx watch) will automatically reload when you save TypeScript files
- **Frontend changes**: Vite dev server has hot module replacement (HMR) for instant updates
- **Database changes**: Create migrations in `migrations/` — they run automatically on deploy

### Testing API Endpoints

```bash
# Test random artists
curl http://localhost:3000/artists/random

# Test specific artist
curl http://localhost:3000/artist/1

# Test search
curl 'http://localhost:3000/search?q=beatles'

# Test streaming (will proxy to production if BEMUSED_DEV is set)
curl -I http://localhost:3000/stream/12345
```

## Production Deployment

### Architecture Overview

- **Server**: Ubuntu server at patf.com, SSH port 10022
- **Backend**: Node.js/Hono app running on port 3000, managed by systemd
- **Queue worker**: Separate systemd service processing the upload queue
- **Frontend**: React SPA served as static files by nginx
- **Database**: PostgreSQL (already running in production)
- **Web Server**: nginx (proxies API requests to Node, serves static files directly)

## Directory Structure

```
/var/www/bemused-node/
├── current/              # Symlink to latest release
│   └── public/
│       └── images/      # Symlink to shared/public/images
├── releases/
│   ├── 20260320120000/  # Timestamped releases
│   └── 20260320130000/
└── shared/
    ├── .env             # Production environment variables (not in git)
    └── public/
        └── images/      # Symlink to /var/www/bemused/shared/public/images (nginx-served)
            ├── artists/
            └── albums/
```

**Note**: The `shared/public/images` directory is symlinked to the same location used by the Ruby app (`/var/www/bemused/shared/public/images`), which is served by nginx at `https://patf.net/images`. This allows both apps to share the same image storage.

## First-Time Setup

### 1. Set up production .env file

Run the setup script to create the production environment file:

```bash
cd server
./scripts/setup-production-env.sh
```

You'll be prompted for:
- Database connection string (get this from existing Ruby app config or server)
- Port (default: 3000)

This creates `/var/www/bemused-node/shared/.env` with:

```bash
BEMUSED_DB=postgres://user:password@localhost:5432/bemused
PORT=3000
BEMUSED_PATH=/pshare
BEMUSED_UPLOAD_PATH=/path/to/nas/mp3s
NODE_ENV=production
```

### 2. Install the API systemd service

SSH to the server and install the service file:

```bash
ssh -p 10022 pfarrell@patf.com

# Copy service file
sudo cp /var/www/bemused-node/current/bemused-api.service /etc/systemd/system/

# Reload systemd and enable service
sudo systemctl daemon-reload
sudo systemctl enable bemused-api
```

### 3. Install the queue worker systemd service

The upload queue worker runs as a separate long-lived process:

```bash
ssh -p 10022 pfarrell@patf.com

# Copy service file
sudo cp /var/www/bemused-node/current/bemused-queue-worker.service /etc/systemd/system/

# Reload systemd and enable service
sudo systemctl daemon-reload
sudo systemctl enable --now bemused-queue-worker
```

**Note**: The queue worker must be running for uploaded audio files to be processed. The API server accepts uploads and writes them to `upload_queue`; the worker polls that table every 5 seconds.

### 4. Configure nginx

SSH to the server and install the nginx configuration:

```bash
ssh -p 10022 pfarrell@patf.com

# Copy the app's nginx snippet into the shared per-app directory
# (pshare is one of several apps sharing the patf.com vhost — see
# /etc/nginx/sites-available/patf.com, which includes
# /etc/nginx/patf.conf.d/*.conf)
sudo cp /var/www/bemused-node/current/nginx/pshare.conf /etc/nginx/patf.conf.d/pshare.conf

# Test configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

### 5. Link shared images to nginx-served location

Run the one-time setup script to create the symlink from `shared/public/images` to the nginx-served images directory:

```bash
cd server
./scripts/setup-shared-images.sh
```

This creates a symlink from `/var/www/bemused-node/shared/public/images` to `/var/www/bemused/shared/public/images`, which is the same location used by the Ruby app and served by nginx at `https://patf.net/images`.

After this is set up once, the deploy script will automatically:
- Create `releases/<timestamp>/public/images` as a symlink to `shared/public/images`
- Downloaded images will be saved to the shared location and persist across deployments

### 6. Verify database access

Ensure the Node app can connect to the PostgreSQL database:

```bash
ssh -p 10022 pfarrell@patf.com
psql "$(grep BEMUSED_DB /var/www/bemused-node/shared/.env | cut -d= -f2)" -c '\dt'
```

You should see the bemused database tables (artists, albums, tracks, etc.).

## Regular Deployment

Once the first-time setup is complete, deploy new versions with:

```bash
cd server
npm run deploy
```

This will:
1. Build the TypeScript code locally
2. Create a new timestamped release directory on the server
3. Upload built code and dependencies via rsync
4. Install production dependencies on the server
5. Run database migrations
6. Update the `current` symlink to the new release
7. Restart the `bemused-api` systemd service
8. Clean up old releases (keeps last 5)

The queue worker (`bemused-queue-worker`) is **not** restarted automatically — restart it manually if the worker code changed:

```bash
ssh -p 10022 pfarrell@patf.com 'sudo systemctl restart bemused-queue-worker'
```

## Deployment Workflow

Typical deployment workflow after making changes:

### Backend Deployment

```bash
cd server
npm run deploy
```

The deploy script builds, uploads, migrates, and restarts the API service automatically.

### Frontend Deployment

```bash
# From the repo root
npm run deploy
```

The frontend deploys to `/var/www/bemused/shared/public/frontend` and is served by nginx.

### Full Stack Deployment

```bash
# From the repo root
npm run full-deploy
```

Or individually:

```bash
cd server && npm run deploy   # backend
cd .. && npm run deploy       # frontend
```

## Monitoring and Troubleshooting

### Check service status

```bash
ssh -p 10022 pfarrell@patf.com 'sudo systemctl status bemused-api'
ssh -p 10022 pfarrell@patf.com 'sudo systemctl status bemused-queue-worker'
```

### View logs

```bash
# Real-time API logs
ssh -p 10022 pfarrell@patf.com 'sudo journalctl -u bemused-api -f'

# Real-time queue worker logs
ssh -p 10022 pfarrell@patf.com 'sudo journalctl -u bemused-queue-worker -f'

# Recent logs
ssh -p 10022 pfarrell@patf.com 'sudo journalctl -u bemused-api -n 100'

# Logs since a specific time
ssh -p 10022 pfarrell@patf.com 'sudo journalctl -u bemused-api --since "10 minutes ago"'
```

### Manual service control

```bash
# API service
ssh -p 10022 pfarrell@patf.com 'sudo systemctl restart bemused-api'

# Queue worker
ssh -p 10022 pfarrell@patf.com 'sudo systemctl restart bemused-queue-worker'
```

### Test API endpoints

```bash
# Test random artists endpoint
curl https://patf.com/pshare/api/artists/random

# Test specific artist
curl https://patf.com/pshare/api/artist/1

# Test search
curl 'https://patf.com/pshare/api/search?q=beatles'
```

### Rollback to previous release

If a deployment causes issues, you can quickly rollback:

```bash
ssh -p 10022 pfarrell@patf.com

# List releases
ls -lt /var/www/bemused-node/releases/

# Point current to previous release
cd /var/www/bemused-node
ln -nfs releases/20260320120000 current

# Restart service
sudo systemctl restart bemused-api
```

## Environment Variables Reference

| Variable | Description | Dev Value | Prod Value |
|----------|-------------|-----------|------------|
| `BEMUSED_DB` | PostgreSQL connection string | `postgres://user:pass@localhost/bemused` | Server DB credentials |
| `PORT` | Port for Node.js API | `3000` | `3000` |
| `BEMUSED_PATH` | Base path prefix for stream URLs in responses | _(empty)_ | `/pshare` |
| `BEMUSED_UPLOAD_PATH` | Filesystem path where processed audio files are stored | _(local path)_ | NAS mount path |
| `BEMUSED_DEV` | Proxy target for streams when NAS unavailable in dev | `https://patf.com/pshare` | _(not used)_ |
| `NODE_ENV` | Node environment | `development` | `production` |

## Nginx Configuration Notes

The nginx config handles:

- **`/pshare/app`** → React SPA static files
- **`/pshare/api/*`** → Proxied to Node.js on port 3000 (strips `/pshare/api` prefix)
- **`/pshare/stream/*`** → Proxied to Node.js for audio streaming
- **`/pshare/images/`** → Static images from NAS (served by nginx)
- **`/pshare/mp3s/`** → Static audio files from NAS (served by nginx, no cache)

Range requests are properly supported for audio streaming.

## Security Notes

- The `.env` file contains database credentials - never commit it to git
- The deploy script uses SSH key authentication on port 10022
- Database should only accept local connections

## Common Issues

### "Module not found" errors
- Make sure `npm ci --omit=dev` runs successfully during deployment
- Check that all dependencies are in `dependencies`, not `devDependencies`

### "Cannot connect to database"
- Verify `.env` file exists at `/var/www/bemused-node/shared/.env`
- Check database credentials are correct
- Ensure PostgreSQL is running: `sudo systemctl status postgresql`

### 502 Bad Gateway
- Service may not be running: `sudo systemctl status bemused-api`
- Check logs: `sudo journalctl -u bemused-api -n 50`
- Verify port 3000 is correct in both `.env` and nginx config

### Uploads not processing
- Check queue worker is running: `sudo systemctl status bemused-queue-worker`
- Verify `BEMUSED_UPLOAD_PATH` is set in `/var/www/bemused-node/shared/.env`
- Check worker logs: `sudo journalctl -u bemused-queue-worker -n 50`

### No audio playback
- Check that `BEMUSED_PATH` is set correctly in production `.env`
- Verify NAS mount points are accessible
- Check nginx is serving `/pshare/mp3s/` from correct path
