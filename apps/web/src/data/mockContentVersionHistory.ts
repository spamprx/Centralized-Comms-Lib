import type { ContentVersion } from '../services/contentService';

/** Minimal TipTap JSON so `tipTapJsonToPlainText` can render preview + diffs. */
function linesToDoc(lines: string[]): Record<string, unknown> {
  return {
    type: 'doc',
    content: lines.map((line) => ({
      type: 'paragraph',
      content: line ? [{ type: 'text', text: line }] : [],
    })),
  };
}

const AUTHOR_ALICE = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const AUTHOR_BOB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const AUTHOR_CAROL = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

/**
 * Sample version history used when the API is unavailable or returns an error.
 * `contentId` is echoed onto each row so URLs like `/history/new` still work.
 */
export function getStaticVersionHistory(contentId: string): {
  contentTitle: string;
  primaryAuthorId: string;
  coAuthors: Array<{ id: string; displayName: string; email: string }>;
  versions: ContentVersion[];
} {
  const v1: ContentVersion = {
    id: `${contentId}-ver-1`,
    versionNumber: 1,
    title: 'Getting Started Guide',
    changeType: 'MANUAL_SAVE',
    body: linesToDoc([
      `# Getting Started Guide`,
      `## Introduction`,
      `Welcome to our platform. This is the initial version of the guide.`,
      `## Basic Features`,
      `- Feature A: Description here`,
      `- Feature B: Description here`,
    ]),
    metadataSnapshot: null,
    contentId,
    authorId: AUTHOR_ALICE,
    createdAt: '2025-03-01T10:00:00.000Z',
  };

  const v2: ContentVersion = {
    id: `${contentId}-ver-2`,
    versionNumber: 2,
    title: 'Getting Started Guide',
    changeType: 'MANUAL_SAVE',
    body: linesToDoc(
      [
        `# Getting Started Guide`,
        `## Introduction`,
        `Welcome to our platform. This is the initial version of the guide.`,
        `## Basic Features`,
        `- Feature A: Description here`,
        `- Feature B: Description here`,
        `## Screenshots`,
        `[Screenshot 1: Dashboard view]`,
        `[Screenshot 2: Settings panel]`,
      ]
        .join('\n')
        .split('\n'),
    ),
    metadataSnapshot: null,
    contentId,
    authorId: AUTHOR_BOB,
    createdAt: '2025-03-03T14:30:00.000Z',
  };

  const v3: ContentVersion = {
    id: `${contentId}-ver-3`,
    versionNumber: 3,
    title: 'Getting Started Guide',
    changeType: 'MANUAL_SAVE',
    body: linesToDoc(
      [
        `# Getting Started Guide`,
        `## Introduction`,
        `Welcome to our platform! This comprehensive guide will help you get started.`,
        `## Basic Features`,
        `- Feature A: Enhanced description with more details`,
        `- Feature B: Updated with new capabilities`,
        `- Feature C: New feature added`,
        `## Screenshots`,
        `[Screenshot 1: Dashboard view]`,
        `[Screenshot 2: Settings panel]`,
      ]
        .join('\n')
        .split('\n'),
    ),
    metadataSnapshot: null,
    contentId,
    authorId: AUTHOR_ALICE,
    createdAt: '2025-03-05T09:15:00.000Z',
  };

  const v4: ContentVersion = {
    id: `${contentId}-ver-4`,
    versionNumber: 4,
    title: 'Getting Started Guide v2.0',
    changeType: 'MANUAL_SAVE',
    body: linesToDoc(
      [
        `# Getting Started Guide v2.0`,
        `## Introduction`,
        `Welcome to our platform! This comprehensive guide will help you get started quickly.`,
        `## Basic Features`,
        `- Feature A: Enhanced description with more details`,
        `- Feature B: Updated with new capabilities`,
        `- Feature C: New feature added`,
        `## Advanced Features`,
        `- Feature X: Power user capabilities`,
        `- Feature Y: Automation tools`,
        `- Feature Z: Integration options`,
        `## Screenshots`,
        `[Screenshot 1: Dashboard view]`,
        `[Screenshot 2: Settings panel]`,
        `[Screenshot 3: Advanced settings]`,
        `## Troubleshooting`,
        `Common issues and solutions...`,
      ]
        .join('\n')
        .split('\n'),
    ),
    metadataSnapshot: null,
    contentId,
    authorId: AUTHOR_CAROL,
    createdAt: '2025-03-08T16:45:00.000Z',
  };

  return {
    contentTitle: 'Getting Started Guide (sample)',
    primaryAuthorId: AUTHOR_ALICE,
    coAuthors: [
      { id: AUTHOR_BOB, displayName: 'Bob Smith', email: 'bob@example.com' },
      { id: AUTHOR_CAROL, displayName: 'Carol Williams', email: 'carol@example.com' },
    ],
    versions: [v4, v3, v2, v1],
  };
}
