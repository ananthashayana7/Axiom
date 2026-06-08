#!/usr/bin/env python
import os
path = r"c:\Axiom\Axiom\src\middleware.ts"
if os.path.exists(path):
    os.remove(path)
    print(f"Deleted {path}")
else:
    print(f"File not found: {path}")
