import { type Content } from "../../repository";
import { __private__ } from "./content.service";

function buildContent(
  overrides: Partial<Content> = {},
): Content {
  return {
    id: "c_1",
    title: "Title",
    slug: "title",
    lifecycleState: "PUBLISHED",
    visibility: "PUBLIC",
    contentType: "ARTICLE",
    aiGenerated: false,
    authorId: "author_1",
    visibilityGroupId: null,
    templateId: null,
    channelId: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("content visibility guards", () => {
  it("allows PRIVATE_TO_GROUP content only for matching group members", () => {
    const content = buildContent({
      visibility: "PRIVATE_TO_GROUP",
      visibilityGroupId: "group_a",
    });

    expect(
      __private__.canViewContent(
        content,
        { id: "reader_1" },
        [{ id: "group_a" }],
        false,
      ),
    ).toBe(true);

    expect(
      __private__.canViewContent(
        content,
        { id: "reader_1" },
        [{ id: "group_b" }],
        false,
      ),
    ).toBe(false);
  });

  it("blocks audience reads for non-published content", () => {
    const content = buildContent({
      lifecycleState: "DRAFT",
    });

    expect(
      __private__.isPublishedAudienceReadAllowed({
        requester: { id: "reader_1", isAdmin: false },
        content,
        isCoAuthor: false,
        isReviewer: false,
      }),
    ).toBe(false);
  });

  it("denies broad audience read for published channel-bound content", () => {
    const content = buildContent({
      channelId: "ch_1",
      lifecycleState: "PUBLISHED",
      visibility: "PUBLIC",
    });

    expect(
      __private__.isPublishedAudienceReadAllowed({
        requester: { id: "reader_1", isAdmin: false },
        content,
        isCoAuthor: false,
        isReviewer: false,
      }),
    ).toBe(false);
  });

  it("allows privileged readers to access non-published content", () => {
    const content = buildContent({
      lifecycleState: "IN_REVIEW",
      authorId: "author_1",
    });

    expect(
      __private__.isPublishedAudienceReadAllowed({
        requester: { id: "author_1", isAdmin: false },
        content,
        isCoAuthor: false,
        isReviewer: false,
      }),
    ).toBe(true);

    expect(
      __private__.isPublishedAudienceReadAllowed({
        requester: { id: "reviewer_1", isAdmin: false },
        content,
        isCoAuthor: false,
        isReviewer: true,
      }),
    ).toBe(true);
  });
});
