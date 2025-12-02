# Test script for STEP file upload and GLB conversion
# This script tests the upload endpoint with a model type

$API_BASE_URL = "http://localhost:8000"
$modelType = "wall_mounted_skin"

Write-Host "=== Testing STEP File Upload and GLB Conversion ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check backend health
Write-Host "Step 1: Checking backend health..." -ForegroundColor Yellow
try {
    $healthResponse = Invoke-WebRequest -Uri "$API_BASE_URL/api/health/" -UseBasicParsing -TimeoutSec 5
    Write-Host "✅ Backend is running (Status: $($healthResponse.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "❌ Backend is not running: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Please start the backend server with: python manage.py runserver 0.0.0.0:8000" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Step 2: Check if we have a STEP file to test with
Write-Host "Step 2: Looking for STEP files to test..." -ForegroundColor Yellow
$stepFiles = Get-ChildItem -Path ".." -Recurse -Filter "*.stp" -ErrorAction SilentlyContinue | Select-Object -First 1
$stepFiles += Get-ChildItem -Path ".." -Recurse -Filter "*.step" -ErrorAction SilentlyContinue | Select-Object -First 1

if ($stepFiles.Count -eq 0) {
    Write-Host "⚠️  No STEP files found in the project directory" -ForegroundColor Yellow
    Write-Host "To test STEP upload, you need a .stp or .step file" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Step 3: Testing upload endpoint structure..." -ForegroundColor Yellow
    
    # Test with a dummy file to check endpoint structure
    $testFile = [System.IO.Path]::GetTempFileName() + ".stp"
    "Dummy STEP file content" | Out-File -FilePath $testFile -Encoding ASCII
    
    try {
        $formData = @{
            file = Get-Item $testFile
            model_type = $modelType
        }
        
        Write-Host "Testing upload endpoint: $API_BASE_URL/api/upload-glb/" -ForegroundColor Cyan
        $uploadResponse = Invoke-WebRequest -Uri "$API_BASE_URL/api/upload-glb/" -Method POST -Form $formData -TimeoutSec 30
        
        if ($uploadResponse.StatusCode -eq 200 -or $uploadResponse.StatusCode -eq 201) {
            $responseData = $uploadResponse.Content | ConvertFrom-Json
            Write-Host "✅ Upload endpoint is accessible" -ForegroundColor Green
            Write-Host "Response: $($responseData | ConvertTo-Json -Depth 3)" -ForegroundColor Gray
        }
    } catch {
        Write-Host "❌ Upload test failed: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            Write-Host "Response: $responseBody" -ForegroundColor Red
        }
    } finally {
        Remove-Item $testFile -ErrorAction SilentlyContinue
    }
} else {
    Write-Host "✅ Found STEP file(s):" -ForegroundColor Green
    $stepFiles | ForEach-Object { Write-Host "  - $($_.FullName)" -ForegroundColor Gray }
    Write-Host ""
    
    # Step 3: Test upload with actual STEP file
    Write-Host "Step 3: Uploading STEP file..." -ForegroundColor Yellow
    $stepFile = $stepFiles[0]
    
    try {
        $formData = @{
            file = Get-Item $stepFile.FullName
            model_type = $modelType
        }
        
        Write-Host "Uploading: $($stepFile.Name)" -ForegroundColor Cyan
        Write-Host "Model Type: $modelType" -ForegroundColor Cyan
        Write-Host "File Size: $([math]::Round($stepFile.Length / 1MB, 2)) MB" -ForegroundColor Cyan
        Write-Host ""
        
        $uploadResponse = Invoke-WebRequest -Uri "$API_BASE_URL/api/upload-glb/" -Method POST -Form $formData -TimeoutSec 120
        
        if ($uploadResponse.StatusCode -eq 200 -or $uploadResponse.StatusCode -eq 201) {
            $responseData = $uploadResponse.Content | ConvertFrom-Json
            Write-Host "✅ Upload successful!" -ForegroundColor Green
            Write-Host ""
            Write-Host "Response Details:" -ForegroundColor Cyan
            Write-Host "  Success: $($responseData.success)" -ForegroundColor Gray
            Write-Host "  Message: $($responseData.message)" -ForegroundColor Gray
            Write-Host "  GLB File URL: $($responseData.glb_file_url)" -ForegroundColor Gray
            Write-Host "  Original File Type: $($responseData.original_file_type)" -ForegroundColor Gray
            Write-Host "  Converted from STEP: $($responseData.converted_from_step)" -ForegroundColor Gray
            Write-Host "  Model Type: $($responseData.model_type)" -ForegroundColor Gray
            Write-Host "  Design ID: $($responseData.design_id)" -ForegroundColor Gray
            Write-Host ""
            
            # Step 4: Verify GLB conversion
            if ($responseData.converted_from_step) {
                Write-Host "✅ STEP file was converted to GLB" -ForegroundColor Green
                
                # Check if GLB URL is accessible
                Write-Host ""
                Write-Host "Step 4: Verifying GLB file accessibility..." -ForegroundColor Yellow
                try {
                    $glbCheck = Invoke-WebRequest -Uri $responseData.glb_file_url -Method Head -TimeoutSec 10
                    Write-Host "✅ GLB file is accessible (Status: $($glbCheck.StatusCode))" -ForegroundColor Green
                } catch {
                    Write-Host "⚠️  GLB file check failed: $($_.Exception.Message)" -ForegroundColor Yellow
                }
            } else {
                Write-Host "⚠️  File was not converted (may already be GLB or conversion failed)" -ForegroundColor Yellow
            }
            
            # Step 5: Test fetching model by type
            Write-Host ""
            Write-Host "Step 5: Testing model retrieval by type..." -ForegroundColor Yellow
            try {
                $fetchUrl = "$API_BASE_URL/api/get-model-by-type/?model_type=$([System.Web.HttpUtility]::UrlEncode($modelType))"
                $fetchResponse = Invoke-WebRequest -Uri $fetchUrl -UseBasicParsing -TimeoutSec 10
                $fetchData = $fetchResponse.Content | ConvertFrom-Json
                
                if ($fetchData.success -and $fetchData.glb_url) {
                    Write-Host "✅ Model retrieved successfully" -ForegroundColor Green
                    Write-Host "  GLB URL: $($fetchData.glb_url)" -ForegroundColor Gray
                    Write-Host "  Title: $($fetchData.title)" -ForegroundColor Gray
                } else {
                    Write-Host "⚠️  Model retrieved but no GLB URL found" -ForegroundColor Yellow
                }
            } catch {
                Write-Host "❌ Failed to retrieve model: $($_.Exception.Message)" -ForegroundColor Red
            }
        }
    } catch {
        Write-Host "❌ Upload failed: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.Exception.Response) {
            try {
                $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                $responseBody = $reader.ReadToEnd()
                Write-Host "Response: $responseBody" -ForegroundColor Red
            } catch {
                Write-Host "Could not read error response" -ForegroundColor Red
            }
        }
    }
}

Write-Host ""
Write-Host "=== Test Complete ===" -ForegroundColor Cyan

