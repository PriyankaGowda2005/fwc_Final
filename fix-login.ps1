# Fix Login Issues Script
Write-Host "Fixing Login Issues..." -ForegroundColor Cyan
Write-Host ""

# 1. Check if .env exists
Write-Host "1. Checking .env file..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
    Write-Host "   Creating .env file..." -ForegroundColor Green
    Copy-Item "env.example" ".env"
    Write-Host "   .env file created" -ForegroundColor Green
} else {
    Write-Host "   .env file exists" -ForegroundColor Green
}

# 2. Check MongoDB connection
Write-Host ""
Write-Host "2. Checking MongoDB connection..." -ForegroundColor Yellow
try {
    $mongoTest = Test-NetConnection -ComputerName localhost -Port 27017 -WarningAction SilentlyContinue
    if ($mongoTest.TcpTestSucceeded) {
        Write-Host "   MongoDB is running on port 27017" -ForegroundColor Green
    } else {
        Write-Host "   WARNING: MongoDB is not running on port 27017" -ForegroundColor Yellow
        Write-Host "   Start MongoDB: net start MongoDB" -ForegroundColor Cyan
    }
} catch {
    Write-Host "   Could not check MongoDB connection" -ForegroundColor Yellow
}

# 3. Create demo users
Write-Host ""
Write-Host "3. Creating demo users..." -ForegroundColor Yellow
Set-Location "apps\backend"
node src/scripts/createAllDemoUsers.js
Set-Location ..\..

# 4. Check backend server
Write-Host ""
Write-Host "4. Checking backend server..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/health" -TimeoutSec 2 -ErrorAction Stop
    Write-Host "   Backend server is running on port 3001" -ForegroundColor Green
} catch {
    Write-Host "   WARNING: Backend server is not running on port 3001" -ForegroundColor Yellow
    Write-Host "   Start backend: cd apps\backend; npm run dev" -ForegroundColor Cyan
}

# 5. Check frontend server
Write-Host ""
Write-Host "5. Checking frontend server..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5174" -TimeoutSec 2 -ErrorAction Stop
    Write-Host "   Frontend server is running on port 5174" -ForegroundColor Green
} catch {
    Write-Host "   WARNING: Frontend server is not running on port 5174" -ForegroundColor Yellow
    Write-Host "   Start frontend: cd apps\frontend; npm run dev" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Login Credentials:" -ForegroundColor White
Write-Host "Admin:    admin@fwcinfotech.com / admin123" -ForegroundColor White
Write-Host "HR:       hr@fwcinfotech.com / HR@2024!" -ForegroundColor White
Write-Host "Manager:  manager@fwcinfotech.com / manager123" -ForegroundColor White
Write-Host "Employee: employee@fwcinfotech.com / employee123" -ForegroundColor White
Write-Host "Candidate: candidate.demo@fwcinfotech.com / candidate123" -ForegroundColor White
Write-Host ""
Write-Host "Fix script completed!" -ForegroundColor Green
