"""
edge_qai_job.py

End-to-end Qualcomm AI Hub integration:

- Takes a local model file (ONNX / TFLite / etc.).
- Submits compile + profile jobs to Qualcomm AI Hub.
- Lets you pick one or more devices via an environment variable.
- Waits for jobs to finish and prints URLs + statuses.

This does NOT touch your auction logic. It’s a clean, standalone Edge AI step
you can call after your multi-round auction.
"""

from __future__ import annotations

import os
from typing import List, Tuple

import qai_hub as hub  # pip install qai-hub


# -------------------- Config helpers -------------------- #

def get_model_path() -> str:
    """
    Path to the local model to send to Qualcomm AI Hub.

    Defaults to 'my_model.onnx' but you can override via:
      QAI_EDGE_MODEL_PATH=C:\\path\\to\\your_model.onnx
    """
    model_path = os.environ.get("QAI_EDGE_MODEL_PATH", "my_model.onnx")

    if not os.path.exists(model_path):
        raise FileNotFoundError(
            f"Edge model file not found at '{model_path}'. "
            "Set QAI_EDGE_MODEL_PATH to a valid ONNX/TFLite path."
        )
    return model_path


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

    For ONNX models you can often use:
      --target_runtime onnx   (for compute)
    or for mobile:
      --target_runtime tflite
      --target_runtime qnn_lib_aarch64_android

    You can override via env:
      QAI_COMPILE_OPTIONS="--target_runtime onnx"
    """
    return os.environ.get("QAI_COMPILE_OPTIONS", "--target_runtime onnx")


def get_profile_options() -> str:
    """
    Profile options (usually you can leave empty).

    Override via:
      QAI_PROFILE_OPTIONS="--profiling_iterations 10"
    """
    return os.environ.get("QAI_PROFILE_OPTIONS", "")


# -------------------- Core QAI Hub logic -------------------- #

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
        input_specs=None,           # ONNX: optional, you can set if needed
        compile_options=compile_options,
        profile_options=profile_options,
        single_compile=True,        # one compile job compatible with all devices
    )
    # This returns a list of (CompileJob, ProfileJob) tuples.
    return jobs


def main() -> None:
    # Make QAI Hub a bit more talkative (optional)
    hub.set_verbose(True)

    # 1) Resolve config
    model_path = get_model_path()
    devices = get_devices()
    compile_options = get_compile_options()
    profile_options = get_profile_options()

    print("=== Qualcomm AI Hub Edge Demo ===")
    print(f"Local model: {model_path}")
    print("Target devices:")
    for d in devices:
        print(f"  - {d.name}")
    print(f"Compile options: {compile_options}")
    print(f"Profile options: {profile_options if profile_options else '(none)'}")
    print()

    # 2) Submit compile + profile jobs
    print("Submitting compile + profile jobs to Qualcomm AI Hub...")
    job_pairs = submit_compile_and_profile(
        model_path=model_path,
        devices=devices,
        compile_options=compile_options,
        profile_options=profile_options,
    )

    # job_pairs: List[(CompileJob, ProfileJob)]
    print(f"Submitted {len(job_pairs)} job pair(s).")
    print()

    # 3) Wait for jobs & print URLs
    for (compile_job, profile_job) in job_pairs:
        # Wait for compile to finish
        print("Waiting for compile job to finish...")
        compile_status = compile_job.wait()
        print(f"  Compile status: {compile_status}")
        print(f"  Compile URL:   {compile_job.url}")
        print()

        # Get target model for profiling (this will also block until ready if needed)
        target_model = compile_job.get_target_model()
        if target_model is None:
            print("  [ERROR] Compile job failed; no target model produced.")
            continue

        # Wait for profile job to finish
        print("Waiting for profile job to finish...")
        profile_status = profile_job.wait()
        print(f"  Profile status: {profile_status}")
        print(f"  Profile URL:    {profile_job.url}")
        print()

    print("=== Done. Check the above URLs in AI Hub for latency, memory, and NPU stats. ===")


if __name__ == "__main__":
    main()
