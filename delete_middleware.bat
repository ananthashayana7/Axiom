@echo off
cd /d c:\Axiom\Axiom
if exist src\middleware.ts (
    del src\middleware.ts
    echo middleware.ts deleted successfully
) else (
    echo File not found
)
