# small feed-forward PyTorch model used to predict a bid multiplier
import torch
import torch.nn as nn

class BidMultiplierModel(nn.Module):
    def __init__(self, input_dim: int = 4):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, 64),
            nn.ReLU(),
            nn.Linear(64, 32),
            nn.ReLU(),
            nn.Linear(32, 1),
            nn.Sigmoid()  # outputs in (0,1); we will scale to desired range
        )

    def forward(self, x):
        # x: (batch, input_dim)
        return self.net(x)
