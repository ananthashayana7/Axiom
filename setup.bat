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
echo Starting Docker containers...
echo This may take a few minutes on first run...
echo.

docker-compose up --build -d

if %errorlevel% neq 0 (
    echo ERROR: Failed to start containers.
    pause
    exit /b 1
)

echo.
echo Waiting for database to be ready...
timeout /t 10 /nobreak >nul

echo.
echo Seeding database...
docker-compose exec -T app node -r tsx/cjs src/db/seed.ts

echo.
echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo Portal URL: http://localhost:3000
echo Login: admin@example.com
echo Password: password
echo.
echo To stop the portal: docker-compose down
echo To restart: docker-compose up -d
echo To view logs: docker-compose logs -f
echo.
echo Press any key to open the portal in your browser...
pause >nul

REM Try to open the portal in default browser
start http://localhost:3000
