import os
import onnx
from onnx import helper, TensorProto
import numpy as np


def build_model():
    # Simple linear model: y = xW + b
    # Input:  [1, 4]  -> four features (e.g., bid, social score, etc.)
    # Output: [1, 1]  -> single scalar score
    input_dim = 4
    output_dim = 1

    W = np.random.randn(input_dim, output_dim).astype(np.float32)
    b = np.random.randn(output_dim).astype(np.float32)

    # Initializers
    W_init = helper.make_tensor(
        "W", TensorProto.FLOAT, [input_dim, output_dim], W.flatten()
    )
    b_init = helper.make_tensor(
        "b", TensorProto.FLOAT, [output_dim], b
    )

    # IO specs
    input_tensor = helper.make_tensor_value_info(
        "input", TensorProto.FLOAT, [1, input_dim]
    )
    output_tensor = helper.make_tensor_value_info(
        "output", TensorProto.FLOAT, [1, output_dim]
    )

    # Graph: MatMul -> Add
    matmul_node = helper.make_node("MatMul", ["input", "W"], ["mm"])
    add_node = helper.make_node("Add", ["mm", "b"], ["output"])

    graph = helper.make_graph(
        [matmul_node, add_node],
        "BidMultiplierLinear",
        [input_tensor],
        [output_tensor],
        [W_init, b_init],
    )

    # Build model and force an older IR/opset that AI Hub supports
    model = helper.make_model(graph, producer_name="hacknyu-bid-model")

    # Qualcomm AI Hub complained about ir_version 12 > 11, so clamp it:
    model.ir_version = 11

    # Also keep opset to something conservative (11 is safe for MatMul/Add)
    for opset in model.opset_import:
        if opset.domain in ("", None):
            opset.version = 11

    # Sanity-check locally (as their error message suggested)
    onnx.checker.check_model(model, full_check=True)

    # Save next to this file: app/infra/my_model.onnx
    this_dir = os.path.dirname(__file__)
    out_path = os.path.join(this_dir, "my_model.onnx")
    onnx.save(model, out_path)
    print(f"✅ Saved ONNX model to {out_path}")


if __name__ == "__main__":
    build_model()
