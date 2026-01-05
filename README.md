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

**Link:** `http://10.210.147.40:3000`

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

## ☁️ Cloud Hosting Guide (Production Deployment)

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
