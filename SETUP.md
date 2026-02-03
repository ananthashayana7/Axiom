# Axiom Portal Setup Guide

This guide will help you set up the Axiom procurement portal from scratch, especially in environments where npm/network access is restricted.

## Prerequisites

### Required Software
- **Node.js** (v18 or higher) - Download from [nodejs.org](https://nodejs.org/)
- **Docker Desktop** - Download from [docker.com](https://www.docker.com/products/docker-desktop/)
- **Git** - Download from [git-scm.com](https://git-scm.com/)

### For Company Networks
If npm doesn't work due to network restrictions, you have several options:

1. **Use Docker (Recommended)** - No npm installation needed
2. **Use offline npm packages** - Pre-download dependencies
3. **Configure npm proxy** - If your company allows it

---

## Method 1: Docker Setup (Recommended for Company Networks)

This method doesn't require npm installation and works completely offline after initial setup.

### Step 1: Clone the Repository
```bash
git clone https://github.com/ananthashayana7/Axiom.git
cd Axiom
```

### Step 2: Create Environment File
Create `.env.local` file in the root directory. You can use the provided setup scripts (`setup.bat` for Windows, `setup.sh` for Linux/Mac) which will guide you through this process.

```env
DATABASE_URL=postgres://postgres:admin@localhost:5432/procurement_db
AUTH_SECRET=a_randomly_generated_secure_string
GEMINI_API_KEY=your_gemini_api_key_here
```

> [!IMPORTANT]
> The **Gemini API Key** is required for AI features like supplier recommendation and quote parsing. You can get one from the [Google AI Studio](https://aistudio.google.com/).


### Step 3: Start with Docker
```bash
# Build and start all services
docker-compose up --build

# Or run in background
docker-compose up --build -d
```

### Step 4: Seed the Database
The first time you run, you'll need to seed the database:
```bash
# Run this in a new terminal
docker-compose exec app node -r tsx/cjs src/db/seed.ts
```

### Step 5: Access the Portal
- **Portal**: http://localhost:3000
- **Default Login**: admin@example.com / password

---

## Method 2: Local Setup with npm (If Network Allows)

### Step 1: Clone and Install Dependencies
```bash
git clone https://github.com/ananthashayana7/Axiom.git
cd Axiom

# If npm works in your network
npm install
```

### Step 2: Environment Setup
Create `.env.local`:
```env
DATABASE_URL=postgres://postgres:admin@localhost:5432/procurement_db
AUTH_SECRET=change_this_to_a_secure_secret_in_production
```

### Step 3: Start Database
```bash
# Start PostgreSQL using Docker
docker-compose up db -d
```

### Step 4: Setup Database
```bash
# Push database schema
npm run db:push

# Seed the database
npm run db:seed
```

### Step 5: Start Development Server
```bash
npm run dev
```

---

## Method 3: Offline Setup (Pre-download Dependencies)

### Step 1: Download Dependencies Package
Ask someone with network access to create a dependencies package:

```bash
# On a machine with internet access
cd Axiom
npm install
tar -czf axiom-deps.tar.gz node_modules
```

### Step 2: Transfer and Extract
```bash
# Transfer axiom-deps.tar.gz to your machine
tar -xzf axiom-deps.tar.gz

# Now you have node_modules without needing npm
```

### Step 3: Continue with Method 1 or 2
Use Docker or local setup as described above.

---

## Method 4: Using npm with Proxy (If Allowed)

If your company has an npm proxy, configure it:

```bash
npm config set proxy http://your-company-proxy:port
npm config set https-proxy http://your-company-proxy:port
npm config set registry http://your-company-npm-registry/
```

Then proceed with Method 2.

---

## Troubleshooting

### Database Connection Issues
```bash
# Check if PostgreSQL is running
docker-compose ps

# Restart database
docker-compose restart db

# Check database logs
docker-compose logs db
```

### Port Conflicts
If ports 3000 or 5432 are occupied, modify `docker-compose.yml`:
```yaml
ports:
  - "3001:3000"  # Change 3000 to 3001
  - "5433:5432"  # Change 5432 to 5433
```

And update `.env.local`:
```env
DATABASE_URL=postgres://postgres:admin@localhost:5433/procurement_db
```

### PowerShell Script Issues (Windows)
If you get "scripts are disabled" errors:
```powershell
# Run this once in PowerShell as Administrator
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Docker Issues
```bash
# Clean up Docker if needed
docker-compose down -v
docker system prune -f
docker-compose up --build
```

---

## Quick Start Commands

### Docker Method (Recommended)
```bash
git clone https://github.com/ananthashayana7/Axiom.git
cd Axiom
echo "DATABASE_URL=postgres://postgres:admin@localhost:5432/procurement_db" > .env.local
echo "AUTH_SECRET=change_this_to_a_secure_secret_in_production" >> .env.local
docker-compose up --build
# In new terminal: docker-compose exec app node -r tsx/cjs src/db/seed.ts
```

### Verify Setup
1. Visit http://localhost:3000
2. Login with: admin@example.com / password
3. You should see the dashboard
4. Test profile password change functionality

---

## Production Deployment

For production deployment:

1. **Change AUTH_SECRET** to a secure random string
2. **Update database credentials** in docker-compose.yml
3. **Use HTTPS** with proper SSL certificates
4. **Set up proper backups** for the database
5. **Configure environment variables** for production

---

## Need Help?

If you encounter issues:

1. Check the troubleshooting section above
2. Verify Docker Desktop is running
3. Ensure ports 3000 and 5432 are available
4. Check that `.env.local` exists with correct values
5. Review Docker logs: `docker-compose logs`

The Docker method (Method 1) is the most reliable for company networks as it doesn't require npm installation or internet access after the initial clone.
