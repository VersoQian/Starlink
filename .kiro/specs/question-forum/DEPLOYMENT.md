# Question Forum Deployment Guide

This guide covers deploying the Branching Chat application with the Question Forum feature to Cloudflare Workers.

## Prerequisites

1. **Cloudflare Account**: Sign up at [cloudflare.com](https://cloudflare.com)
2. **Wrangler CLI**: Installed via npm (included in project dependencies)
3. **Google AI API Key**: Get from [Google AI Studio](https://aistudio.google.com/apikey)

## Local Development Setup

### 1. Install Dependencies

```bash
yarn install
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory:

```env
GOOGLE_GENERATIVE_AI_API_KEY=your_api_key_here
```

### 3. Start Development Server

For frontend development with hot reload:

```bash
yarn dev
```

This starts Vite dev server at `http://localhost:5173`

For full-stack development with Workers:

```bash
npx wrangler dev
```

This runs both the frontend and Cloudflare Worker locally.

### 4. Local Data Storage

During local development, Durable Object data is stored in:
```
.wrangler/state/v3/do/branching-chat-template-ForumStorage/
```

This directory is gitignored and contains SQLite databases for local testing.

## Production Deployment

### Step 1: Authenticate with Cloudflare

```bash
npx wrangler login
```

This opens a browser window to authenticate with your Cloudflare account.

### Step 2: Build the Application

```bash
yarn build
```

This command:
- Compiles TypeScript
- Builds the React frontend with Vite
- Outputs to `dist/` directory

### Step 3: Configure Secrets

Set your API key as a secret (more secure than environment variables):

```bash
npx wrangler secret put GOOGLE_GENERATIVE_AI_API_KEY
```

You'll be prompted to enter the key value.

### Step 4: Deploy

```bash
npx wrangler deploy
```

This command:
- Uploads your Worker code
- Creates the ForumStorage Durable Object class
- Deploys static assets from `dist/`
- Configures routing

### Step 5: Verify Deployment

After deployment, Wrangler will output your Worker URL:

```
Published branching-chat-template
  https://branching-chat-template.your-subdomain.workers.dev
```

Visit this URL to test your deployment.

## Durable Objects Configuration

The forum feature uses Cloudflare Durable Objects for data persistence.

### Configuration (wrangler.toml)

```toml
[durable_objects]
bindings = [
  { name = "FORUM_STORAGE", class_name = "ForumStorage" }
]

[[migrations]]
tag = "v1"
new_classes = ["ForumStorage"]
```

### How It Works

1. **First Deployment**: Cloudflare creates the `ForumStorage` Durable Object class
2. **Data Storage**: Each Durable Object instance maintains persistent storage
3. **Automatic Scaling**: Cloudflare manages object instances based on usage
4. **Global Distribution**: Objects are created near users for low latency

### No Manual Setup Required

Unlike traditional databases:
- ❌ No database server to provision
- ❌ No schema migrations to run
- ❌ No connection strings to configure
- ✅ Automatic initialization on first use
- ✅ Built-in persistence and consistency
- ✅ Scales automatically

## Deployment Verification

### 1. Check Deployment Status

```bash
npx wrangler deployments list
```

### 2. View Live Logs

```bash
npx wrangler tail
```

This streams real-time logs from your Worker.

### 3. Test Forum Features

1. Visit your deployed URL
2. Click "Question Forum" in the toolbar
3. Publish a test question
4. Refresh the page - data should persist
5. Test replies, likes, and search
6. Test canvas import functionality

### 4. Monitor Durable Objects

In the Cloudflare Dashboard:
1. Go to Workers & Pages
2. Select your Worker
3. Click "Durable Objects" tab
4. View object instances and metrics

## Custom Domain Setup

### Option 1: Workers.dev Subdomain (Free)

Your Worker is automatically available at:
```
https://branching-chat-template.your-subdomain.workers.dev
```

### Option 2: Custom Domain

1. Add your domain to Cloudflare
2. Update `wrangler.toml`:

```toml
[[routes]]
pattern = "forum.yourdomain.com"
custom_domain = true
```

3. Deploy:

```bash
npx wrangler deploy
```

Cloudflare automatically provisions SSL certificates.

## Environment Management

### Development vs Production

Use different Worker names for different environments:

**wrangler.toml** (production):
```toml
name = "branching-chat-template"
```

**wrangler.dev.toml** (development):
```toml
name = "branching-chat-template-dev"
```

Deploy to dev:
```bash
npx wrangler deploy --config wrangler.dev.toml
```

### Environment Variables

Set different secrets per environment:

```bash
# Production
npx wrangler secret put GOOGLE_GENERATIVE_AI_API_KEY

# Development
npx wrangler secret put GOOGLE_GENERATIVE_AI_API_KEY --env dev
```

## Troubleshooting

### Build Errors

**Issue**: TypeScript compilation errors

**Solution**: 
```bash
# Clean build
rm -rf dist node_modules
yarn install
yarn build
```

### Deployment Fails

**Issue**: "Durable Object binding not found"

**Solution**: Ensure `wrangler.toml` has correct configuration and migration tag.

**Issue**: "Assets directory not found"

**Solution**: Run `yarn build` before deploying.

### Runtime Errors

**Issue**: "GOOGLE_GENERATIVE_AI_API_KEY not found"

**Solution**: Set the secret:
```bash
npx wrangler secret put GOOGLE_GENERATIVE_AI_API_KEY
```

**Issue**: Forum data not persisting

**Solution**: 
1. Check Durable Objects are enabled in Cloudflare Dashboard
2. Verify migration ran successfully
3. Check Worker logs: `npx wrangler tail`

### Performance Issues

**Issue**: Slow forum loading

**Solution**:
1. Check Durable Object location (should be near users)
2. Review Worker logs for errors
3. Consider implementing caching

## Rollback

If you need to rollback to a previous deployment:

```bash
# List deployments
npx wrangler deployments list

# Rollback to specific deployment
npx wrangler rollback [deployment-id]
```

**Note**: Durable Object data is not affected by rollbacks.

## Data Management

### Backup

Durable Objects don't have built-in backup. To backup data:

1. Create an admin endpoint to export data
2. Call it periodically to save snapshots
3. Store backups in R2 or external storage

### Data Migration

If you need to migrate data structure:

1. Add new migration tag in `wrangler.toml`:
```toml
[[migrations]]
tag = "v2"
renamed_classes = [{from = "ForumStorage", to = "ForumStorageV2"}]
```

2. Deploy with new code that handles both old and new formats

### Clear Local Data

To reset local development data:

```bash
rm -rf .wrangler/state
```

## Monitoring and Analytics

### Cloudflare Dashboard

Monitor your Worker:
- Request volume
- Error rates
- CPU time
- Durable Object usage

### Custom Logging

Add structured logging in your Worker:

```typescript
console.log(JSON.stringify({
  event: 'question_published',
  questionId: question.id,
  timestamp: Date.now()
}));
```

View logs:
```bash
npx wrangler tail --format json
```

## Cost Considerations

### Free Tier Limits

- 100,000 requests/day
- 10ms CPU time per request
- Durable Objects: First 1M requests free

### Paid Plan

- $5/month for Workers Paid
- Additional requests: $0.50 per million
- Durable Objects: $0.15 per million requests

### Optimization Tips

1. Cache static assets aggressively
2. Minimize Durable Object operations
3. Batch API calls when possible
4. Use edge caching for read-heavy operations

## Security Best Practices

1. **Secrets Management**: Always use `wrangler secret` for API keys
2. **Input Validation**: Validate all user input (already implemented with Zod)
3. **Rate Limiting**: Consider adding rate limits for API endpoints
4. **CORS**: Configure CORS headers appropriately
5. **Content Security**: Sanitize user-generated content (already implemented)

## Support and Resources

- **Cloudflare Workers Docs**: https://developers.cloudflare.com/workers/
- **Durable Objects Guide**: https://developers.cloudflare.com/durable-objects/
- **Wrangler CLI Docs**: https://developers.cloudflare.com/workers/wrangler/
- **Community Discord**: https://discord.gg/cloudflaredev

## Next Steps

After successful deployment:

1. ✅ Test all forum features in production
2. ✅ Monitor error rates and performance
3. ✅ Set up custom domain (optional)
4. ✅ Configure analytics and monitoring
5. ✅ Plan for data backup strategy
6. ✅ Consider implementing rate limiting
7. ✅ Add more comprehensive error tracking

## Conclusion

Your Branching Chat application with Question Forum is now deployed on Cloudflare Workers with:

- ✅ Global edge deployment
- ✅ Persistent data storage via Durable Objects
- ✅ Automatic scaling
- ✅ SSL/TLS encryption
- ✅ Low latency worldwide

Enjoy your deployed application!
