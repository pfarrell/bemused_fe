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
   BEMUSED_DEV=https://patf.com/bemused
   ```

3. **Start development server**:
   ```bash
   npm run dev
   ```

   The API will be available at `http://localhost:3000`

4. **Start the frontend** (in a separate terminal):
   ```bash
   cd /home/pfarrell/proj/bemused-spa
   npm run dev
   ```

   The frontend dev server will proxy `/api/*` requests to the backend on port 3000.

### Development Workflow

- **Backend changes**: The dev server (tsx watch) will automatically reload when you save TypeScript files
- **Frontend changes**: Vite dev server has hot module replacement (HMR) for instant updates
- **Database changes**: Use raw SQL or create migrations in `db/migrations/` if needed

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
BEMUSED_PATH=https://patf.com/bemused
NODE_ENV=production
```

### 2. Install systemd service

SSH to the server and install the service file:

```bash
ssh -p 10022 pfarrell@patf.com

# Copy service file
sudo cp /var/www/bemused-node/current/bemused-api.service /etc/systemd/system/

# Reload systemd and enable service
sudo systemctl daemon-reload
sudo systemctl enable bemused-api
```

**Note**: Don't start the service yet - it will start automatically after the first deployment.

### 3. Configure nginx

SSH to the server and install the nginx configuration:

```bash
ssh -p 10022 pfarrell@patf.com

# Copy nginx config
sudo cp /var/www/bemused-node/current/bemused.nginx.conf /etc/nginx/sites-available/bemused

# Enable site
sudo ln -sf /etc/nginx/sites-available/bemused /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

### 4. Link shared images to nginx-served location

Run the one-time setup script to create the symlink from `shared/public/images` to the nginx-served images directory:

```bash
cd server
./scripts/setup-shared-images.sh
```

This creates a symlink from `/var/www/bemused-node/shared/public/images` to `/var/www/bemused/shared/public/images`, which is the same location used by the Ruby app and served by nginx at `https://patf.net/images`.

After this is set up once, the deploy script will automatically:
- Create `releases/<timestamp>/public/images` as a symlink to `shared/public/images`
- Downloaded images will be saved to the shared location and persist across deployments

### 5. Verify database access

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
5. Update the `current` symlink to the new release
6. Restart the systemd service
7. Clean up old releases (keeps last 5)

## Deployment Workflow

Typical deployment workflow after making changes:

### Backend Deployment

```bash
# In the server directory
cd server

# Test locally first
npm run dev
# Visit http://localhost:3000/artists/random to verify

# Deploy to production
npm run deploy

# SSH to server and restart the service
ssh -p 10022 pfarrell@patf.com
sudo systemctl stop bemused-api
sudo systemctl start bemused-api
sudo systemctl status bemused-api
```

**Note**: Use `stop` then `start` instead of `restart` to ensure the code fully reloads.

### Frontend Deployment

```bash
# In the frontend directory
cd /home/pfarrell/proj/bemused-spa

# Test locally first
npm run dev
# Visit http://localhost:5173 to verify

# Deploy to production
npm run deploy
```

The frontend deploys to `/var/www/bemused/shared/public/frontend` and is served by nginx.

### Full Stack Deployment

When you've made changes to both frontend and backend:

```bash
# Deploy backend
cd server
npm run deploy

# Deploy frontend
cd ..
npm run deploy

# Restart backend service
ssh -p 10022 pfarrell@patf.com
sudo systemctl stop bemused-api
sudo systemctl start bemused-api
```

## Monitoring and Troubleshooting

### Check service status

```bash
ssh -p 10022 pfarrell@patf.com 'sudo systemctl status bemused-api'
```

### View logs

```bash
# Real-time logs
ssh -p 10022 pfarrell@patf.com 'sudo journalctl -u bemused-api -f'

# Recent logs
ssh -p 10022 pfarrell@patf.com 'sudo journalctl -u bemused-api -n 100'

# Logs since a specific time
ssh -p 10022 pfarrell@patf.com 'sudo journalctl -u bemused-api --since "10 minutes ago"'
```

### Manual service control

```bash
# Start service
ssh -p 10022 pfarrell@patf.com 'sudo systemctl start bemused-api'

# Stop service
ssh -p 10022 pfarrell@patf.com 'sudo systemctl stop bemused-api'

# Restart service
ssh -p 10022 pfarrell@patf.com 'sudo systemctl restart bemused-api'
```

### Test API endpoints

```bash
# Test random artists endpoint
curl https://patf.com/bemused/api/artists/random

# Test specific artist
curl https://patf.com/bemused/api/artist/1

# Test search
curl 'https://patf.com/bemused/api/search?q=beatles'
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
| `BEMUSED_PATH` | Base URL for stream links in responses | _(empty - uses localhost)_ | `https://patf.com/bemused` |
| `BEMUSED_DEV` | Proxy target when NAS unavailable in dev | `https://patf.net/bemused` | _(not used in prod)_ |
| `NODE_ENV` | Node environment | `development` | `production` |

## Nginx Configuration Notes

The nginx config handles:

- **`/bemused/app`** → React SPA static files
- **`/bemused/api/*`** → Proxied to Node.js on port 3000 (strips `/bemused/api` prefix)
- **`/bemused/stream/*`** → Proxied to Node.js for audio streaming
- **`/bemused/images/`** → Static images from NAS (served by nginx)
- **`/bemused/mp3s/`** → Static audio files from NAS (served by nginx, no cache)

Range requests are properly supported for audio streaming.

## Security Notes

- The `.env` file contains database credentials - never commit it to git
- The deploy script uses SSH key authentication on port 10022
- Database should only accept local connections
- Consider setting up SSL/TLS with Let's Encrypt (uncomment HTTPS redirect in nginx config)

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

### No audio playback
- Check that `BEMUSED_PATH` is set correctly in production `.env`
- Verify NAS mount points are accessible
- Check nginx is serving `/bemused/mp3s/` from correct path
