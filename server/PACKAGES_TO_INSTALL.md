# Packages to Install for Upload Feature

Run these commands in the server directory:

```bash
cd /home/pfarrell/proj/bemused-spa/server

# For file uploads with Hono
npm install @hono/multipart

# For ID3 tag reading
npm install node-id3

# For MD5 hashing
# (built-in with Node.js crypto module - no install needed)

# For music metadata (duration, etc.)
npm install music-metadata
```

After installing, run:
```bash
npm run build
```
