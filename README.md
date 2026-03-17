# Axiom Procurement Platform

A procurement intelligence platform for managing suppliers, orders, and spend analytics.

---

## Quick Start for New Users

### Option 1: Automated Setup (Recommended)
**Windows:** Double-click `setup.bat` or run `setup.ps1` in PowerShell  
**Linux/macOS:** Run `bash setup.sh`

This will automatically:
- Install and start Docker containers
- Create required environment files
- Seed the database with default admin user
- Open the portal in your browser

### Option 2: Manual Setup
```bash
# 1. Clone the repository
git clone https://github.com/ananthashayana7/Axiom.git
cd Axiom

# 2. Create environment file
echo "DATABASE_URL=postgres://postgres:admin@localhost:5432/procurement_db" > .env.local
echo "AUTH_SECRET=change_this_to_a_secure_secret_in_production" >> .env.local

# 3. Start with Docker
docker-compose up --build

# 4. In new terminal: Seed database
docker-compose exec app node -r tsx/cjs src/db/seed.ts
```

### Default Login
- **URL:** http://localhost:3000
- **Email:** admin@example.com
- **Password:** password

---

##  Quick Access (Current Local Setup)

The platform is running on your machine. Your colleagues on same network can access it at:


### Access Steps for Colleagues:
1. Open Chrome or Edge on their computer.
2. Enter the link above.
3. Log in with credentials you provided (created in Admin → User Management).
4. **Desktop Icon:** Click "Install" icon in address bar to add app to their desktop.

---

## 👥 Platform Features

| Feature | What You Can Do |
|---------|-----------------|
| **Dashboard** | View total spend (in ₹), active suppliers, and AI insights |
| **Sourcing → Orders** | Create new itemized RFQs and orders |
| **Suppliers** | Track vendors, risk scores, and full order history |
| **User Management** | (Admin Only) Create and manage colleague accounts |
| **Profile** | Users can change their own password and update profile |

### User Roles
- **Admins**: Can access everything, including creating/deleting users.
- **Users**: Can access Dashboard, Sourcing, Suppliers, and Profile (password change).

---

## 📋 Setup Requirements

### Required Software
- **Docker Desktop** - [Download here](https://www.docker.com/products/docker-desktop)
- **Git** - [Download here](https://git-scm.com/)

### For Company Networks
If npm doesn't work due to network restrictions:
- **Use Docker method** (recommended) - No npm installation needed
- **See SETUP.md** for detailed troubleshooting and alternative methods

---

##  Cloud Hosting Guide (Production Deployment)

When you are ready to move the platform to the cloud (AWS, DigitalOcean, etc.), follow these steps.

### 1. Prerequisites
- A Linux Virtual Private Server (VPS) - Ubuntu 22.04 recommended.
- Docker and Docker Compose installed on the server.

### 2. Deployment Steps

```bash
# 1. SSH into your server
ssh root@your-server-ip

# 2. Clone repository
git clone https://github.com/ananthashayana7/Axiom.git
cd Axiom

# 3. Create a production environment file
# IMPORTANT: Generate a secure secret
nano .env.local
# Add: AUTH_SECRET=$(openssl rand -base64 32)
# Add: DATABASE_URL=postgres://postgres:admin@db:5432/procurement_db

# 4. Build and start production containers
docker compose -f docker-compose.yml up -d --build

# 5. Push database schema (first time only)
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

### 4. Azure Deployment Reference

This repository includes a production compose template and env template:

- `docker-compose.prod.yml`
- `.env.production.example`

Recommended Azure setup for 10,000+ users:

1. `Azure App Service` (or AKS) for running the app container.
2. `Azure Database for PostgreSQL` for managed relational storage.
3. `Azure Cache for Redis` for caching and queue-like workloads.
4. `Azure Blob Storage` for invoice/contracts/document assets.

Quick start:

```bash
# 1) copy and edit env values
cp .env.production.example .env.production

# 2) run production stack
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build

# 3) push schema/migrations
docker compose --env-file .env.production -f docker-compose.prod.yml exec app npm run db:push

# 4) run pre-live smoke checks against the deployed URL
BASE_URL=https://axiom.your-domain.com npm run smoke:prelive
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

### Useful Commands
```bash
# Stop platform
docker-compose down

# View logs
docker-compose logs -f

# Restart services
docker-compose restart

# Access database directly
docker-compose exec db psql -U postgres -d procurement_db
```

### Outlook SMTP for Support Tickets
Users can open tickets from `/support`; admins manage and close them from `/admin/support`.

To enable real email delivery (instead of log-only mode):

1. Create/update your `.env` with SMTP settings (either `SMTP_PASS` or `SMTP_PASSWORD` is accepted):
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=pma.axiom.support@gmail.com
SMTP_PASS=<app-password>     # or set SMTP_PASSWORD
SMTP_FROM=pma.axiom.support@gmail.com
SMTP_SECURE=false            # set to true only for port 465
```
2. Rebuild/restart app:
```bash
docker compose up -d --build app
```

Expected behavior:
- User submits ticket → support mailbox receives new ticket mail.
- Admin updates/closes ticket in `/admin/support` → ticket owner receives update mail.

---

## ⚠️ Important Security
1. **Change Default Admin Password**: After deployment, log in and change the password for `admin@example.com`.
2. **Backups**: Ensure you back up Docker volume `procurement_db_data` regularly.
3. **AUTH_SECRET**: Change the default AUTH_SECRET in production to a secure random string.

---

## 📞 Support & Troubleshooting

**For setup issues:**
- Check the detailed [SETUP.md](./SETUP.md) guide
- Ensure Docker Desktop is running
- Verify ports 3000 and 5432 are available

**For platform issues:**
- Contact your IT Lead for server access or issues.
- Check browser console for errors
- Verify database connection: `docker-compose logs db`

---

## 📁 Project Structure

```
Axiom/
├── src/
│   ├── app/              # Next.js app router pages
│   ├── components/       # Reusable UI components
│   ├── db/              # Database schema and connection
│   └── lib/             # Utility functions
├── docker-compose.yml    # Docker configuration
├── SETUP.md             # Detailed setup guide
├── setup.bat            # Windows setup script
├── setup.ps1            # PowerShell setup script
└── setup.sh             # Linux/macOS setup script




## Price Trend Agent:##  Analyzes long-term market and supplier price trends to determine the most strategic timing for negotiations.

## Raw Material Monitoring Agent:##  Tracks commodity indices linked to purchase prices, ensuring proactive adjustments to cost fluctuations.
