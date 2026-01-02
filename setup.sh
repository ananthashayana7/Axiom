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
    cat > .env.local << EOF
DATABASE_URL=postgres://postgres:admin@localhost:5432/procurement_db
AUTH_SECRET=change_this_to_a_secure_secret_in_production
EOF
    echo "✓ .env.local created successfully!"
else
    echo "✓ .env.local already exists."
fi

echo
echo "Starting Docker containers..."
echo "This may take a few minutes on first run..."
echo

# Start containers
docker-compose up --build -d

if [ $? -ne 0 ]; then
    echo "❌ ERROR: Failed to start containers."
    exit 1
fi

echo
echo "Waiting for database to be ready..."
sleep 10

echo
echo "Seeding database..."
docker-compose exec -T app node -r tsx/cjs src/db/seed.ts

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
echo "  Stop:    docker-compose down"
echo "  Restart: docker-compose up -d"
echo "  Logs:    docker-compose logs -f"
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
