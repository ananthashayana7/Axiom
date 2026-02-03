#!/bin/bash

echo "Axiom Portal Quick Setup (Docker Method)"
echo "========================================"
echo

# Check if Docker is running
if ! docker version > /dev/null 2>&1; then
    echo "❌ ERROR: Docker is not running or not installed."
    echo "Please install Docker Desktop and start it."
    echo "Download from: https://www.docker.com/products/docker-desktop"
    exit 1
fi

echo "✓ Docker is running..." 

# Create environment file if it doesn't exist
if [ ! -f .env.local ]; then
    echo "Creating .env.local file..."
    
    # Generate a random 32-character secret
    GENERATED_SECRET=$(openssl rand -base64 32 2>/dev/null || head -c 32 /dev/urandom | base64)
    
    echo ""
    echo "--- AI Configuration ---"
    read -p "Enter your GEMINI_API_KEY (leave blank to skip AI features): " GEMINI_KEY
    echo "--- AI Configuration Done ---"
    echo ""

    cat > .env.local << EOF
DATABASE_URL=postgres://postgres:admin@localhost:5432/procurement_db
AUTH_SECRET=$GENERATED_SECRET
GEMINI_API_KEY=$GEMINI_KEY
EOF
    echo "✓ .env.local created successfully with a unique secure secret!"
else
    echo "✓ .env.local already exists."
fi

echo
echo "Starting Docker containers (Development Mode)..."
echo "This may take a few minutes on first run..."
echo

# Start containers
docker-compose -f docker-compose.dev.yml up --build -d

if [ $? -ne 0 ]; then
    echo "❌ ERROR: Failed to start containers."
    exit 1
fi

echo
echo "Waiting for containers to start..."
sleep 15

echo
echo "Setting up database schema..."
docker-compose -f docker-compose.dev.yml exec -T app npm run db:push

echo
echo "Seeding database with sample data..."
docker-compose -f docker-compose.dev.yml exec -T app npm run db:seed

echo
echo "========================================"
echo "Setup Complete!"
echo "========================================"
echo
echo "Portal URL: http://localhost:3000"
echo "Login: admin@example.com"
echo "Password: password"
echo
echo "Commands:"
echo "  Stop:    docker-compose -f docker-compose.dev.yml down"
echo "  Restart: docker-compose -f docker-compose.dev.yml up -d"
echo "  Logs:    docker-compose -f docker-compose.dev.yml logs -f"
echo

# Ask to open browser
read -p "Press Enter to open the portal in your browser (or type 'n' to skip): " open_browser
if [ "$open_browser" != "n" ]; then
    # Try to open browser based on OS
    if command -v xdg-open > /dev/null; then
        xdg-open http://localhost:3000
    elif command -v open > /dev/null; then
        open http://localhost:3000
    elif command -v start > /dev/null; then
        start http://localhost:3000
    fi
fi
