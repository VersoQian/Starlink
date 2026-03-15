ALTER TABLE "KnowledgeBase"
ADD COLUMN "workspaceId" TEXT;

CREATE INDEX "KnowledgeBase_workspaceId_idx" ON "KnowledgeBase"("workspaceId");
