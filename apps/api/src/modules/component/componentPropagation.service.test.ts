import { propagateLinkedComponentToContent } from "./componentPropagation.service";

const mockGetVersionById = jest.fn();
const mockListLatestMaybeRef = jest.fn();
const mockSavePropagatedBody = jest.fn();
const mockCollectLinkedIds = jest.fn();
const mockRefreshLinkedDoc = jest.fn();

jest.mock("../../repository", () => ({
  getPrismaClient: jest.fn(() => ({})),
  PrismaUnitOfWork: jest.fn(() => ({
    repos: () => ({
      componentRegistry: {
        getVersionById: mockGetVersionById,
      },
      content: {
        listLatestContentVersionsMaybeReferencingComponentVersion:
          mockListLatestMaybeRef,
      },
    }),
  })),
}));

jest.mock("../content/content.service", () => ({
  contentService: {
    savePropagatedBody: (...args: unknown[]) => mockSavePropagatedBody(...args),
  },
}));

jest.mock("./libraryComponent", () => ({
  isTipTapDoc: (v: unknown) =>
    !!v && typeof v === "object" && (v as { type?: string }).type === "doc",
  collectLinkedComponentVersionIds: (...args: unknown[]) =>
    mockCollectLinkedIds(...args),
  refreshLinkedNodesInDocument: (...args: unknown[]) => mockRefreshLinkedDoc(...args),
}));

describe("propagateLinkedComponentToContent", () => {
  const ctx = {
    actorId: "u-1",
    isAdmin: true,
    ipAddress: "127.0.0.1",
    userAgent: "jest",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns notFound when component version is missing", async () => {
    mockGetVersionById.mockResolvedValue(null);

    const out = await propagateLinkedComponentToContent(ctx, "ver-x");

    expect(out).toEqual({ notFound: true });
    expect(mockListLatestMaybeRef).not.toHaveBeenCalled();
  });

  it("propagates changed linked content and reports updated ids", async () => {
    const linkedBody = { type: "doc", content: [{ type: "paragraph" }] };
    const refreshedBody = {
      type: "doc",
      content: [{ type: "paragraph" }, { type: "paragraph" }],
    };
    mockGetVersionById.mockResolvedValue({
      id: "ver-1",
      componentId: "comp-1",
      bodyJson: linkedBody,
    });
    mockListLatestMaybeRef.mockResolvedValue([
      { contentId: "c-1", body: linkedBody },
      { contentId: "c-2", body: linkedBody },
    ]);
    mockCollectLinkedIds.mockImplementation((body: unknown) =>
      body ? ["ver-1"] : [],
    );
    mockRefreshLinkedDoc.mockReturnValue(refreshedBody);
    mockSavePropagatedBody.mockResolvedValue({ version: { id: "v-new" } });

    const out = await propagateLinkedComponentToContent(ctx, "ver-1");

    expect("notFound" in out).toBe(false);
    if ("notFound" in out) return;
    expect(out.componentVersionId).toBe("ver-1");
    expect(out.updatedContentIds).toEqual(["c-1", "c-2"]);
    expect(out.skippedUnchanged).toBe(0);
    expect(out.skippedFormatting).toEqual([]);
    expect(mockSavePropagatedBody).toHaveBeenCalledTimes(2);
  });

  it("skips unchanged documents without writing new versions", async () => {
    const body = { type: "doc", content: [{ type: "paragraph" }] };
    mockGetVersionById.mockResolvedValue({
      id: "ver-1",
      componentId: "comp-1",
      bodyJson: body,
    });
    mockListLatestMaybeRef.mockResolvedValue([{ contentId: "c-1", body }]);
    mockCollectLinkedIds.mockReturnValue(["ver-1"]);
    mockRefreshLinkedDoc.mockReturnValue(body);

    const out = await propagateLinkedComponentToContent(ctx, "ver-1");

    expect("notFound" in out).toBe(false);
    if ("notFound" in out) return;
    expect(out.updatedContentIds).toEqual([]);
    expect(out.skippedUnchanged).toBe(1);
    expect(mockSavePropagatedBody).not.toHaveBeenCalled();
  });
});

