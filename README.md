# Axiom Procurement Platform

A Tacto-like procurement intelligence platform for managing suppliers, orders, and spend analytics.

---

## 🚀 Quick Access (Current Local Setup)

The platform is running on your machine. Your colleagues on the same network can access it at:

**Link:** `http://10.210.147.40:3000`

### Access Steps for Colleagues:
1. Open Chrome or Edge on their computer.
2. Enter the link above.
3. Log in with the credentials you provided (created in Admin → User Management).
4. **Desktop Icon:** Click the "Install" icon in the address bar to add the app to their desktop.

---

## 👥 Platform Features

| Feature | What You Can Do |
|---------|-----------------|
| **Dashboard** | View total spend (in ₹), active suppliers, and AI insights |
| **Sourcing → Orders** | Create new itemized RFQs and orders |
| **Suppliers** | Track vendors, risk scores, and full order history |
| **User Management** | (Admin Only) Create and manage colleague accounts |

### User Roles
- **Admins**: Can access everything, including creating/deleting users.
- **Users**: Can access Dashboard, Sourcing, and Suppliers, but not User Management.

---

## ☁️ Cloud Hosting Guide (Production Deployment)

When you are ready to move the platform to the cloud (AWS, DigitalOcean, etc.), follow these steps.

### 1. Prerequisites
- A Linux Virtual Private Server (VPS) - Ubuntu 22.04 recommended.
- Docker and Docker Compose installed on the server.

### 2. Deployment Steps

```bash
# 1. SSH into your server
ssh root@your-server-ip

# 2. Clone the repository
git clone <your-repo-url>
cd procurement-platform

# 3. Create a production environment file
# IMPORTANT: Generate a secure secret
nano .env.local
# Add: AUTH_SECRET=$(openssl rand -base64 32)
# Add: DATABASE_URL=postgres://postgres:admin@db:5432/procurement_db

# 4. Build and start the production containers
docker compose -f docker-compose.yml up -d --build

# 5. Push the database schema (first time only)
docker compose exec app npm run db:push

# 6. Seed initial admin data (one time)
docker compose exec app npm run db:seed
```

### 3. Domain & SSL (Recommended)
To use a real domain (e.g., `procure.company.com`) and HTTPS, use **Nginx** or **Caddy** as a reverse proxy.

**Example Caddyfile (easiest setup):**
```
procure.yourcompany.com {
    reverse_proxy localhost:3000
}
```

---

## 🛠️ Development & Local Commands

### Start Platform Locally
```bash
docker compose up -d
```

### Database Management
```bash
npm run db:push     # Update schema
npm run db:seed     # Reset/Seed data
```

---

## ⚠️ Important Security
1. **Change Default Admin Password**: After deployment, log in and change the password for `admin@example.com`.
2. **Backups**: Ensure you back up the Docker volume `procurement_db_data` regularly.

---

## 📞 Support
Contact your IT Lead for server access or issues.
