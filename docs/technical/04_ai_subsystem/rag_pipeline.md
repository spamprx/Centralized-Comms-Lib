# AI Subsystem — RAG Pipeline

## What is RAG?

Retrieval-Augmented Generation (RAG) is an AI technique that answers questions using passages retrieved from a specific knowledge base, rather than relying solely on the AI model's training data. In Comms-Library:

- **Knowledge base:** All published content in the library
- **Retrieval:** Elasticsearch dense vector search (384-dim cosine similarity)
- **Generation:** External AI language model (Sync AI fast path)
- **Grounding guarantee:** Every answer includes citations to the source documents; the model is explicitly instructed not to add information outside the retrieved passages

RAG is used by two features:
- **F-AUD-008 AI — RAG:** Library-wide Q&A assistant
- **F-AUD-011 AI — AI Tutor:** Conversational tutor for a specific content item

---

## Pipeline Steps

### Step 1: Query Validation

```
POST /api/v1/content/:id/tutor   (item-scoped)
POST /api/v1/content/rag-query   (library-wide)
```

The Gateway validates the request (sanitise → authenticate → AI quota check). The service layer validates the query string (not empty, within length limits, no injection patterns).

### Step 2: Query Embedding

```typescript
const queryVector = await embedText(question);  // 384-dim float[]
```

The user's question is converted into a 384-dimensional vector by the same embedding model used to index content. This semantic representation captures the meaning of the question rather than just keywords.

**Failure handling:** If the embedding service is unavailable (circuit open), the system falls back to keyword-only search (no vector component). The answer quality degrades gracefully but the feature remains available.

### Step 3: Retrieval

Two parallel retrieval strategies are combined:

#### Vector retrieval (semantic)

```json
{
  "knn": {
    "field": "titleEmbedding",
    "query_vector": [0.12, -0.34, ...],
    "k": 10,
    "num_candidates": 100
  },
  "filter": [
    { "term": { "status": "PUBLISHED" } },
    // For item-scoped tutor:
    { "term": { "id": "specific-content-id" } }
  ]
}
```

Returns up to 10 semantically similar documents ranked by cosine similarity.

#### Keyword retrieval (BM25)

```json
{
  "query": {
    "multi_match": {
      "query": "user question text",
      "fields": ["title^3", "summary^2", "bodyPlain"]
    }
  }
}
```

Returns up to 10 keyword-matched passages.

#### Passage extraction

For each retrieved document, the most relevant paragraph is extracted from `bodyPlain` using a sliding window to find the 200–400 word window with the highest term overlap with the query.

### Step 4: Context Construction

Retrieved passages are assembled into a structured prompt:

```
SYSTEM: You are a precise assistant that answers questions exclusively from
the provided library content. Do not include any information not present in
the sources. Cite every fact with the source document title and passage number.

SOURCES:
[1] Title: "Examination Policy 2026" | Section: "Academic Integrity"
    Passage: "All students are required to..."

[2] Title: "Assessment Guidelines" | Section: "Late Submission"
    Passage: "Assignments submitted after the deadline..."

QUESTION: What happens if I submit an assignment late?
```

**Context window management:** If too many passages are retrieved, the lowest-scoring ones are dropped to stay within the model's context window limit. The minimum retained passages is 3; the maximum is configurable (default: 8).

### Step 5: Generation

```typescript
const result = await runSyncAiTask({
  taskType: 'RAG_ANSWER',
  payload: { systemPrompt, sources, question }
});
```

The AI generates an answer grounded in the provided sources. The response format is structured:

```json
{
  "answer": "string (the generated response)",
  "citations": [
    {
      "sourceIndex": 1,
      "contentId": "uuid",
      "sectionTitle": "Academic Integrity",
      "passage": "All students are required to..."
    }
  ]
}
```

### Step 6: Citation Verification

Before returning to the client, each citation is verified:

```typescript
for (const citation of result.citations) {
  const exists = await contentRepository.verifyPassageExists(
    citation.contentId,
    citation.passage
  );
  if (!exists) {
    citation.verified = false;  // flagged but not removed
  }
}
```

Unverified citations are flagged in the response. The frontend displays them with a warning indicator ("citation could not be verified").

### Step 7: Response + Caching

The final answer is returned to the client with inline citations. For subsequent identical questions within the same cache epoch, the result is served from Redis.

---

## Multi-Turn AI Tutor

The AI Tutor maintains conversation history across turns.

### Session management

1. First turn: a `sessionId` is generated; conversation history is stored in Redis:
   - Key: `session:conv:{sessionId}`
   - Value: `[{ role: "user", content: "..." }, { role: "assistant", content: "...", citations: [...] }]`
   - TTL: 24 hours (sliding)

2. Each subsequent turn: the session history is prepended to the prompt as additional context
3. On context overflow (too many turns): oldest turns are dropped to maintain the context window budget

### Session persistence

When a user returns to a saved session, the history is retrieved from Redis. If Redis has expired the key (> 24 hours), a fresh session is started.

---

## Library-Wide vs. Item-Scoped Retrieval

| Mode | Retrieval scope | Use case |
|------|----------------|---------|
| **RAG Q&A (library-wide)** | All published content the user can access | "Find information across the whole library" |
| **AI Tutor (item-scoped)** | Only passages from a specific content item | "Help me understand this document" |

For the AI Tutor, the Elasticsearch filter includes `{ "ids": { "values": [contentId] } }` to restrict retrieval to the single item. This produces more focused answers and prevents the tutor from introducing information from other documents.

---

## Hallucination Prevention

Three mechanisms prevent hallucinated answers:

1. **System prompt constraint:** Explicit instruction to the model to answer only from provided sources
2. **Citation verification:** Post-generation check that cited passages actually exist in the repository
3. **Source attribution in UI:** Every answer displays the source titles and passages; users can click through to verify

Despite these measures, hallucination cannot be completely eliminated by prompt engineering alone. Users are advised to verify critical information against the source documents.
