import GraphQLJSON from 'graphql-type-json';
import { GraphQLError } from 'graphql';
import { assertOperationRateLimit } from '../middleware/operation-rate-limit.js';
import { communityPostInputSchema, conversationMessageSchema, conversationMetadataSchema, conversationSessionSchema, deriveSnippetId, memoryItemSchema, practiceSessionInputSchema, workspaceAssetSchema, workspaceContextSnapshotSchema, workspaceDirectoryItemSchema, workspaceMetadataHistoryEntrySchema, workspaceMetadataUpdateInputSchema } from '@starlink/shared';
import { addKnowledgeFile, addKnowledgeSeed, bindKbToAgent, createKnowledgeBase, deleteKnowledgeBaseDocument, getKnowledgeBaseStatus, importKnowledgeUrl, listAgentBindingsForKb, listKnowledgeBases, listKnowledgeBaseDocuments, publishKnowledgeBase, searchKnowledgeBase, unbindKbFromAgent, updateKnowledgeBaseVisibility } from '../services/kb-task-service.js';
import { pubsub, FLOW_EXECUTION_PROGRESS, publishExecutionEvent } from './subscriptions.js';
import { reflectOnIdeation, processIdeationWizardStep } from '../services/ideation-coach-service.js';
import { buildUserSkillPrompt } from '../services/user-skill-prompt.js';
import { ConversationMemoryStore } from '../application/conversation-memory-store.js';
import { parseHitlDecision } from '../application/hitl-resume.js';
// Lazy module-level singleton: constructed on first use, shares the same
// `pool` (infrastructure/db/pool.ts) all other store consumers use, so no
// extra connections. Used by the user-skill block fetch in the
// reflectOnIdeation / processIdeationWizardStep resolvers below.
const defaultConversationMemoryStore = new ConversationMemoryStore();
export const resolvers = {
    JSON: GraphQLJSON,
    Query: {
        workspaceGraph: async (_, args, ctx) => {
            return await resolveOrThrow(async () => (await ctx.conversationStore.getGraph(args.workspaceId, ctx.userId)));
        },
        conversation: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                const record = await ctx.conversationStore.getConversation(args.id, ctx.userId);
                if (!record)
                    return null;
                return {
                    metadata: {
                        ...record.metadata,
                        createdAt: record.metadata.createdAt.toISOString(),
                        updatedAt: record.metadata.updatedAt.toISOString()
                    },
                    graph: record.graph,
                    knowledgeEvidence: record.knowledgeEvidence ?? [],
                    citations: record.citations ?? []
                };
            });
        },
        conversationSessions: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                const sessions = await ctx.conversationStore.listConversationSessions(args.workspaceId, ctx.userId, args.limit ?? undefined);
                return sessions.map((session) => conversationSessionSchema.parse(session));
            });
        },
        conversationMessages: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                const messages = await ctx.conversationStore.listConversationMessages(args.workspaceId, ctx.userId, args.conversationId, args.limit ?? undefined);
                return messages.map((message) => conversationMessageSchema.parse(message));
            });
        },
        cardsReferencingEvidence: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                const record = await ctx.conversationStore.getConversation(args.conversationId, ctx.userId);
                if (!record)
                    return [];
                const cardIds = new Set();
                for (const citation of record.citations ?? []) {
                    for (const span of citation.spans) {
                        if (span.refs.some((r) => r.evidenceId === args.evidenceId)) {
                            cardIds.add(citation.cardId);
                            break;
                        }
                    }
                }
                return Array.from(cardIds);
            });
        },
        workspaceMemories: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                const memories = await ctx.conversationStore.listWorkspaceMemories(args.workspaceId, ctx.userId, {
                    query: args.query,
                    scope: args.scope,
                    kind: args.kind,
                    limit: args.limit
                });
                return memories.map((memory) => memoryItemSchema.parse(memory));
            });
        },
        /**
         * P2 · myMemories — user-scoped memory list. Always filters by
         * ctx.userId (no override possible). Returns rows where:
         *   - user_id = ctx.userId
         *   - archived_at IS NULL
         *   - workspace_id = $args.workspaceId   (when provided)
         *     OR scope='user' AND workspace_id IS NULL  (cross-workspace
         *     personal user-skill rows, when workspaceId omitted)
         *   - kind = $args.kind   (when provided)
         */
        myMemories: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                if (!ctx.userId) {
                    throw new GraphQLError('myMemories: authentication required', {
                        extensions: { code: 'UNAUTHENTICATED' }
                    });
                }
                const memories = await defaultConversationMemoryStore.listMemoriesForUser({
                    userId: ctx.userId,
                    workspaceId: args.workspaceId ?? null,
                    kind: args.kind ?? null,
                    query: args.query ?? null,
                    limit: typeof args.limit === 'number' ? args.limit : 50
                });
                return memories.map((memory) => memoryItemSchema.parse(memory));
            });
        },
        /**
         * P2 · myKnowledgeEvidence — reverse-lookup of "AI cited which KB
         * chunks for me, where". Scans memory_items.metadata->>'knowledgeEvidence'
         * JSONB for rows owned by ctx.userId.
         */
        myKnowledgeEvidence: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                if (!ctx.userId) {
                    throw new GraphQLError('myKnowledgeEvidence: authentication required', {
                        extensions: { code: 'UNAUTHENTICATED' }
                    });
                }
                return await defaultConversationMemoryStore.listKnowledgeEvidenceForUser({
                    userId: ctx.userId,
                    workspaceId: args.workspaceId ?? null,
                    limit: typeof args.limit === 'number' ? args.limit : 100
                });
            });
        },
        /**
         * F6 · Data portability (GDPR Art. 20 / PIPL Art. 45).
         *
         * Rate limit: 1 per 5 minutes per user — exports are expensive
         * (full table scan on memory_items + sessions + messages) and
         * users rarely need to export more than once per session.
         */
        exportMyData: async (_, __, ctx) => {
            return await resolveOrThrow(async () => {
                if (!ctx.userId) {
                    throw new GraphQLError('exportMyData: authentication required', {
                        extensions: { code: 'UNAUTHENTICATED' }
                    });
                }
                assertOperationRateLimit(ctx.userId, 'exportMyData', {
                    minIntervalMs: 5 * 60_000
                });
                return await defaultConversationMemoryStore.exportUserData(ctx.userId);
            });
        },
        workspaceContextSnapshot: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                const snapshot = await ctx.conversationStore.buildWorkspaceContextSnapshot(args.workspaceId, ctx.userId, args.query, {
                    conversationId: args.conversationId ?? null,
                    kbId: args.kbId ?? null
                });
                return workspaceContextSnapshotSchema.parse(snapshot);
            });
        },
        /**
         * Runtime event backfill for WS subscription gap-fill.
         *
         * Client-side flow for gap-free delivery across reconnects:
         *   1. Open WS, subscribe to `conversationProgress(workspaceId, conversationId)`.
         *   2. Track the highest 1-based index seen so far (`lastSeenCursor`). The Nth event
         *      received corresponds to cursor N. Persist this in client state.
         *   3. On WS disconnect → reconnect:
         *        a. Re-open subscription (buffer arriving live events client-side).
         *        b. Issue `query conversationRuntimeEvents(workspaceId, conversationId,
         *           sinceCursor: lastSeenCursor)` — returns only events with index > sinceCursor.
         *        c. Merge backfilled events ahead of buffered live ones, dedupe by content
         *           (event-bus is best-effort; duplicates are possible during the handoff window).
         *        d. Resume normal live processing; bump `lastSeenCursor` for each new event.
         *
         * Note: cursor is positional within the workspace event ring buffer (capped by
         *       CONVERSATION_RUNTIME_EVENT_LIMIT, default 400). If a client is offline long
         *       enough for events to roll out of the buffer, sinceCursor=0 is implicitly the
         *       safe-but-lossy fallback. A future extension may switch to monotonic IDs.
         */
        conversationRuntimeEvents: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                const all = await ctx.conversationStore.listConversationRuntimeEvents(args.workspaceId, ctx.userId, args.conversationId ?? undefined);
                const cursor = Math.max(0, args.sinceCursor ?? 0);
                return cursor > 0 ? all.slice(cursor) : all;
            });
        },
        kbTaskStatus: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                await ctx.conversationStore.assertWorkspaceAccess(args.workspaceId, ctx.userId, 'workspace.read');
                const statuses = await ctx.taskEventStore.getTaskStatuses(args.kbId);
                return statuses.map((status) => ({
                    ...status,
                    workspaceId: args.workspaceId
                }));
            });
        },
        knowledgeBases: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                await ctx.conversationStore.assertWorkspaceAccess(args.workspaceId, ctx.userId, 'workspace.read');
                return await listKnowledgeBases(args.workspaceId);
            });
        },
        knowledgeBaseAgentBindings: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                await ctx.conversationStore.assertWorkspaceAccess(args.workspaceId, ctx.userId, 'workspace.read');
                return await listAgentBindingsForKb(args.workspaceId, args.kbId);
            });
        },
        knowledgeBaseDocuments: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                await ctx.conversationStore.assertWorkspaceAccess(args.workspaceId, ctx.userId, 'workspace.read');
                return await listKnowledgeBaseDocuments(args.workspaceId, args.kbId);
            });
        },
        knowledgeBaseStatus: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                await ctx.conversationStore.assertWorkspaceAccess(args.workspaceId, ctx.userId, 'workspace.read');
                return await getKnowledgeBaseStatus(args.workspaceId, args.kbId);
            });
        },
        knowledgeBaseSearch: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                await ctx.conversationStore.assertWorkspaceAccess(args.workspaceId, ctx.userId, 'workspace.read');
                // F1 · pass ctx.userId so private KBs are restricted to their
                // owner; workspace KBs require workspaceId match (already ensured
                // above via assertWorkspaceAccess); global KBs always pass.
                const results = await searchKnowledgeBase(args.workspaceId, args.kbId, args.query, args.topK ?? 5, ctx.userId);
                return results.map((result) => ({
                    docId: result.docId,
                    snippet: result.snippet,
                    score: result.score,
                    metadata: {
                        ...(result.metadata ?? {}),
                        snippetId: deriveSnippetId(result.docId, result.metadata, result.snippet)
                    }
                }));
            });
        },
        workspaces: async (_, __, ctx) => {
            const workspaces = await ctx.conversationStore.listWorkspaces(ctx.userId);
            return workspaces.map((workspace) => workspaceDirectoryItemSchema.parse(workspace));
        },
        workspaceAssets: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                const assets = await ctx.conversationStore.listWorkspaceAssets(args.workspaceId, ctx.userId);
                return assets.map((asset) => workspaceAssetSchema.parse(asset));
            });
        },
        workspaceMetadataHistory: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                const history = await ctx.conversationStore.listWorkspaceHistory(args.workspaceId, ctx.userId);
                return history.map((entry) => workspaceMetadataHistoryEntrySchema.parse(entry));
            });
        },
        // ── Flow / Tool queries ─────────────────────────────
        availableTools: (_, __, ctx) => {
            if (!ctx.toolRegistry)
                return [];
            return ctx.toolRegistry.listAll().map((def) => ({
                name: def.identity.name,
                label: def.display.label,
                description: def.display.description,
                category: def.display.category,
                icon: def.display.icon,
                color: def.display.color,
                inputSchema: def.inputSchema,
                outputSchema: def.outputSchema,
                inputPorts: def.inputPorts,
                outputPorts: def.outputPorts,
                runtime: def.runtime
            }));
        },
        toolByName: (_, args, ctx) => {
            if (!ctx.toolRegistry || !ctx.toolRegistry.has(args.name))
                return null;
            const def = ctx.toolRegistry.getTool(args.name).definition;
            return {
                name: def.identity.name,
                label: def.display.label,
                description: def.display.description,
                category: def.display.category,
                icon: def.display.icon,
                color: def.display.color,
                inputSchema: def.inputSchema,
                outputSchema: def.outputSchema,
                inputPorts: def.inputPorts,
                outputPorts: def.outputPorts,
                runtime: def.runtime
            };
        },
        flows: async (_, args, ctx) => {
            if (!ctx.flowStore)
                return [];
            const flows = await ctx.flowStore.listFlows(args.workspaceId);
            return flows.map(toFlowGQL);
        },
        flow: async (_, args, ctx) => {
            if (!ctx.flowStore)
                return null;
            const flow = await ctx.flowStore.getFlow(args.id);
            return flow ? toFlowGQL(flow) : null;
        },
        flowTemplates: async (_, __, ctx) => {
            if (!ctx.flowStore)
                return [];
            const templates = await ctx.flowStore.listTemplates();
            return templates.map(toFlowGQL);
        },
        flowExecution: async (_, args, ctx) => {
            if (!ctx.executionStore)
                return null;
            const exec = await ctx.executionStore.getExecution(args.id);
            if (!exec)
                return null;
            const nodeStates = await ctx.executionStore.getNodeStates(args.id);
            return { ...exec, startedAt: exec.startedAt.toISOString(), completedAt: exec.completedAt?.toISOString() ?? null, nodeStates };
        },
        flowExecutions: async (_, args, ctx) => {
            if (!ctx.executionStore)
                return [];
            const execs = await ctx.executionStore.listExecutions(args.flowId);
            return execs.map((e) => ({ ...e, startedAt: e.startedAt.toISOString(), completedAt: e.completedAt?.toISOString() ?? null, nodeStates: [] }));
        }
    },
    Mutation: {
        startConversation: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                const record = await ctx.conversationStore.startConversation(args.workspaceId, ctx.userId, args.question, args.kbId ?? undefined);
                const metadata = conversationMetadataSchema.parse(record.metadata);
                return {
                    metadata: {
                        ...metadata,
                        createdAt: metadata.createdAt.toISOString(),
                        updatedAt: metadata.updatedAt.toISOString()
                    },
                    graph: record.graph,
                    knowledgeEvidence: record.knowledgeEvidence ?? [],
                    citations: record.citations ?? []
                };
            });
        },
        approveDecision: async (_, args, ctx) => {
            return await resolveOrThrow(async () => (await ctx.conversationStore.approveDecision(args.conversationId, ctx.userId, args.decision ?? undefined)));
        },
        /**
         * Phase 2.6 · HITL resume.
         *
         * Validates the decision string ([ACCEPTED] / [EDIT_PLAN][<dim>]:<body> /
         * [REJECTED]) and routes through `conversationStore.approveDecision`,
         * which (a) resolves the in-memory awaiter so the streaming `for await`
         * loop continues and (b) dual-writes to the PG HITL store for cross-
         * instance / post-restart visibility.
         *
         * The parsed directive is also picked up by the conversation-store's
         * stream loop (after `waitForDecisionApproval` returns) and forwarded to
         * `BusinessLangGraphService.setHitlResumeDirective`, where the supervisor
         * consumes it on the next revision round to either halt the critic loop
         * or scope revision to a single BMC dimension's owning agent.
         */
        resumeConversation: async (_, args, ctx) => {
            const directive = parseHitlDecision(args.decision);
            if (directive.kind === 'invalid') {
                return { ok: false, decisionKind: 'invalid', message: directive.reason };
            }
            const found = await ctx.conversationStore.approveDecision(args.conversationId, ctx.userId, directive.raw);
            if (!found) {
                return {
                    ok: false,
                    decisionKind: directive.kind,
                    message: 'no pending HITL approval for this conversation'
                };
            }
            const message = directive.kind === 'edit_plan' && directive.dimension
                ? `revision scoped to ${directive.dimension}`
                : directive.kind === 'edit_plan'
                    ? 'full revision round will run'
                    : 'critic loop halted';
            return { ok: true, decisionKind: directive.kind, message };
        },
        appendConversationMessage: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                const message = await ctx.conversationStore.appendConversationMessage({
                    conversationId: args.input.conversationId,
                    workspaceId: args.input.workspaceId,
                    role: args.input.role,
                    content: args.input.content,
                    metadata: args.input.metadata ?? undefined
                }, ctx.userId);
                return conversationMessageSchema.parse(message);
            });
        },
        /**
         * P3 · refreshUserSkills — demand-mode extraction trigger.
         *
         * Bypasses the usual throttle/tier selection so a user clicking
         * "立即更新画像" in the Memory drawer gets immediate feedback. The
         * extractor's own dedup + confidence-update logic prevents double-
         * counting when this is called repeatedly in quick succession.
         */
        refreshUserSkills: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                if (!ctx.userId) {
                    throw new GraphQLError('refreshUserSkills: authentication required', {
                        extensions: { code: 'UNAUTHENTICATED' }
                    });
                }
                // F2 · per-user / per-operation rate limit. Each refresh fires a
                // DeepSeek extraction (~3000 tokens / ~$0.05). A user spamming
                // the button could blow through token budget. Enforce both
                // a minimum gap AND a per-hour cap.
                assertOperationRateLimit(ctx.userId, 'refreshUserSkills', {
                    minIntervalMs: 10_000, // ≥ 10s between calls
                    maxInWindow: 6, // ≤ 6 per hour per user
                    windowMs: 60 * 60_000
                });
                const extractor = ctx.userSkillExtractor;
                if (!extractor) {
                    throw new GraphQLError('refreshUserSkills: extractor not configured', {
                        extensions: { code: 'INTERNAL_SERVER_ERROR' }
                    });
                }
                return await extractor.extractUserSkills({
                    userId: ctx.userId,
                    workspaceId: args.workspaceId,
                    traceId: `refresh-${ctx.userId}-${Date.now()}`,
                    mode: 'demand'
                });
            });
        },
        /**
         * P2 · correctMemoryItem — user-driven correction of an inferred
         * memory row. Three actions in priority order:
         *   1. archive=true → soft-delete (sets archived_at)
         *   2. newContent != null → update content; refreshes updatedAt;
         *      stores user-correction marker in metadata so future
         *      extractor passes don't auto-overwrite it
         *   3. feedback != null → append to metadata.userFeedback array
         *      (used as reinforcement signal by user-skill-extractor)
         *
         * Authorization: caller must own the row. Cross-user attempts
         * throw FORBIDDEN.
         */
        correctMemoryItem: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                if (!ctx.userId) {
                    throw new GraphQLError('correctMemoryItem: authentication required', {
                        extensions: { code: 'UNAUTHENTICATED' }
                    });
                }
                // F2 · prevent spam — 30/min cap is generous for legitimate UI
                // use (one user can flag/archive at most ~1 per 2s) but blocks
                // automated abuse.
                assertOperationRateLimit(ctx.userId, 'correctMemoryItem', {
                    maxInWindow: 30,
                    windowMs: 60_000
                });
                const updated = await defaultConversationMemoryStore.correctMemoryItem({
                    itemId: args.input.itemId,
                    callerUserId: ctx.userId,
                    newContent: args.input.newContent ?? null,
                    archive: Boolean(args.input.archive),
                    feedback: args.input.feedback ?? null
                });
                return memoryItemSchema.parse(updated);
            });
        },
        createMemoryItem: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                const memory = await ctx.conversationStore.createMemoryItem({
                    workspaceId: args.input.workspaceId,
                    scope: args.input.scope,
                    kind: args.input.kind,
                    title: args.input.title,
                    content: args.input.content,
                    sourceType: args.input.sourceType ?? undefined,
                    sourceId: args.input.sourceId ?? undefined,
                    importance: args.input.importance ?? undefined,
                    confidence: args.input.confidence ?? undefined,
                    tags: args.input.tags ?? undefined,
                    metadata: args.input.metadata ?? undefined
                }, ctx.userId);
                return memoryItemSchema.parse(memory);
            });
        },
        extractConversationMemory: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                const memories = await ctx.conversationStore.extractConversationMemory(args.conversationId, ctx.userId);
                return memories.map((memory) => memoryItemSchema.parse(memory));
            });
        },
        addNode: async (_, args, ctx) => {
            return await resolveOrThrow(async () => (await ctx.conversationStore.addNode(args.workspaceId, ctx.userId, args.input)));
        },
        connectNodes: async (_, args, ctx) => {
            return await resolveOrThrow(async () => (await ctx.conversationStore.connectNodes(args.workspaceId, ctx.userId, args.input)));
        },
        createKnowledgeBase: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                await ctx.conversationStore.assertWorkspaceAccess(args.workspaceId, ctx.userId, 'workspace.write');
                // F1 · sanitize visibility — only accept the 3 known values; any
                // other input falls back to 'workspace' (the safe default).
                let visibility = 'workspace';
                if (args.visibility === 'private' || args.visibility === 'workspace' || args.visibility === 'global') {
                    visibility = args.visibility;
                }
                return await createKnowledgeBase(args.workspaceId, {
                    name: args.name ?? undefined,
                    ownerUserId: ctx.userId,
                    visibility
                });
            });
        },
        publishKnowledgeBase: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                await ctx.conversationStore.assertWorkspaceAccess(args.workspaceId, ctx.userId, 'workspace.publish');
                return await publishKnowledgeBase(args.workspaceId, args.kbId);
            });
        },
        /**
         * F1 · Update a KB's visibility. Only the owner may invoke (enforced
         * inside updateKnowledgeBaseVisibility — throws FORBIDDEN otherwise).
         * Cascades to kb_chunks so vector search RLS + WHERE filters reflect
         * the new state immediately.
         */
        /**
         * F4 · Bind a KB to an agent for auto-search. Authorization:
         * workspace.write enforced upstream; KB ownership for 'private'
         * KBs enforced inside bindKbToAgent (throws FORBIDDEN).
         */
        bindKbToAgent: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                if (!ctx.userId) {
                    throw new GraphQLError('bindKbToAgent: authentication required', {
                        extensions: { code: 'UNAUTHENTICATED' }
                    });
                }
                await ctx.conversationStore.assertWorkspaceAccess(args.workspaceId, ctx.userId, 'workspace.write');
                return await bindKbToAgent({
                    workspaceId: args.workspaceId,
                    kbId: args.kbId,
                    agentId: args.agentId,
                    boundByUserId: ctx.userId,
                    autoSearch: args.autoSearch ?? true
                });
            });
        },
        unbindKbFromAgent: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                await ctx.conversationStore.assertWorkspaceAccess(args.workspaceId, ctx.userId, 'workspace.write');
                return await unbindKbFromAgent({
                    workspaceId: args.workspaceId,
                    kbId: args.kbId,
                    agentId: args.agentId
                });
            });
        },
        /**
         * F7 · Delete a single KB document. Cascades to chunks via FK.
         * Owner-check for private KBs is enforced inside
         * deleteKnowledgeBaseDocument.
         */
        deleteKnowledgeBaseDocument: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                if (!ctx.userId) {
                    throw new GraphQLError('deleteKnowledgeBaseDocument: authentication required', {
                        extensions: { code: 'UNAUTHENTICATED' }
                    });
                }
                await ctx.conversationStore.assertWorkspaceAccess(args.workspaceId, ctx.userId, 'workspace.write');
                return await deleteKnowledgeBaseDocument({
                    workspaceId: args.workspaceId,
                    kbId: args.kbId,
                    docId: args.docId,
                    callerUserId: ctx.userId
                });
            });
        },
        updateKnowledgeBaseVisibility: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                if (!ctx.userId) {
                    throw new GraphQLError('updateKnowledgeBaseVisibility: authentication required', {
                        extensions: { code: 'UNAUTHENTICATED' }
                    });
                }
                if (args.visibility !== 'private' && args.visibility !== 'workspace' && args.visibility !== 'global') {
                    throw new GraphQLError(`updateKnowledgeBaseVisibility: invalid visibility "${args.visibility}"; must be private | workspace | global`, { extensions: { code: 'BAD_USER_INPUT' } });
                }
                const updated = await updateKnowledgeBaseVisibility(args.kbId, args.visibility, ctx.userId);
                if (!updated) {
                    throw new GraphQLError('updateKnowledgeBaseVisibility: KB not found', {
                        extensions: { code: 'NOT_FOUND' }
                    });
                }
                return updated;
            });
        },
        addKnowledgeSeed: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                await ctx.conversationStore.assertWorkspaceAccess(args.workspaceId, ctx.userId, 'workspace.write');
                return await addKnowledgeSeed(args.workspaceId, args.kbId, args.text);
            });
        },
        addKnowledgeFile: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                await ctx.conversationStore.assertWorkspaceAccess(args.workspaceId, ctx.userId, 'workspace.write');
                // Cap input size. For text mode, raw string length. For base64
                // mode, the encoded payload is ~33% larger than the underlying
                // bytes, so 8 MiB encoded ≈ 6 MiB raw — that's our bytes cap.
                // Larger files need client-side splitting before upload.
                const isB64 = Boolean(args.isBase64);
                const limitBytes = isB64 ? 8 * 1024 * 1024 : 5 * 1024 * 1024;
                if (args.content.length > limitBytes) {
                    throw new GraphQLError(`addKnowledgeFile: content exceeds ${limitBytes / 1024 / 1024} MiB limit`, { extensions: { code: 'BAD_USER_INPUT' } });
                }
                return await addKnowledgeFile(args.workspaceId, args.kbId, args.fileName, args.contentType, args.content, isB64);
            });
        },
        importKnowledgeUrl: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                await ctx.conversationStore.assertWorkspaceAccess(args.workspaceId, ctx.userId, 'workspace.write');
                return await importKnowledgeUrl(args.workspaceId, args.kbId, args.url);
            });
        },
        saveCommunityPost: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                const input = communityPostInputSchema.parse(args.input);
                const asset = await ctx.conversationStore.saveCommunityPost(input, ctx.userId);
                return workspaceAssetSchema.parse(asset);
            });
        },
        savePracticeSession: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                const input = practiceSessionInputSchema.parse({
                    ...args.input,
                    scenarioTitle: args.input.scenarioTitle ?? undefined,
                    insights: args.input.insights ?? [],
                    resources: (args.input.resources ?? []).map((resource) => ({
                        ...resource,
                        url: resource.url ?? undefined
                    })),
                    quickReplies: args.input.quickReplies ?? [],
                    lastUpdated: args.input.lastUpdated ?? undefined,
                    messages: args.input.messages.map((message) => ({
                        ...message,
                        feedback: message.feedback ?? undefined
                    }))
                });
                const asset = await ctx.conversationStore.savePracticeSession(input, ctx.userId);
                return workspaceAssetSchema.parse(asset);
            });
        },
        // ── Flow mutations ─────────────────────────────
        createFlow: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                if (!ctx.flowStore)
                    throw new Error('Flow store not available');
                const flow = await ctx.flowStore.createFlow(args.workspaceId, args.name, args.definition, ctx.userId);
                return toFlowGQL(flow);
            });
        },
        updateFlow: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                if (!ctx.flowStore)
                    throw new Error('Flow store not available');
                const flow = await ctx.flowStore.updateFlow(args.id, { name: args.name ?? undefined, definition: args.definition ?? undefined });
                if (!flow)
                    throw new GraphQLError('Flow not found');
                return toFlowGQL(flow);
            });
        },
        deleteFlow: async (_, args, ctx) => {
            if (!ctx.flowStore)
                return false;
            return await ctx.flowStore.deleteFlow(args.id);
        },
        saveAsTemplate: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                if (!ctx.flowStore)
                    throw new Error('Flow store not available');
                const flow = await ctx.flowStore.saveAsTemplate(args.flowId, args.name);
                if (!flow)
                    throw new GraphQLError('Source flow not found');
                return toFlowGQL(flow);
            });
        },
        executeFlow: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                if (!ctx.flowStore || !ctx.executionStore || !ctx.graphCompiler || !ctx.graphExecutor) {
                    throw new Error('Execution infrastructure not available');
                }
                const flowStore = ctx.flowStore;
                const executionStore = ctx.executionStore;
                const graphCompiler = ctx.graphCompiler;
                const graphExecutor = ctx.graphExecutor;
                const flowRecord = await flowStore.getFlow(args.flowId);
                if (!flowRecord)
                    throw new GraphQLError('Flow not found');
                const plan = graphCompiler.compile(flowRecord.definition);
                const exec = await executionStore.createExecution(args.flowId, args.inputs ?? {});
                await executionStore.updateExecutionStatus(exec.id, 'running');
                // Run in background
                const execCtx = { workspaceId: flowRecord.workspaceId, userId: ctx.userId, executionId: exec.id, abortController: new AbortController() };
                void (async () => {
                    try {
                        for await (const event of graphExecutor.execute(plan, args.inputs ?? {}, execCtx)) {
                            publishExecutionEvent(exec.id, event);
                            if (event.type === 'node_complete') {
                                await executionStore.updateNodeState(exec.id, event.nodeId, 'completed', event.output, undefined, event.duration);
                            }
                            else if (event.type === 'node_error') {
                                await executionStore.updateNodeState(exec.id, event.nodeId, 'failed', undefined, event.error);
                            }
                            else if (event.type === 'flow_complete') {
                                await executionStore.updateExecutionStatus(exec.id, 'completed', event.finalState);
                            }
                        }
                    }
                    catch (err) {
                        await executionStore.updateExecutionStatus(exec.id, 'failed', undefined, err instanceof Error ? err.message : String(err));
                    }
                })();
                return { ...exec, startedAt: exec.startedAt.toISOString(), completedAt: null, nodeStates: [] };
            });
        },
        cancelExecution: async (_, args, ctx) => {
            if (!ctx.executionStore)
                return false;
            await ctx.executionStore.updateExecutionStatus(args.executionId, 'cancelled');
            return true;
        },
        updateWorkspaceMetadata: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                const input = workspaceMetadataUpdateInputSchema.parse({
                    ...args.input,
                    members: args.input.members.map((member) => ({
                        ...member,
                        role: member.role ?? undefined
                    }))
                });
                const workspace = await ctx.conversationStore.updateWorkspace(input, ctx.userId);
                return workspaceDirectoryItemSchema.parse(workspace);
            });
        },
        // ── Ideation Coach mutations (Wave F.6 + F.7) ──────────────────
        // Mirror the existing apps/web Next.js routes at
        //   /api/ideation/reflect
        //   /api/ideation/wizard-step
        // via the shared @starlink/shared/ideation-coach module. Both
        // surfaces consume the same prompt + parser. Frontend can use
        // either; benchmark consumers / future mobile clients use this
        // GraphQL surface.
        reflectOnIdeation: async (_, args, context) => {
            // Cast to ReflectionRequest — Apollo strips the GraphQL types;
            // shared Zod will reject anything malformed downstream, but this
            // resolver only does the bare adaptation.
            const baseReq = args.input;
            // User-skill block: server-fetched (never trusted from client).
            // Skip fetch when workspaceId / userId missing — both layers of the
            // skill query require them. Build helper returns '' on any failure
            // (no PG, no skills, etc) so the downstream prompt stays identical
            // to the pre-personalization shape.
            const userSkillBlock = context.userId && args.input.workspaceId
                ? await buildUserSkillPrompt(defaultConversationMemoryStore, context.userId, args.input.workspaceId, args.input.canvas.nodes
                    .map((n) => `${n.label}: ${n.content}`)
                    .join(' · ')
                    .slice(0, 240) || 'reflection')
                : '';
            const req = { ...baseReq, userSkillBlock };
            const result = await reflectOnIdeation(req);
            // Map scaffold "so-what" / "evidence-needed" to their GraphQL enum
            // forms (snake_case) since GraphQL enums can't have hyphens.
            const SCAFFOLD_GQL = {
                why: 'why',
                how: 'how',
                'so-what': 'so_what',
                'evidence-needed': 'evidence_needed',
                meta: 'meta'
            };
            return {
                scaffold: SCAFFOLD_GQL[result.scaffold] ?? result.scaffold,
                content: result.content,
                source: result.source,
                latencyMs: result.latencyMs
            };
        },
        processIdeationWizardStep: async (_, args, context) => {
            const baseReq = args.input;
            const userSkillBlock = context.userId && args.input.workspaceId
                ? await buildUserSkillPrompt(defaultConversationMemoryStore, context.userId, args.input.workspaceId, args.input.userAnswer.slice(0, 240) || args.input.step)
                : '';
            const req = { ...baseReq, userSkillBlock };
            return await processIdeationWizardStep(req);
        },
        /**
         * Cancel a stale 'running' session. Authorization: caller must own
         * the session (userId match) — we don't allow one user to cancel
         * another user's session even within the same workspace.
         *
         * The session is marked 'failed' with the supplied reason (or a
         * default user-cancellation message). Heartbeat-driven reaper would
         * eventually do this for us when the gateway crashed, but exposing
         * the explicit mutation lets the UI offer "clear stuck session"
         * without waiting for the next reaper tick.
         */
        cancelStaleSession: async (_, args, ctx) => {
            const session = await defaultConversationMemoryStore.getSession(args.sessionId);
            if (!session)
                return null;
            if (ctx.userId && session.userId !== ctx.userId) {
                throw new GraphQLError('cancelStaleSession: forbidden — session belongs to another user', {
                    extensions: { code: 'FORBIDDEN' }
                });
            }
            if (session.status !== 'running') {
                // Already done — return current state for idempotency.
                return session;
            }
            const reason = args.reason?.trim() || 'user-cancelled';
            await defaultConversationMemoryStore.failSession(session.id, reason);
            return await defaultConversationMemoryStore.getSession(args.sessionId);
        },
        // @-mention agent (2026-05-04). Routes via ConversationStore.mentionAgent
        // which checks workspace.write, reads current canvas snapshot, and
        // persists any appended nodes via MentionRouter.
        mentionAgent: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                const trimmedMessage = args.input.message?.trim() ?? '';
                if (!trimmedMessage) {
                    throw new GraphQLError('mentionAgent: message cannot be empty', {
                        extensions: { code: 'BAD_USER_INPUT' }
                    });
                }
                const result = await ctx.conversationStore.mentionAgent(args.input.workspaceId, ctx.userId, {
                    agentId: args.input.agentId,
                    message: trimmedMessage,
                    conversationId: args.input.conversationId ?? undefined
                });
                return result;
            });
        }
    },
    // ── Flow / Tool resolvers ────────────────────────────────
    // These are merged into Query/Mutation via extend type in type-defs.
    // Apollo merges them automatically.
    Subscription: {
        flowExecutionProgress: {
            subscribe: (_, args) => {
                return pubsub.asyncIterableIterator(FLOW_EXECUTION_PROGRESS);
            },
            resolve: (payload) => payload.flowExecutionProgress
        },
        conversationProgress: {
            subscribe: async (_, args, ctx) => {
                return await resolveOrThrow(async () => {
                    await ctx.conversationStore.assertConversationScope(args.workspaceId, ctx.userId, args.conversationId ?? undefined);
                    return ctx.conversationStore.getEventIterator({
                        workspaceId: args.workspaceId,
                        conversationId: args.conversationId ?? undefined
                    });
                });
            },
            resolve: (payload) => payload.conversationProgress
        }
    }
};
function toFlowGQL(flow) {
    return {
        id: flow.id,
        workspaceId: flow.workspaceId,
        name: flow.name,
        description: flow.description ?? null,
        definition: flow.definition,
        isTemplate: flow.isTemplate,
        version: flow.version,
        createdAt: flow.createdAt.toISOString(),
        updatedAt: flow.updatedAt.toISOString()
    };
}
async function resolveOrThrow(operation) {
    try {
        return await operation();
    }
    catch (error) {
        throw toGraphQLError(error);
    }
}
function toGraphQLError(error) {
    if (error instanceof GraphQLError)
        return error;
    if (error instanceof Error) {
        if (error.message === 'FORBIDDEN_WORKSPACE' || error.message === 'FORBIDDEN_WORKSPACE_METADATA') {
            return new GraphQLError('You do not have permission to access this workspace.', {
                extensions: {
                    code: 'FORBIDDEN'
                }
            });
        }
        if (error.message === 'INVALID_CONVERSATION_SCOPE') {
            return new GraphQLError('The conversation does not belong to the requested workspace.', {
                extensions: {
                    code: 'BAD_USER_INPUT'
                }
            });
        }
        // DEC-5 soft-lock: surface the active conversation id so the frontend
        // can offer the user "open the active one" instead of just bouncing.
        if (error.name === 'WorkspaceLockError') {
            const lock = error;
            return new GraphQLError('This workspace already has an active conversation. Cancel or finish it before starting a new one.', {
                extensions: {
                    code: 'WORKSPACE_HAS_ACTIVE_CONVERSATION',
                    workspaceId: lock.workspaceId,
                    activeConversationId: lock.activeConversationId
                }
            });
        }
        return new GraphQLError(error.message);
    }
    return new GraphQLError('Unexpected resolver error');
}
