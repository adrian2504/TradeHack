"""
edge_build_and_profile_model.py

End-to-end Qualcomm AI Hub demo:

1) Define a tiny PyTorch model (TinyNet).
2) Export it to ONNX as `my_model.onnx` with a *static* input shape [1, 3].
3) Use the Qualcomm AI Hub Python SDK (qai_hub) with the token
   you configured via:

       qai-hub configure --api_token YOUR_TOKEN

4) Submit ONNX directly to AI Hub for profiling on one or more devices.
5) Wait for each profile job to finish (up to a timeout) and print
   job URL + final status or a “still running” note.

You need:
- torch
- onnx
- qai-hub
- python-dotenv (optional, only if you want to set QAI_DEVICE_LIST via .env)
"""

from __future__ import annotations

import os
from typing import List

from dotenv import load_dotenv

# Load .env if present (so QAI_DEVICE_LIST can live there if you want)
load_dotenv()

import torch
import torch.nn as nn
import qai_hub as hub


# ---------------------------------------------------------------------------
# 1. Tiny PyTorch model -> ONNX
# ---------------------------------------------------------------------------

class TinyNet(nn.Module):
    """
    Very small MLP: input_dim -> hidden_dim -> 1
    Just a placeholder model to send to AI Hub.
    """

    def __init__(self, input_dim: int = 3, hidden_dim: int = 8):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, 1),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


def build_and_export_onnx(
    onnx_path: str = "my_model.onnx",
    input_dim: int = 3,
) -> str:
    """
    Create TinyNet, export to ONNX, and return the ONNX file path.

    NOTE: We export with a *static* input shape [1, input_dim]
    (no dynamic_axes), because Qualcomm AI Hub's profiling path
    does not support dynamic shapes like [-1, 3].
    """
    torch.manual_seed(42)

    model = TinyNet(input_dim=input_dim)
    model.eval()

    # Static dummy input: batch_size=1, input_dim features
    dummy_input = torch.randn(1, input_dim)

    # Export to ONNX with static shape (no dynamic_axes)
    torch.onnx.export(
        model,
        dummy_input,
        onnx_path,
        input_names=["input"],
        output_names=["output"],
        opset_version=18,  # modern opset, works well with ONNX Runtime
        # important: no dynamic_axes here, so input is [1, 3], not [-1, 3]
    )

    print(f"[BUILD] Exported TinyNet to ONNX: {onnx_path}")
    return onnx_path


# ---------------------------------------------------------------------------
# 2. Device helpers
# ---------------------------------------------------------------------------

def get_device_names_from_env() -> List[str]:
    """
    Read target devices from QAI_DEVICE_LIST, or use a default.

    Example (PowerShell):
      $env:QAI_DEVICE_LIST="Samsung Galaxy S24 (Family);Samsung Galaxy S23 (Family)"

    If not set, defaults to just Samsung Galaxy S24 (Family).
    """
    raw = os.getenv("QAI_DEVICE_LIST", "Samsung Galaxy S24 (Family)")
    names = [n.strip() for n in raw.split(";") if n.strip()]
    if not names:
        raise ValueError("No device names found. Set QAI_DEVICE_LIST or use the default.")
    return names


# ---------------------------------------------------------------------------
# 3. Submit + wait for profile jobs
# ---------------------------------------------------------------------------

def submit_profile_jobs(
    model_path: str,
    device_names: List[str],
) -> List[hub.ProfileJob]:
    """
    Submit ONNX profiling jobs to AI Hub for each device name.
    This uses the token already configured via `qai-hub configure`.
    """
    jobs: List[hub.ProfileJob] = []

    for name in device_names:
        device = hub.Device(name)
        print(f"Submitting profile job for device: {name}")
        try:
            job = hub.submit_profile_job(
                model=model_path,
                device=device,
                name=f"TinyNet profiling on {name}",
                options=os.getenv("QAI_PROFILE_OPTIONS", ""),
            )
        except Exception as e:
            print(f"  ❌ Failed to submit profile job for {name}: {e}")
            continue

        jobs.append(job)
        job_url = getattr(job, "url", "(no url attr)")
        job_id = getattr(job, "id", "(no id attr)")
        print(f"  ✅ Submitted. Job id: {job_id}, URL: {job_url}")

    return jobs


def wait_for_profile_jobs(jobs: List[hub.ProfileJob], timeout_sec: int = 300) -> None:
    """
    Wait for each profile job to finish and print status + URLs.

    - If the job finishes within timeout_sec, we print the final status.
    - If the job is still running after timeout_sec, we print a note and
      move on (the job continues running on AI Hub; you can monitor it
      via the printed URL).
    """
    if not jobs:
        print("[PROFILE] No jobs to wait for.")
        return

    print()
    print(f"Waiting for up to {timeout_sec} seconds per job for profiling to complete...")

    for job in jobs:
        job_id = getattr(job, "id", "(no id attr)")
        job_url = getattr(job, "url", "(no url attr)")

        print(f"\n[PROFILE] Job: {job_id}")
        print(f"         URL: {job_url}")
        print("  Waiting...")

        try:
            status = job.wait(timeout=timeout_sec)
        except Exception as e:
            msg = str(e)
            if "timed out" in msg.lower():
                print("  ⏱️ Local wait timed out, but the job is still running on AI Hub.")
                print("  👉 Open the URL above in your browser to see live status and results.")
            else:
                print(f"  ❌ Error while waiting: {e}")
            # Move on to the next job
            continue

        print("  ✅ Done.")
        print(f"  Final status: {status}")


# ---------------------------------------------------------------------------
# 4. Main entry point
# ---------------------------------------------------------------------------

def main() -> None:
    # Use verbose logging so you see HTTP calls / statuses from qai_hub
    hub.set_verbose(True)

    # Build + export ONNX
    onnx_path = build_and_export_onnx("my_model.onnx", input_dim=3)

    # Read target devices
    device_names = get_device_names_from_env()

    print("\n=== Qualcomm AI Hub Edge Demo (Direct ONNX Profiling) ===")
    print(f"Local model: {onnx_path}")
    print("Target devices:")
    for n in device_names:
        print(f"  - {n}")
    profile_opts = os.getenv("QAI_PROFILE_OPTIONS", "")
    print(f"Profile options: {profile_opts if profile_opts else '(none)'}")
    print()

    # Quick sanity check: can we see any devices at all?
    try:
        devs = hub.get_devices()
        print(f"[QAI] get_devices() OK. Found {len(devs)} devices on your account.")
    except Exception as e:
        print(f"[QAI] WARNING: get_devices() failed: {e}")
        print(
            "[QAI] If the message says 'Failed to authenticate', then:\n"
            "     - Your token may be wrong/expired, or\n"
            "     - You may not be logged in correctly.\n\n"
            "Fix by re-running:\n"
            "  qai-hub configure --api_token YOUR_API_TOKEN_HERE\n"
            "Then run this script again."
        )
        return

    # Submit and wait
    jobs = submit_profile_jobs(model_path=onnx_path, device_names=device_names)
    wait_for_profile_jobs(jobs, timeout_sec=300)

    print("\n=== Done. Open the Profile job URL(s) above in AI Hub to see latency,")
    print("          memory usage, and NPU utilization for your TinyNet model. ===")


if __name__ == "__main__":
    main()
