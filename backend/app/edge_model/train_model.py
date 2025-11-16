import numpy as np
import torch
from torch.utils.data import TensorDataset, DataLoader
from model_def import BidMultiplierModel

def generate_synthetic_data(n=5000):
    # social_score: 0-100, risk_score: 0-100, money: 0-300000, coop: 0/1
    socials = np.random.uniform(0, 100, size=n)
    risks = np.random.uniform(0, 100, size=n)
    money = np.random.exponential(scale=20000.0, size=n)  # heavy tail
    coop = np.random.binomial(1, 0.7, size=n)

    # normalize money to 0..1
    money_scaled = np.clip(money / 100000.0, 0.0, 1.0)

    X = np.stack([socials, risks, money_scaled, coop], axis=1).astype(np.float32)

    # target multiplier: base 0.5..1.5 influenced by social and money; risk penalizes
    y = 0.5 + (socials / 200.0) + (money_scaled * 0.5) - (risks / 400.0)
    # clamp 0.3..1.7
    y = np.clip(y, 0.3, 1.7).astype(np.float32)
    # scale into 0..1 for sigmoid target: map 0.3..1.7 -> 0..1
    y_norm = (y - 0.3) / (1.7 - 0.3)
    y_norm = y_norm.reshape(-1, 1).astype(np.float32)

    return X, y_norm

def train(save_path="bid_model.pt", epochs=6, batch_size=128, lr=1e-3):
    X, y = generate_synthetic_data(5000)
    ds = TensorDataset(torch.from_numpy(X), torch.from_numpy(y))
    dl = DataLoader(ds, batch_size=batch_size, shuffle=True)

    model = BidMultiplierModel(input_dim=4)
    opt = torch.optim.Adam(model.parameters(), lr=lr)
    loss_fn = torch.nn.MSELoss()

    model.train()
    for e in range(epochs):
        total_loss = 0.0
        for xb, yb in dl:
            opt.zero_grad()
            out = model(xb)
            loss = loss_fn(out, yb)
            loss.backward()
            opt.step()
            total_loss += loss.item() * xb.size(0)
        print(f"Epoch {e+1}/{epochs} loss: {total_loss / len(ds):.6f}")

    # save state dict
    torch.save(model.state_dict(), save_path)
    print("Saved model to", save_path)
    return save_path

if __name__ == "__main__":
    train()
