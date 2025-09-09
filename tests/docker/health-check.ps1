#!/usr/bin/env pwsh
# =============================================================================
# Sniffler Test Environment - Health Check Script
# =============================================================================
# This script checks the health of all services in the test environment
# =============================================================================

$ErrorActionPreference = "Continue"

Write-Host "Health Check - Sniffler Test Environment" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# Get script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

# Check if docker-compose is running
Write-Host ""
Write-Host "Container Status:" -ForegroundColor Yellow
docker-compose -f docker-compose.test.yml ps

Write-Host ""
Write-Host "Database Connectivity Tests:" -ForegroundColor Yellow
Write-Host "----------------------------" -ForegroundColor Gray

# Test PostgreSQL 15
Write-Host "Testing PostgreSQL 15..." -NoNewline
try {
    $result = docker exec sniffler-test-postgres-15 psql -U testuser -d testdb -c "SELECT COUNT(*) FROM users;" 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host " OK" -ForegroundColor Green
    } else {
        Write-Host " FAILED" -ForegroundColor Red
    }
} catch {
    Write-Host " FAILED" -ForegroundColor Red
}

# Test MySQL 8
Write-Host "Testing MySQL 8.0..." -NoNewline
try {
    $result = docker exec sniffler-test-mysql-8 mysql -u testuser -ptestpass testdb -e "SELECT COUNT(*) FROM products;" 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host " OK" -ForegroundColor Green
    } else {
        Write-Host " FAILED" -ForegroundColor Red
    }
} catch {
    Write-Host " FAILED" -ForegroundColor Red
}

# Test MongoDB 7
Write-Host "Testing MongoDB 7.0..." -NoNewline
try {
    $result = docker exec sniffler-test-mongo-7 mongosh --eval "db.users.countDocuments()" testdb --quiet 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host " OK" -ForegroundColor Green
    } else {
        Write-Host " FAILED" -ForegroundColor Red
    }
} catch {
    Write-Host " FAILED" -ForegroundColor Red
}

# Test Redis 7
Write-Host "Testing Redis 7.0..." -NoNewline
try {
    $result = docker exec sniffler-test-redis-7 redis-cli -a testpass ping 2>$null
    if ($result -match "PONG") {
        Write-Host " OK" -ForegroundColor Green
    } else {
        Write-Host " FAILED" -ForegroundColor Red
    }
} catch {
    Write-Host " FAILED" -ForegroundColor Red
}

Write-Host ""
Write-Host "API Connectivity Tests:" -ForegroundColor Yellow
Write-Host "----------------------" -ForegroundColor Gray

# Test APIs
$apis = @(
    @{Name="Test API 1"; Port="3001"},
    @{Name="Test API 2"; Port="3002"},
    @{Name="Test API 3"; Port="3003"},
    @{Name="Test API 4"; Port="3004"}
)

foreach ($api in $apis) {
    Write-Host "Testing $($api.Name)..." -NoNewline
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$($api.Port)/health" -TimeoutSec 5 -UseBasicParsing 2>$null
        if ($response.StatusCode -eq 200) {
            Write-Host " OK" -ForegroundColor Green
        } else {
            Write-Host " FAILED (Status: $($response.StatusCode))" -ForegroundColor Red
        }
    } catch {
        Write-Host " FAILED" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Health check completed!" -ForegroundColor Cyan
