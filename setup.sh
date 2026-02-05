#!/bin/bash

# CloudClawMac - Automated Setup Script
# This script handles everything needed to get the application running
# No manual intervention required - just run and follow the prompts

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_header() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "  ${BLUE}CloudClawMac${NC} - Automated Setup"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
}

# Detect platform
detect_platform() {
    log_info "Detecting platform..."

    if command -v docker &> /dev/null; then
        PLATFORM="docker"
        log_success "Docker detected - will use Docker Compose"
    elif command -v node &> /dev/null; then
        PLATFORM="node"
        log_success "Node.js detected - will use local development"
    else
        log_error "No supported platform found. Please install Docker or Node.js"
        exit 1
    fi
}

# Check dependencies
check_dependencies() {
    log_info "Checking dependencies..."

    if [ "$PLATFORM" = "docker" ]; then
        if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
            log_error "Docker Compose not found"
            exit 1
        fi
    fi

    log_success "All dependencies satisfied"
}

# Generate secrets
generate_secrets() {
    log_info "Generating secure secrets..."

    JWT_SECRET=$(openssl rand -base64 32 2>/dev/null || echo "change-me-in-production-$(date +%s)")
    DB_PASSWORD=$(openssl rand -base64 16 2>/dev/null || echo "postgres-$(date +%s)")

    log_success "Secrets generated"
}

# Create .env file
create_env_file() {
    log_info "Creating environment configuration..."

    if [ -f .env ]; then
        log_warning ".env file already exists. Skipping..."
        return
    fi

    cat > .env << EOF
# CloudClawMac Environment Configuration
# Generated on $(date)

# Application
NODE_ENV=development
FRONTEND_PORT=8080
BACKEND_PORT=3000

# Database
POSTGRES_USER=postgres
POSTGRES_PASSWORD=${DB_PASSWORD}
POSTGRES_DB=cloudclawmac
POSTGRES_PORT=5432

# Security
JWT_SECRET=${JWT_SECRET}

# Orka Configuration (to be filled in setup wizard)
ORKA_ENDPOINT=https://orka-api.macstadium.com
ORKA_USERNAME=
ORKA_PASSWORD=

# Trial Configuration
TRIAL_CREDITS=500
TRIAL_DURATION_DAYS=7
EOF

    log_success "Environment file created"
}

# Install dependencies
install_dependencies() {
    if [ "$PLATFORM" = "node" ]; then
        log_info "Installing Node.js dependencies..."

        cd backend
        if [ ! -d "node_modules" ]; then
            npm install --silent
            log_success "Backend dependencies installed"
        else
            log_info "Backend dependencies already installed"
        fi
        cd ..

        cd frontend
        if [ ! -d "node_modules" ]; then
            npm install --silent
            log_success "Frontend dependencies installed"
        else
            log_info "Frontend dependencies already installed"
        fi
        cd ..
    fi
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."

    if [ "$PLATFORM" = "docker" ]; then
        # Migrations run automatically in Docker
        log_success "Database migrations will run on container start"
    else
        cd backend
        if command -v psql &> /dev/null; then
            # Check if database exists
            if psql "postgresql://postgres:postgres@localhost:5432/cloudclawmac" -c "SELECT 1" &> /dev/null; then
                node src/migrations/run.js
                log_success "Database migrations completed"
            else
                log_warning "Database not available yet. Will be created on first run."
            fi
        else
            log_warning "psql not found. Please ensure PostgreSQL is running."
        fi
        cd ..
    fi
}

# Start services
start_services() {
    log_info "Starting services..."

    if [ "$PLATFORM" = "docker" ]; then
        if docker compose version &> /dev/null; then
            docker compose up -d
        else
            docker-compose up -d
        fi
        log_success "Services started with Docker Compose"
    else
        log_info "Please start services manually:"
        echo "  Terminal 1: cd backend && npm run dev"
        echo "  Terminal 2: cd frontend && npm run dev"
    fi
}

# Show next steps
show_next_steps() {
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "  ${GREEN}Setup Complete!${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo "Your CloudClawMac instance is ready!"
    echo ""
    echo "Next steps:"
    echo "  1. Open your browser to: ${BLUE}http://localhost:8080/setup${NC}"
    echo "  2. Complete the setup wizard"
    echo "  3. Start provisioning VMs!"
    echo ""
    echo "Useful commands:"
    if [ "$PLATFORM" = "docker" ]; then
        echo "  View logs: ${YELLOW}docker compose logs -f${NC}"
        echo "  Stop services: ${YELLOW}docker compose down${NC}"
    else
        echo "  Backend: ${YELLOW}cd backend && npm run dev${NC}"
        echo "  Frontend: ${YELLOW}cd frontend && npm run dev${NC}"
    fi
    echo ""
}

# Main setup flow
main() {
    print_header

    detect_platform
    check_dependencies
    generate_secrets
    create_env_file
    install_dependencies
    run_migrations
    start_services
    show_next_steps
}

# Run main function
main "$@"
