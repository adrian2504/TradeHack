import os
import numpy as np
import qai_hub as hub

# -----------------------------------------------------------
# CONFIG
# -----------------------------------------------------------
THIS_DIR = os.path.dirname(__file__)
MODEL_PATH = os.path.join(THIS_DIR, "my_model.onnx")

# Device family name as shown by Qualcomm AI Hub
TARGET_DEVICE_FAMILY = "Samsung Galaxy S24 (Family)"


# -----------------------------------------------------------
# Select Device
# -----------------------------------------------------------
def find_device():
    print("\n🔍 Selecting device...")

    # This just creates a descriptor that refers to the cloud S24 family.
    device = hub.Device(name=TARGET_DEVICE_FAMILY)

    print(f"   ✔ Using device: {device.name}")
    return device


# -----------------------------------------------------------
# Compile Model
# -----------------------------------------------------------
def compile_model(device):
    print("\n🚀 Submitting COMPILE job...")

    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(f"ONNX model not found at: {MODEL_PATH}")

    # For ONNX, we can pass the path directly.
    compile_job = hub.submit_compile_job(
        model=MODEL_PATH,
        device=device,
        options="--target_runtime onnx",
    )

    print(f"   ✔ Compile job submitted: {compile_job.job_id}")
    print(f"     ↳ View in AI Hub: {compile_job.url}")

    # Block until finished
    print(f"Waiting for compile job ({compile_job.job_id}) to finish...")
    compile_job.wait()

    status = compile_job.get_status()
    print(f"   • Final status: {status.code}")
    if status.code != "SUCCESS":
        raise RuntimeError(
            f"Compile failed on AI Hub: {status.code} - {status.message}"
        )

    # Now it's safe to fetch the target model and download it
    target_model = compile_job.get_target_model()
    if target_model is None:
        raise RuntimeError(
            "Compile failed: get_target_model() returned None. "
            "Check the job in the AI Hub UI."
        )

    # Base path; the SDK may append extensions like .onnx.zip
    out_base = os.path.join(THIS_DIR, "compiled_output.onnx")
    downloaded_path = compile_job.download_target_model(out_base)
    if downloaded_path is None:
        raise RuntimeError(
            "Compile failed: download_target_model() returned None."
        )

    print(f"   ✔ Compile OK → saved compiled model at {downloaded_path}")
    return target_model, downloaded_path


# -----------------------------------------------------------
# Run Inference
# -----------------------------------------------------------
def run_inference(device, target_model):
    print("\n🤖 Running inference on device...")

    # Your ONNX model expects input shape (1, 4)
    # e.g. [feature1, feature2, feature3, feature4]
    dummy_array = np.array([[1.0, 2.0, 3.0, 4.0]], dtype=np.float32)

    # IMPORTANT: values must be *list* of numpy arrays
    inference_job = hub.submit_inference_job(
        model=target_model,
        device=device,
        inputs={"input": [dummy_array]},
    )

    print(f"   ✔ Inference job submitted: {inference_job.job_id}")
    print(f"     ↳ View in AI Hub: {inference_job.url}")

    print(f"Waiting for inference job ({inference_job.job_id}) to finish...")
    inference_job.wait()
    status = inference_job.get_status()
    print(f"   • Final inference status: {status.code}")

    if status.code != "SUCCESS":
        # Surface the actual AI Hub error instead of crashing on None
        raise RuntimeError(
            f"Inference failed on AI Hub: {status.code} - {status.message}"
        )

    outputs = inference_job.download_output_data()
    if outputs is None:
        raise RuntimeError(
            "Inference job reported SUCCESS but no outputs were returned."
        )

    print("   ✔ Inference outputs:")
    for name, value in outputs.items():
        arr = np.array(value)
        print(f"      • {name}: shape={arr.shape}, dtype={arr.dtype}, values={arr}")


# -----------------------------------------------------------
# MAIN
# -----------------------------------------------------------
def main():
    print("🔧 Initializing Qualcomm AI Hub session...")

    device = find_device()
    target_model, _ = compile_model(device)
    run_inference(device, target_model)


if __name__ == "__main__":
    main()
