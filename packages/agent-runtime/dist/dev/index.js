import { runCanvasPipeline } from '../index.js';
async function main() {
    const result = await runCanvasPipeline({
        workspaceId: 'demo',
        userId: 'dev-user',
        question: '演示问题：如何规划产品发布?'
    });
    console.log(JSON.stringify(result, null, 2));
}
void main();
