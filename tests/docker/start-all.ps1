#!/usr/bin/env pwsh
# =============================================================================
# Sniffler Test Environment - Complete Startup Script
# =============================================================================
# This script starts the entire test environment with one command
# 
# Usage: .\start-all.ps1 [options]
# Options:
#   -Build    : Force rebuild of API containers
#   -Clean    : Clean up old containers and volumes before starting
#   -Logs     : Show logs after startup
#   -Wait     : Wait for all services to be healthy before exiting
# =============================================================================

param(
    [switch]$Build = $false,
    [switch]$Clean = $false,
    [switch]$Logs = $false,
    [switch]$Wait = $false
)

$ErrorActionPreference = "Stop"

Write-Host "Starting Sniffler Test Environment..." -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan

# Get script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

# Clean up if requested
if ($Clean) {
    Write-Host "Cleaning up existing containers and volumes..." -ForegroundColor Yellow
    
    try {
        docker-compose -f docker-compose.test.yml down -v --remove-orphans
        docker system prune -f
        Write-Host "Cleanup completed" -ForegroundColor Green
    }
    catch {
        Write-Host "Warning: Cleanup had some issues, continuing anyway..." -ForegroundColor Yellow
    }
}

# Build containers if requested
$dockerArgs = @()
if ($Build) {
    Write-Host "Building API containers..." -ForegroundColor Yellow
    $dockerArgs += "--build"
}

# Start all services
Write-Host "Starting all Docker containers..." -ForegroundColor Blue
try {
    $dockerArgs += "-d"
    docker-compose -f docker-compose.test.yml up @dockerArgs
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "All containers started successfully!" -ForegroundColor Green
    } else {
        throw "Docker compose failed with exit code $LASTEXITCODE"
    }
}
catch {
    Write-Host "Failed to start containers: $_" -ForegroundColor Red
    exit 1
}

# Wait for services to be healthy
if ($Wait) {
    Write-Host "Waiting for all services to be healthy..." -ForegroundColor Yellow
    
    $maxWait = 300  # 5 minutes
    $elapsed = 0
    $interval = 5
    
    do {
        Start-Sleep $interval
        $elapsed += $interval
        
        try {
            $status = docker-compose -f docker-compose.test.yml ps --format "json" | ConvertFrom-Json
            $unhealthy = $status | Where-Object { $_.Health -ne "healthy" -and $_.Health -ne "" }
            
            if ($unhealthy.Count -eq 0) {
                Write-Host "All services are healthy!" -ForegroundColor Green
                break
            }
        }
        catch {
            # Continue waiting if status check fails
        }
        
        Write-Host "Still waiting... ($elapsed/$maxWait seconds)" -ForegroundColor Yellow
        
    } while ($elapsed -lt $maxWait)
    
    if ($elapsed -ge $maxWait) {
        Write-Host "Some services may not be fully ready yet" -ForegroundColor Yellow
    }
}

# Show service status
Write-Host ""
Write-Host "Service Status:" -ForegroundColor Cyan
docker-compose -f docker-compose.test.yml ps

# Show connection information
Write-Host ""
Write-Host "Connection Information:" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Databases:" -ForegroundColor White
Write-Host "  PostgreSQL 15:  localhost:5432  (testdb/testuser/testpass)" -ForegroundColor Gray
Write-Host "  PostgreSQL 13:  localhost:5433  (testdb_v13/testuser/testpass)" -ForegroundColor Gray
Write-Host "  MySQL 8.0:      localhost:3306  (testdb/testuser/testpass)" -ForegroundColor Gray
Write-Host "  MySQL 5.7:      localhost:3307  (testdb_v57/testuser/testpass)" -ForegroundColor Gray
Write-Host "  MongoDB 7.0:    localhost:27017 (admin/adminpass)" -ForegroundColor Gray
Write-Host "  MongoDB 5.0:    localhost:27018 (admin/adminpass)" -ForegroundColor Gray
Write-Host "  SQL Server 2022: localhost:1433 (sa/TestPass123!)" -ForegroundColor Gray
Write-Host "  SQL Server 2019: localhost:1434 (sa/TestPass123!)" -ForegroundColor Gray
Write-Host ""
Write-Host "Cache:" -ForegroundColor White
Write-Host "  Redis 7.0:      localhost:6379  (password: testpass)" -ForegroundColor Gray
Write-Host "  Redis 6.0:      localhost:6380  (password: testpass)" -ForegroundColor Gray
Write-Host ""
Write-Host "APIs:" -ForegroundColor White
Write-Host "  Test API 1:     http://localhost:3001" -ForegroundColor Gray
Write-Host "  Test API 2:     http://localhost:3002" -ForegroundColor Gray
Write-Host "  Test API 3:     http://localhost:3003" -ForegroundColor Gray
Write-Host "  Test API 4:     http://localhost:3004" -ForegroundColor Gray

# Show next steps
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "1. Read the testing guide: Get-Content .\SNIFFLER_TESTING_GUIDE.md" -ForegroundColor White
Write-Host "2. Start test servers: cd ..\..\..\test-servers; .\start-test-servers.ps1" -ForegroundColor White
Write-Host "3. Configure Sniffler to proxy through these databases" -ForegroundColor White
Write-Host "4. Run your tests!" -ForegroundColor White

# Show logs if requested
if ($Logs) {
    Write-Host ""
    Write-Host "Container Logs:" -ForegroundColor Cyan
    Write-Host "================================================" -ForegroundColor Cyan
    docker-compose -f docker-compose.test.yml logs --tail=50
}

Write-Host ""
Write-Host "Test environment is ready! Happy testing!" -ForegroundColor Green
