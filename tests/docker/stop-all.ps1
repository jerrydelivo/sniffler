#!/usr/bin/env pwsh
# =============================================================================
# Sniffler Test Environment - Stop Script
# =============================================================================
# This script stops the entire test environment
# 
# Usage: .\stop-all.ps1 [options]
# Options:
#   -Clean    : Remove containers and volumes (complete cleanup)
#   -Volumes  : Remove volumes only (keep containers for faster restart)
# =============================================================================

param(
    [switch]$Clean = $false,
    [switch]$Volumes = $false
)

$ErrorActionPreference = "Stop"

Write-Host "🛑 Stopping Sniffler Test Environment..." -ForegroundColor Red
Write-Host "================================================" -ForegroundColor Cyan

# Get script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

try {
    if ($Clean) {
        Write-Host "🧹 Stopping and removing all containers and volumes..." -ForegroundColor Yellow
        docker-compose -f docker-compose.test.yml down -v --remove-orphans
        Write-Host "✅ Complete cleanup finished" -ForegroundColor Green
    }
    elseif ($Volumes) {
        Write-Host "🗑️ Stopping containers and removing volumes..." -ForegroundColor Yellow
        docker-compose -f docker-compose.test.yml down -v
        Write-Host "✅ Containers stopped and volumes removed" -ForegroundColor Green
    }
    else {
        Write-Host "⏹️ Stopping containers..." -ForegroundColor Yellow
        docker-compose -f docker-compose.test.yml down
        Write-Host "✅ Containers stopped (volumes preserved for faster restart)" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "📊 Remaining containers:" -ForegroundColor Cyan
    docker ps --filter "name=sniffler-test" --format "table {{.Names}}\t{{.Status}}"
    
}
catch {
    Write-Host "❌ Failed to stop environment: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Test environment stopped successfully!" -ForegroundColor Green
