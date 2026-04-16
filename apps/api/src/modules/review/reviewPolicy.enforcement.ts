import type { ReviewPolicy } from "../../repository/types";

export function requiredQuorumFromPolicies(input: {
  policies: ReviewPolicy[];
  channelId: string | null;
  userGroupIds: string[];
}): number | null {
  let bestSpecificity = -1;
  let bestQuorum = 0;

  for (const p of input.policies) {
    if (!p.isActive) continue;
    if (p.channelId != null && p.channelId !== input.channelId) continue;
    if (p.userGroupId != null && !input.userGroupIds.includes(p.userGroupId))
      continue;

    const specificity = (p.channelId ? 1 : 0) + (p.userGroupId ? 1 : 0);
    if (specificity > bestSpecificity) {
      bestSpecificity = specificity;
      bestQuorum = p.quorumRequired;
    } else if (specificity === bestSpecificity) {
      bestQuorum = Math.max(bestQuorum, p.quorumRequired);
    }
  }

  if (bestSpecificity < 0) return null;
  return Math.max(1, bestQuorum);
}
