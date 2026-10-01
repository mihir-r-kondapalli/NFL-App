"""Run both services and terminate their process groups together."""

import os
from pathlib import Path
import signal
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
processes = []
exit_code = 0
try:
    for command in (
        [sys.executable, "-m", "nflsim.cli", "serve", "--reload"],
        ["npm", "run", "dev", "--prefix", str(ROOT / "frontend/nfl-app")],
    ):
        processes.append(subprocess.Popen(command, cwd=ROOT, start_new_session=True))
    while all(process.poll() is None for process in processes):
        time.sleep(0.25)
except KeyboardInterrupt:
    pass
except OSError as exc:
    print(str(exc), file=sys.stderr)
    exit_code = 1
finally:
    for process in processes:
        if process.poll() is None:
            os.killpg(process.pid, signal.SIGTERM)
    for process in processes:
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
sys.exit(
    exit_code or next((p.returncode for p in processes if p.returncode and p.returncode > 0), 0)
)
