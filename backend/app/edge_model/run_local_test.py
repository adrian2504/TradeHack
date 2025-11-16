import torch
import numpy as np
import onnx
import onnxruntime as ort
from model_def import BidMultiplierModel

def run_onnx_test(traced_pt="bid_model_traced.pt"):
    # Convert to ONNX (simple way via torch.onnx)
    model = torch.jit.load(traced_pt)
    model.eval()
    dummy = torch.randn(1,4)
    onnx_path = "bid_model.onnx"
    torch.onnx.export(model, dummy, onnx_path, opset_version=18, input_names=["input"], output_names=["output"], dynamic_axes={"input":[0,1], "output":[0,1]})
    print("Exported ONNX:", onnx_path)

    sess = ort.InferenceSession(onnx_path)
    x = np.array([[50.0, 10.0, 0.2, 1.0]], dtype=np.float32)  # example
    out = sess.run(None, {"input": x})
    # output is normalized 0..1 (sigmoid), map back to multiplier range 0.3..1.7
    score_norm = out[0][0][0]
    multiplier = 0.3 + score_norm * (1.7 - 0.3)
    print("Pred multiplier:", multiplier)

if __name__ == "__main__":
    run_onnx_test()
