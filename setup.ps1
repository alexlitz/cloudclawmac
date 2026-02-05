# CloudClawMac - Automated Setup Script for Windows
# Run: .\setup.ps1

$ErrorActionPreference = "Stop"

# Helper functions
function Log-Info {
    Write-Host "ℹ $args" -ForegroundColor Blue
}

function Log-Success {
    Write-Host "✓ $args" -ForegroundColor Green
}

function Log-Error {
    Write-Host "✗ $args" -ForegroundColor Red
}

function Log-Warning {
    Write-Host "⚠ $args" -ForegroundColor Yellow
}

function Print-Header {
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Blue
    Write-Host "  CloudClawMac - Automated Setup" -ForegroundColor Blue
    Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Blue
    Write-Host ""
}

# Detect platform
function Detect-Platform {
    Log-Info "Detecting platform..."

    if (Get-Command docker -ErrorAction SilentlyContinue) {
        $script:PLATFORM = "docker"
        Log-Success "Docker detected - will use Docker Compose"
    } elseif (Get-Command node -ErrorAction SilentlyContinue) {
        $script:PLATFORM = "node"
        Log-Success "Node.js detected - will use local development"
    } else {
        Log-Error "No supported platform found. Please install Docker Desktop or Node.js"
        exit 1
    }
}

# Generate secrets
function Generate-Secrets {
    Log-Info "Generating secure secrets..."

    $jwtSecret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})
    $dbPassword = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 16 | % {[char]$_})

    $script:JWT_SECRET = $jwtSecret
    $script:DB_PASSWORD = $dbPassword

    Log-Success "Secrets generated"
}

# Create .env file
function Create-EnvFile {
    Log-Info "Creating environment configuration..."

    if (Test-Path .env) {
        Log-Warning ".env file already exists. Skipping..."
        return
    }

    @"
# CloudClawMac Environment Configuration
# Generated on $(Get-Date)

# Application
NODE_ENV=development
FRONTEND_PORT=8080
BACKEND_PORT=3000

# Database
POSTGRES_USER=postgres
POSTGRES_PASSWORD=$script:DB_PASSWORD
POSTGRES_DB=cloudclawmac
POSTGRES_PORT=5432

# Security
JWT_SECRET=$script:JWT_SECRET

# Orka Configuration (to be filled in setup wizard)
ORKA_ENDPOINT=https://orka-api.macstadium.com
ORKA_USERNAME=
ORKA_PASSWORD=

# Trial Configuration
TRIAL_CREDITS=500
TRIAL_DURATION_DAYS=7
"@ | Out-File -FilePath .env -Encoding utf8

    Log-Success "Environment file created"
}

# Install dependencies
function Install-Dependencies {
    if ($script:PLATFORM -eq "node") {
        Log-Info "Installing Node.js dependencies..."

        if (!(Test-Path backend\node_modules)) {
            Set-Location backend
            npm install --silent
            Set-Location ..
            Log-Success "Backend dependencies installed"
        } else {
            Log-Info "Backend dependencies already installed"
        fi

        if (!(Test-Path frontend\node_modules)) {
            Set-Location frontend
            npm install --silent
            Set-Location ..
            Log-Success "Frontend dependencies installed"
        } else {
            Log-Info "Frontend dependencies already installed"
        }
    }
}

# Start services
function Start-Services {
    Log-Info "Starting services..."

    if ($script:PLATFORM -eq "docker") {
        docker compose up -d
        Log-Success "Services started with Docker Compose"
    } else {
        Log-Info "Please start services manually:"
        Write-Host "  Terminal 1: cd backend; npm run dev" -ForegroundColor Yellow
        Write-Host "  Terminal 2: cd frontend; npm run dev" -ForegroundColor Yellow
    }
}

# Show next steps
function Show-NextSteps {
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host "  Setup Complete!" -ForegroundColor Green
    Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host ""
    Write-Host "Your CloudClawMac instance is ready!"
    Write-Host ""
    Write-Host "Next steps:"
    Write-Host "  1. Open your browser to: http://localhost:8080/setup"
    Write-Host "  2. Complete the setup wizard"
    Write-Host "  3. Start provisioning VMs!"
    Write-Host ""
    Write-Host "Useful commands:"
    if ($script:PLATFORM -eq "docker") {
        Write-Host "  View logs: docker compose logs -f" -ForegroundColor Yellow
        Write-Host "  Stop services: docker compose down" -ForegroundColor Yellow
    } else {
        Write-Host "  Backend: cd backend; npm run dev" -ForegroundColor Yellow
        Write-Host "  Frontend: cd frontend; npm run dev" -ForegroundColor Yellow
    }
    Write-Host ""
}

# Main setup flow
Print-Header
Detect-Platform
Generate-Secrets
Create-EnvFile
Install-Dependencies
Start-Services
Show-NextSteps
