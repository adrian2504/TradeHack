"""
edge_build_and_profile_model.py

End-to-end:
1) Define a tiny PyTorch model.
2) Export it to ONNX as my_model.onnx.
3) Submit compile + profile jobs to Qualcomm AI Hub.
4) Wait for results and print URLs.

Requirements:
- torch
- onnx
- qai-hub
- You must have run:  `qai-hub configure --api_token YOUR_TOKEN`
"""

from __future__ import annotations

import os
from typing import List, Tuple

import torch
import torch.nn as nn
import qai_hub as hub

from dotenv import load_dotenv
load_dotenv()


# -------------------- 1. Build & export a dummy ONNX model -------------------- #

class TinyNet(nn.Module):
    """
    Very small MLP: input_dim -> hidden_dim -> 1
    This is just a placeholder model we can push to QAI Hub.
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
    Create TinyNet, export to ONNX, and return the path.
    """
    torch.manual_seed(42)

    model = TinyNet(input_dim=input_dim)
    model.eval()

    # Dummy input: batch_size=1, input_dim features
    dummy_input = torch.randn(1, input_dim)

    # Export to ONNX
    torch.onnx.export(
        model,
        dummy_input,
        onnx_path,
        input_names=["input"],
        output_names=["output"],
        opset_version=17,
        dynamic_axes={"input": {0: "batch"}, "output": {0: "batch"}},
    )

    print(f"[BUILD] Exported TinyNet to ONNX: {onnx_path}")
    return onnx_path


# -------------------- 2. Qualcomm AI Hub helpers -------------------- #

def get_devices() -> List[hub.Device]:
    """
    Build a device list from the env var QAI_DEVICE_LIST.

    Example (PowerShell):
      $env:QAI_DEVICE_LIST="Samsung Galaxy S24 (Family);Samsung Galaxy S23 (Family)"

    If not set, defaults to a single Samsung Galaxy S24 (Family).
    """
    raw = os.environ.get("QAI_DEVICE_LIST", "Samsung Galaxy S24 (Family)")
    names = [name.strip() for name in raw.split(";") if name.strip()]

    if not names:
        raise ValueError("No device names provided in QAI_DEVICE_LIST.")

    devices = [hub.Device(name=n) for n in names]
    return devices


def get_compile_options() -> str:
    """
    Compile options for AI Hub.

    For this simple ONNX, `--target_runtime onnx` is fine.
    Override via:
      QAI_COMPILE_OPTIONS="--target_runtime onnx"
    """
    return os.environ.get("QAI_COMPILE_OPTIONS", "--target_runtime onnx")


def get_profile_options() -> str:
    """
    Profile options (optional).

    Override via:
      QAI_PROFILE_OPTIONS="--profiling_iterations 10"
    """
    return os.environ.get("QAI_PROFILE_OPTIONS", "")


def submit_compile_and_profile(
    model_path: str,
    devices: List[hub.Device],
    compile_options: str,
    profile_options: str,
) -> List[Tuple[hub.CompileJob, hub.ProfileJob]]:
    """
    Submit compile + profile jobs to Qualcomm AI Hub for the given devices.

    Uses submit_compile_and_profile_jobs so we:
      - compile once (single_compile=True)
      - profile on each device.
    """
    jobs = hub.submit_compile_and_profile_jobs(
        model=model_path,
        device=devices,
        input_specs=None,           # optional for simple models
        compile_options=compile_options,
        profile_options=profile_options,
        single_compile=True,        # single compile job reused for all devices
    )
    # jobs is a list of (CompileJob, ProfileJob)
    return jobs


# -------------------- 3. End-to-end main -------------------- #

def main() -> None:
    # Make QAI Hub verbose so you see what's going on
    hub.set_verbose(True)

    # 1) Build and export ONNX model
    onnx_path = build_and_export_onnx("my_model.onnx", input_dim=3)

    # 2) Prepare QAI Hub settings
    devices = get_devices()
    compile_options = get_compile_options()
    profile_options = get_profile_options()

    print("\n=== Qualcomm AI Hub Edge Demo ===")
    print(f"Local model: {onnx_path}")
    print("Target devices:")
    for d in devices:
        print(f"  - {d.name}")
    print(f"Compile options: {compile_options}")
    print(f"Profile options: {profile_options if profile_options else '(none)'}")
    print()

    # 3) Submit compile + profile jobs
    print("Submitting compile + profile jobs to Qualcomm AI Hub...")
    job_pairs = submit_compile_and_profile(
        model_path=onnx_path,
        devices=devices,
        compile_options=compile_options,
        profile_options=profile_options,
    )
    print(f"Submitted {len(job_pairs)} job pair(s).\n")

    # 4) Wait for jobs to finish and print URLs
    for (compile_job, profile_job) in job_pairs:
        print("Waiting for compile job to finish...")
        compile_status = compile_job.wait()
        print(f"  Compile status: {compile_status}")
        try:
            print(f"  Compile URL:   {compile_job.url}")
        except AttributeError:
            pass
        print()

        target_model = compile_job.get_target_model()
        if target_model is None:
            print("  [ERROR] Compile job failed; no target model produced.")
            print()
            continue

        print("Waiting for profile job to finish...")
        profile_status = profile_job.wait()
        print(f"  Profile status: {profile_status}")
        try:
            print(f"  Profile URL:    {profile_job.url}")
        except AttributeError:
            pass
        print()

    print("=== Done. Open the above URLs in AI Hub to see latency, memory, and NPU stats. ===")


if __name__ == "__main__":
    main()
