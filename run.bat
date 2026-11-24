@echo off
chcp 65001 >nul
title KineticSub Studio - Port 3001
cd /d "%~dp0"

echo ========================================================
echo        KineticSub Studio - Khoi dong he thong
echo ========================================================
echo.



:: 3. Thiet lap Port la 3001 theo yeu cau
set PORT=3001

:: 4. Tu dong mo trinh duyet sau khi server bat dau chay (doi 3s de server khoi tao xong)
echo [2/3] Dang khoi tao tien trinh tu dong mo trinh duyet...
start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:3001"

:: 5. Chay server dev
echo [3/3] Dang khoi dong server KineticSub Studio tai port %PORT%...
echo ========================================================
echo  Server dang chay tai: http://localhost:3001
echo  Trinh duyet se tu dong mo http://localhost:3001 trong giay lat!
echo  (Nhan Ctrl + C de dung server bat cu luc nao)
echo ========================================================
echo.

call npm run dev

if %errorlevel% neq 0 (
    echo.
    echo [THONG BAO] Server da dung hoac gap loi.
    pause
)
