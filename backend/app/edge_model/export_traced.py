import torch
from model_def import BidMultiplierModel

def export_traced(model_weights="bid_model.pt", traced_path="bid_model_traced.pt"):
    model = BidMultiplierModel(input_dim=4)
    model.load_state_dict(torch.load(model_weights, map_location="cpu"))
    model.eval()
    example_input = torch.randn(1, 4)
    traced = torch.jit.trace(model, example_input)
    torch.jit.save(traced, traced_path)
    print("Saved traced model:", traced_path)
    return traced_path

if __name__ == "__main__":
    export_traced()
