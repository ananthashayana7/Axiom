# Axiom Portal Quick Setup (Docker Method)
Write-Host "Axiom Portal Quick Setup (Docker Method)" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Check if Docker is running
try {
    docker version | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Docker not running"
    }
    Write-Host "✓ Docker is running..." -ForegroundColor Green 
} catch {
    Write-Host "❌ ERROR: Docker is not running or not installed." -ForegroundColor Red
    Write-Host "Please install Docker Desktop and start it." -ForegroundColor Yellow
    Write-Host "Download from: https://www.docker.com/products/docker-desktop" -ForegroundColor Cyan
    Read-Host "Press Enter to exit"
    exit 1
}

# Create environment file if it doesn't exist
if (-not (Test-Path ".env.local")) {
    Write-Host "Creating .env.local file..." -ForegroundColor Yellow
    
    $generatedSecret = [Convert]::ToBase64String((1..32 | ForEach-Object { [byte](Get-Random -Minimum 0 -Maximum 255) }))
    
    Write-Host ""
    Write-Host "--- AI Configuration ---" -ForegroundColor Cyan
    $geminiKey = Read-Host "Enter your GEMINI_API_KEY (leave blank to skip AI features)"
    Write-Host "--- AI Configuration Done ---" -ForegroundColor Cyan
    Write-Host ""

    @"
DATABASE_URL=postgres://postgres:admin@localhost:5432/procurement_db
AUTH_SECRET=$generatedSecret
GEMINI_API_KEY=$geminiKey
"@ | Out-File -FilePath ".env.local" -Encoding UTF8
    Write-Host "✓ .env.local created successfully with a unique secure secret!" -ForegroundColor Green
} else {
    Write-Host "✓ .env.local already exists." -ForegroundColor Green
}

Write-Host ""
Write-Host "Starting Docker containers (Development Mode)..." -ForegroundColor Yellow
Write-Host "This may take a few minutes on first run..." -ForegroundColor Gray
Write-Host ""

# Start containers
docker-compose -f docker-compose.dev.yml up --build -d

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ ERROR: Failed to start containers." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "Waiting for containers to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

Write-Host ""
Write-Host "Setting up database schema..." -ForegroundColor Yellow
docker-compose -f docker-compose.dev.yml exec -T app npm run db:push

Write-Host ""
Write-Host "Seeding database with sample data..." -ForegroundColor Yellow
docker-compose -f docker-compose.dev.yml exec -T app npm run db:seed

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Portal URL: http://localhost:3000" -ForegroundColor Cyan
Write-Host "Login: admin@example.com" -ForegroundColor Cyan
Write-Host "Password: password" -ForegroundColor Cyan
Write-Host ""
Write-Host "Commands:" -ForegroundColor Yellow
Write-Host "  Stop:    docker-compose -f docker-compose.dev.yml down" -ForegroundColor Gray
Write-Host "  Restart: docker-compose -f docker-compose.dev.yml up -d" -ForegroundColor Gray
Write-Host "  Logs:    docker-compose -f docker-compose.dev.yml logs -f" -ForegroundColor Gray
Write-Host ""

# Ask to open browser
$openBrowser = Read-Host "Press Enter to open the portal in your browser (or type 'n' to skip)"
if ($openBrowser -ne "n") {
    Start-Process "http://localhost:3000"
}
