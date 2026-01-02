@echo off
echo Axiom Portal Quick Setup (Docker Method)
echo ========================================
echo.

REM Check if Docker is running
docker version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Docker is not running or not installed.
    echo Please install Docker Desktop and start it.
    echo Download from: https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

echo Docker is running...
echo.

REM Create environment file if it doesn't exist
if not exist .env.local (
    echo Creating .env.local file...
    (
        echo DATABASE_URL=postgres://postgres:admin@localhost:5432/procurement_db
        echo AUTH_SECRET=change_this_to_a_secure_secret_in_production
    ) > .env.local
    echo .env.local created successfully!
) else (
    echo .env.local already exists.
)

echo.
echo Starting Docker containers (Development Mode)...
echo This may take a few minutes on first run...
echo.

docker-compose -f docker-compose.dev.yml up --build -d

if %errorlevel% neq 0 (
    echo ERROR: Failed to start containers.
    pause
    exit /b 1
)

echo.
echo Waiting for containers to start...
timeout /t 15 /nobreak >nul

echo.
echo Setting up database schema...
docker-compose -f docker-compose.dev.yml exec -T app npm run db:push

echo.
echo Seeding database with sample data...
docker-compose -f docker-compose.dev.yml exec -T app npm run db:seed

echo.
echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo Portal URL: http://localhost:3000
echo Login: admin@example.com
echo Password: password
echo.
echo To stop the portal: docker-compose -f docker-compose.dev.yml down
echo To restart: docker-compose -f docker-compose.dev.yml up -d
echo To view logs: docker-compose -f docker-compose.dev.yml logs -f
echo.
echo Press any key to open the portal in your browser...
pause >nul

REM Try to open the portal in default browser
start http://localhost:3000
