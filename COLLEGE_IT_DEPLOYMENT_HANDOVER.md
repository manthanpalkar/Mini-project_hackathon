# LOOP SPIT — College IT Server Deployment & Handover Guide

This document contains the complete, production-ready operational guide for the **Sardar Patel Institute of Technology (SPIT) IT / Server Administration Team** to deploy and maintain the LOOP SPIT platform on institutional infrastructure (Linux server, on-premise VM, or institutional cloud).

---

## 1. Repository & Container Package Access

### 1.1 Source Repository
* **Repository URL:** [https://github.com/swapnil-exxe/loop](https://github.com/swapnil-exxe/loop)
* **Default Production Branch:** `main`

### 1.2 GitHub Container Registry (Pre-Built Docker Packages)
Pre-compiled production images are automatically built and published via GitHub Actions CI/CD to **GitHub Packages (GHCR)**:
* **Backend Image:** `ghcr.io/swapnil-exxe/loop-backend:latest`
* **Frontend Image:** `ghcr.io/swapnil-exxe/loop-frontend:latest`
* **Package Dashboard:** [https://github.com/swapnil-exxe/loop/packages](https://github.com/swapnil-exxe/loop/packages)

> [!TIP]
> With pre-built GitHub Packages, the college server does **not** need Node.js, npm, or frontend build toolchains. Docker pulls and runs the optimized production containers directly.

---

## 2. Environment Configuration (`.env`)

Create a `.env` file in the project root on the college server.

```bash
cp .env.example .env
nano .env
```

### Complete Production Configuration Template

```env
# ==============================================================================
# LOOP SPIT — College Server Environment Configuration
# ==============================================================================

# --- Server Ports & Host ---
NODE_ENV=production
FRONTEND_PORT=80
BACKEND_PORT=5001
HOST=0.0.0.0

# --- Database (MongoDB Atlas / College MongoDB Replica Set) ---
# Connection string with write and stream permissions for GridFS
MONGODB_URI=mongodb+srv://<college_db_user>:<college_db_password>@<cluster_address>/loop?retryWrites=true&w=majority

# GridFS Bucket Settings for Resumes and Study Material uploads
GRIDFS_BUCKET_NAME=loop_resources
GRIDFS_CHUNK_SIZE_MB=8
GRIDFS_UPLOAD_CONCURRENCY=6
RESUME_MAX_FILE_SIZE_BYTES=10485760

# --- Security & Cryptographic Tokens ---
# Generate each with: openssl rand -hex 32 (Must be 32+ characters)
JWT_SECRET=generate_a_secure_64_character_random_hex_string_here
RESET_SECRET=generate_another_secure_64_character_random_hex_string_here

# Allowed CORS origins (Comma-separated: server domain name and server IPs)
# Example: https://loop.spit.ac.in,http://<college-server-ip>
ALLOWED_ORIGIN=https://loop.spit.ac.in,http://localhost

# --- Google OAuth 2.0 (SPIT Institutional Single Sign-On) ---
# Restricted to @spit.ac.in domain in Google Cloud Console
GOOGLE_CLIENT_ID=your-spit-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-spit-google-client-secret
VITE_GOOGLE_CLIENT_ID=your-spit-google-client-id.apps.googleusercontent.com

# --- Transactional Email (Brevo SMTP for Password Reset OTPs) ---
# API Key from Brevo account (xkeysib-...)
BREVO_API_KEY=xkeysib-your_college_brevo_v3_api_key_here
EMAIL_FROM=tpo@spit.ac.in

# --- Redis Caching & Circuit Breaker (Optional) ---
# If college does not have a Redis instance, keep REDIS_ENABLED=false
# The backend will safely fallback to direct MongoDB queries without performance penalty
REDIS_ENABLED=false
REDIS_URL=redis://localhost:6379
REDIS_TTL_STORIES=300
REDIS_TTL_STORY_DETAIL=600
REDIS_TTL_RESOURCES=300
REDIS_TTL_RESOURCE_DETAIL=600
REDIS_TTL_ACHIEVEMENTS=600
REDIS_TTL_FOLDERS=300
```

> [!SECURITY NOTE]
> Never commit this `.env` file to Git. It is automatically excluded by `.gitignore` and `.dockerignore`.

---

## 3. Server Prerequisites & Docker Deployment

### 3.1 Server Requirements
* **OS:** Ubuntu 22.04 / 24.04 LTS, Debian 12, or RHEL 9 (64-bit x86_64 / amd64)
* **RAM:** Minimum 2 GB (4 GB recommended)
* **Disk:** Minimum 20 GB free disk space
* **Docker Engine:** v24.0 or newer
* **Docker Compose:** v2.20 or newer

#### Installation on Clean Ubuntu/Debian Server:
```bash
sudo apt update && sudo apt install -y docker.io docker-compose-v2
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
# Log out and log back in to apply group permissions
```

---

### 3.2 Step-by-Step Deployment

#### Step 1: Clone the Repository
```bash
git clone https://github.com/swapnil-exxe/loop.git
cd loop
```

#### Step 2: Configure Environment
```bash
cp .env.example .env
nano .env   # Fill in production database URI, secrets, and keys
```

#### Step 3: Launch Containers

**Option A: Using Pre-Built GitHub Packages (Fastest & Recommended)**
```bash
# Pull official pre-built production images from GitHub Packages
docker compose pull

# Start containers in detached mode
docker compose up -d
```

**Option B: Building Locally from Source Code**
```bash
# Build images locally on the server and start
docker compose up -d --build
```

#### Step 4: Verify Container Status
```bash
docker compose ps
```

**Expected Healthy Status Output:**
```
NAME            IMAGE                                         STATUS                    PORTS
loop-backend    ghcr.io/swapnil-exxe/loop-backend:latest      Up (healthy)              5001/tcp
loop-frontend   ghcr.io/swapnil-exxe/loop-frontend:latest     Up (healthy)              0.0.0.0:80->8080/tcp
```

---

### 3.3 Verify Deployment via HTTP Probes

Run these commands from the server terminal:

```bash
# 1. Test frontend static web server & SPA routing
curl -I http://localhost/

# 2. Test backend health check through Nginx reverse proxy
curl http://localhost/health

# 3. Test public platform visibility API
curl http://localhost/api/settings/visibility
```

**Expected `/health` JSON Response:**
```json
{
  "status": "healthy",
  "service": "loop-backend",
  "version": "2.2.0-gridfs-streaming",
  "dbState": "connected"
}
```

---

## 4. Institutional Domain & SSL Setup (`loop.spit.ac.in`)

To assign a campus subdomain with automated HTTPS / SSL certificates:

### Step 1: Adjust Port in `.env`
Change the frontend host port so the host Nginx can bind to standard port 80/443:
```env
FRONTEND_PORT=3000
```
Apply the change:
```bash
docker compose up -d
```

### Step 2: Install Host Nginx & Certbot
```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

### Step 3: Configure Host Reverse Proxy
Create `/etc/nginx/sites-available/loop.spit.ac.in`:
```nginx
server {
    server_name loop.spit.ac.in;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 250M;
    }
}
```

### Step 4: Enable Site & Issue SSL Certificate
```bash
sudo ln -s /etc/nginx/sites-available/loop.spit.ac.in /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d loop.spit.ac.in
```

---

## 5. Operational Maintenance Commands

| Operation | Command |
| :--- | :--- |
| **Pull & Apply Latest Update (Zero Rebuild)** | `docker compose pull && docker compose up -d` |
| **Rebuild & Apply Local Code Updates** | `git pull origin main && docker compose up -d --build` |
| **View Combined Live Logs** | `docker compose logs -f` |
| **View Backend API Logs** | `docker compose logs -f backend` |
| **View Frontend Web Logs** | `docker compose logs -f frontend` |
| **Restart Application** | `docker compose restart` |
| **Stop All Containers** | `docker compose down` |
| **Check Resource Utilization (CPU/RAM)** | `docker stats` |
| **Prune Old Unused Images** | `docker image prune -f` |

---

## 6. Database Backups & Recovery

### Automated MongoDB Atlas Backup (Recommended)
If using MongoDB Atlas, automated continuous snapshot backups are enabled under Atlas **Backup** tab.

### Manual CLI Backup (On-Premise or Local Replica Set)
```bash
# Export full database dump including GridFS files
mongodump --uri="<MONGODB_URI>" --out="/backup/loop-$(date +%F)"

# Restore database dump
mongorestore --uri="<MONGODB_URI>" --drop "/backup/loop-YYYY-MM-DD/loop"
```

---

## 7. Troubleshooting & FAQ for IT Administrators

### Q1: Port 80 is already in use by another service on the server
**Fix:** Set `FRONTEND_PORT=8080` (or any available port) in `.env` and restart containers (`docker compose up -d`).

### Q2: Backend health check shows `dbState: "disconnected"`
**Fix:** Verify that the college server's public outgoing IP address is added to the MongoDB Atlas **Network Access (IP Whitelist)**. Also verify that the database username and password in `MONGODB_URI` have no unencoded special characters.

### Q3: Large PDF file upload fails with HTTP 413
**Fix:** Nginx reverse proxy inside `frontend/nginx.conf` and host Nginx are already configured with `client_max_body_size 250M`. If using an external load balancer (Cloudflare, AWS ALB), ensure the maximum upload size is set to 50MB+.

### Q4: Google Single Sign-On fails with "redirect_uri_mismatch"
**Fix:** Go to **Google Cloud Console > Credentials > OAuth 2.0 Client IDs**, and add the college server's production URL (e.g. `https://loop.spit.ac.in`) to **Authorized JavaScript origins**.

---

## 8. College IT Handoff Sign-Off Checklist

- [ ] Repository cloned to `/opt/loop` or designated deployment directory.
- [ ] Production `.env` created with institutional database connection and 64-char secrets.
- [ ] College server IP added to MongoDB Atlas IP Whitelist.
- [ ] Containers started successfully and running in `healthy` state (`docker compose ps`).
- [ ] Frontend accessible in browser over HTTP/HTTPS.
- [ ] Backend `/health` endpoint returns HTTP 200 with `"status": "healthy"`.
- [ ] Google OAuth SSO tested with college email domain (`@spit.ac.in`).
- [ ] Password reset OTP email delivery verified via Brevo.
- [ ] Resume upload to GridFS tested from student profile.
- [ ] Institutional domain DNS record (`loop.spit.ac.in`) pointed to server and SSL verified.
