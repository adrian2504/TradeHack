import { AuctionTheme, AgentProfile, NegotiationRound } from "@/types";

export const AUCTIONS: AuctionTheme[] = [
  {
    id: "1",
    name: "Rockefeller Tree of Impact",
    slug: "rockefeller-tree",
    description:
      "Auction naming rights on a virtual Rockefeller Center tree, weighted by philanthropy, social impact, and donation size.",
    impactArea: "Global Philanthropy",
    heroTagline: "Not just the biggest check – the biggest impact.",
    donationWeight: 0.4,
    profileWeight: 0.4,
    fairnessWeight: 0.2,
    status: "live",
  },
  {
    id: "2",
    name: "LA Walk of Fame for Good",
    slug: "la-walk-of-fame",
    description:
      "Stars on a virtual Walk of Fame reserved for donors with high community impact and inclusive giving.",
    impactArea: "Community & Arts",
    heroTagline: "Celebrate the people who give back, not just show up.",
    donationWeight: 0.3,
    profileWeight: 0.5,
    fairnessWeight: 0.2,
    status: "upcoming",
  },
  {
    id: "3",
    name: "Climate Champions Arena",
    slug: "climate-champions",
    description:
      "Auction slots on a climate impact leaderboard, balancing funding with long-term environmental commitments.",
    impactArea: "Climate",
    heroTagline: "Where greenwashing loses and real impact wins.",
    donationWeight: 0.35,
    profileWeight: 0.45,
    fairnessWeight: 0.2,
    status: "live",
  },
  {
    id: "4",
    name: "Global Health Hall of Honor",
    slug: "global-health",
    description:
      "Naming rights on a digital wall of honor for global health donors, scored for equity and access.",
    impactArea: "Health",
    heroTagline: "Putting equitable health outcomes at center stage.",
    donationWeight: 0.3,
    profileWeight: 0.5,
    fairnessWeight: 0.2,
    status: "closed",
  },
];

export const MOCK_AGENTS: AgentProfile[] = [
  {
    id: "agent-1",
    name: "Adrian Foundation",
    avatarInitials: "AF",
    affiliation: "Adrian Philanthropy Group",
    donationAmount: 50_000_000,
    philanthropyScore: 95,
    socialImpactScore: 92,
    fairnessScore: 90,
    compositeScore: 0,
    strategy: "altruistic",
  },
  {
    id: "agent-2",
    name: "BigCheck Capital",
    avatarInitials: "BC",
    affiliation: "BigCheck Giving Fund",
    donationAmount: 100_000_000,
    philanthropyScore: 60,
    socialImpactScore: 55,
    fairnessScore: 50,
    compositeScore: 0,
    strategy: "greedy",
  },
  {
    id: "agent-3",
    name: "Quiet Impact Fund",
    avatarInitials: "QI",
    affiliation: "Quiet Impact Collective",
    donationAmount: 65_000_000,
    philanthropyScore: 88,
    socialImpactScore: 90,
    fairnessScore: 93,
    compositeScore: 0,
    strategy: "balanced",
  },
];

export function computeCompositeScore(
  agent: AgentProfile,
  auction: AuctionTheme
): number {
  const profileScore = (agent.philanthropyScore + agent.socialImpactScore) / 2;

  const donationComponent =
    (auction.donationWeight * normalizeDonation(agent.donationAmount)) || 0;
  const profileComponent =
    (auction.profileWeight * profileScore) / 100 || 0;
  const fairnessComponent =
    (auction.fairnessWeight * agent.fairnessScore) / 100 || 0;

  return Math.round(
    (donationComponent + profileComponent + fairnessComponent) * 100
  ) / 100;
}

// For hackathon demo, you can replace this with a Snowflake-driven normalization.
function normalizeDonation(amount: number): number {
  const maxDemoDonation = 100_000_000;
  return Math.min(1, amount / maxDemoDonation);
}

export const MOCK_ROUNDS: NegotiationRound[] = [
  {
    round: 1,
    agentId: "agent-1",
    donationAmount: 45_000_000,
    compositeScore: 0,
    explanation:
      "Started with a strong but sustainable pledge, maintaining flexibility for matching funds.",
    timestamp: new Date().toISOString(),
  },
  {
    round: 1,
    agentId: "agent-2",
    donationAmount: 100_000_000,
    compositeScore: 0,
    explanation:
      "Anchored high to dominate the field, ignoring profile and fairness trade-offs.",
    timestamp: new Date().toISOString(),
  },
  {
    round: 1,
    agentId: "agent-3",
    donationAmount: 60_000_000,
    compositeScore: 0,
    explanation:
      "Balanced pledge, reserving capital for long-term programs instead of a single splashy donation.",
    timestamp: new Date().toISOString(),
  },
];
