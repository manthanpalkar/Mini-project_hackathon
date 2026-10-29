# LOOP SPIT — College IT Server Deployment & Handover Guide

This document contains the complete package for the **Sardar Patel Institute of Technology (SPIT) IT / Server Administration Team** to deploy the LOOP SPIT platform on college infrastructure (Linux server, on-premise VM, or institutional cloud).

---

## 1. Repository Access (Repo)

- **Repository URL:** [https://github.com/swapnil-exxe/loop](https://github.com/swapnil-exxe/loop)
- **Primary Branch:** `main`
- **Access Protocol:**
  - If private: Grant the IT Cell's GitHub account(s) `Read` or `Triage` permissions under **Settings > Collaborators**.
  - Clone command on the college server:
    ```bash
    git clone https://github.com/swapnil-exxe/loop.git
    cd loop
    ```

---

## 2. Environment Configuration (.env)

Create a `.env` file in the root directory of the cloned repository on the college server.

```bash
cp .env.example .env
nano .env
```

### Complete Production `.env` Template
Fill in the values below with the college's dedicated credentials:

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
# Connection string with write permissions for GridFS file streaming
MONGODB_URI=mongodb+srv://<college_db_user>:<college_db_password>@<cluster_address>/loop?retryWrites=true&w=majority

# GridFS Bucket Settings for PDF Resumes and Study Material uploads
GRIDFS_BUCKET_NAME=loop_resources
GRIDFS_CHUNK_SIZE_MB=8
GRIDFS_UPLOAD_CONCURRENCY=6
RESUME_MAX_FILE_SIZE_BYTES=10485760

# --- Security & Cryptographic Tokens ---
# Generate each with: openssl rand -hex 32 (Must be 32+ characters)
JWT_SECRET=generate_a_secure_64_character_random_hex_string_here
RESET_SECRET=generate_another_secure_64_character_random_hex_string_here

# Allowed CORS origins (Comma-separated: server domain name and IPs)
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
# If college does not have Redis, keep REDIS_ENABLED=false (system safely falls back to MongoDB)
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
> Never commit this `.env` file to Git. It is automatically ignored by `.gitignore` and `.dockerignore`.

---

## 3. Docker Deployment Instructions (Docker)

### Server Prerequisites
The college server (Ubuntu 22.04 / 24.04 LTS or Debian 12 recommended) requires:
- **Docker Engine** (v24.0 or newer)
- **Docker Compose Plugin** (v2.20 or newer)

To install on a clean Ubuntu/Debian server:
```bash
sudo apt update && sudo apt install -y docker.io docker-compose-v2
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
# Log out and log back in for group changes to take effect
```

---

### Step-by-Step Deployment Commands

```bash
# Step 1: Clone the repository
git clone https://github.com/swapnil-exxe/loop.git
cd loop

# Step 2: Configure environment
cp .env.example .env
nano .env   # (Add college MongoDB URI, JWT_SECRET, etc.)

# Step 3: Build and start containers in detached mode
docker compose up -d --build

# Step 4: Verify container health status
docker compose ps
```

Expected output:
```
NAME            IMAGE                  STATUS                    PORTS
loop-backend    loop-backend:latest    Up (healthy)              5001/tcp
loop-frontend   loop-frontend:latest   Up (healthy)              0.0.0.0:80->8080/tcp
```

---

### Step 5: Verify Deployment via HTTP Probes

```bash
# 1. Verify frontend web application
curl -I http://localhost/

# 2. Verify backend health check through Nginx reverse proxy
curl http://localhost/health

# 3. Verify public settings API
curl http://localhost/api/settings/visibility
```

---

### Step 6: SSL / TLS Domain Setup (Optional / Recommended)

If assigning a campus domain (e.g. `https://loop.spit.ac.in`):

#### Using Nginx Reverse Proxy with Certbot on the Host:
1. In `.env`, set `FRONTEND_PORT=3000` and restart:
   ```bash
   docker compose up -d
   ```
2. Install host Nginx and Certbot:
   ```bash
   sudo apt install -y nginx certbot python3-certbot-nginx
   ```
3. Create host Nginx configuration (`/etc/nginx/sites-available/loop.spit.ac.in`):
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
4. Enable site and issue free SSL certificate:
   ```bash
   sudo ln -s /etc/nginx/sites-available/loop.spit.ac.in /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   sudo certbot --nginx -d loop.spit.ac.in
   ```

---

## 4. Operational Maintenance Commands

| Action | Command |
| :--- | :--- |
| **View Live Logs (All)** | `docker compose logs -f` |
| **View Backend Logs** | `docker compose logs -f backend` |
| **View Frontend Logs** | `docker compose logs -f frontend` |
| **Restart Application** | `docker compose restart` |
| **Stop Application** | `docker compose down` |
| **Update to Latest Code** | `git pull origin main && docker compose up -d --build` |
| **Check Container Resources** | `docker stats` |

---

## 5. College IT Contact & Handoff Checklist

- [ ] Repository cloned to college server.
- [ ] Production `.env` populated with institutional credentials.
- [ ] MongoDB Atlas cluster IP whitelist updated with college server IP.
- [ ] Google Cloud Console Authorized JavaScript Origins updated with college server domain (`https://loop.spit.ac.in`).
- [ ] Brevo transactional sender email verified (`tpo@spit.ac.in`).
- [ ] Initial login tested with root administrator account (`admin@spit.ac.in`).
