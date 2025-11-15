export type AuctionTheme = {
  id: string;
  name: string;
  slug: string;
  description: string;
  impactArea: string;
  heroTagline: string;
  donationWeight: number;
  profileWeight: number;
  fairnessWeight: number;
  status: "upcoming" | "live" | "closed";
};

export type AgentProfile = {
  id: string;
  name: string;
  avatarInitials: string;
  affiliation: string;
  donationAmount: number;
  philanthropyScore: number;
  socialImpactScore: number;
  fairnessScore: number;
  compositeScore: number;
  strategy: "greedy" | "balanced" | "altruistic";
};

export type NegotiationRound = {
  round: number;
  agentId: string;
  donationAmount: number;
  compositeScore: number;
  explanation: string;
  timestamp: string;
};
