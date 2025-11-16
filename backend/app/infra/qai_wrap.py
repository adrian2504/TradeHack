import os
import time
import numpy as np
import qai_hub as hub

# Ensure hub.configure called already (you configured via CLI earlier)
# hub.configure(api_token="...")  # optional if you want to set here

def compile_and_get_target_model(traced_model_path: str, device_name: str, input_shape=(1,4)):
    # load torchscript model
    import torch
    traced = torch.jit.load(traced_model_path)

    print("Submitting compile job to Qualcomm AI Hub...")
    compile_job = hub.submit_compile_job(
        model=traced,
        device=hub.Device(device_name),
        input_specs={"input": input_shape},
        options="--target_runtime onnx"
    )
    print("Waiting for compile job to complete...")
    target_model = compile_job.get_target_model()
    print("Compile done, target model ready:", target_model.model_id)

    return target_model

def profile_model_on_device(target_model, device_name: str):
    print("Submitting profile job...")
    pj = hub.submit_profile_job(
        model=target_model,
        device=hub.Device(device_name),
    )
    # block until profile done (the SDK job object provides state)
    print("Waiting for profile job result...")
    result = pj.get_result()
    print("Profile job complete")
    return result

def run_inference_on_device(target_model, device_name: str, input_array: np.ndarray):
    """
    input_array: np.ndarray with shape (batch, 4) dtype float32
    """
    print("Submitting inference job to device...")
    inference_job = hub.submit_inference_job(
        model=target_model,
        device=hub.Device(device_name),
        inputs={"input": [input_array]},
    )
    print("Waiting for inference to complete...")
    out = inference_job.download_output_data()
    # out is a dict of arrays keyed by output name
    return out

# utility to map ONNX output to multiplier range
def normalized_to_multiplier(norm_val: float) -> float:
    return 0.3 + float(norm_val) * (1.7 - 0.3)
