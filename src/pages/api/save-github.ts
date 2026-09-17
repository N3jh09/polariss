// src/pages/api/save-github.ts
import type { APIRoute } from 'astro';
import { Octokit } from '@octokit/rest';

export const POST: APIRoute = async ({ request, locals }) => {
    try {
        // 1. Resolve environment variables with Cloudflare fallback
        const cfEnv = (locals as any)?.runtime?.env || {};
        const GITHUB_TOKEN = import.meta.env.GITHUB_TOKEN || cfEnv.GITHUB_TOKEN;
        const GITHUB_REPO = import.meta.env.GITHUB_REPO || cfEnv.GITHUB_REPO;
        const GITHUB_BRANCH = import.meta.env.GITHUB_BRANCH || cfEnv.GITHUB_BRANCH || 'main';

        const { slug, content } = await request.json();

        if (!slug || !content) {
            return new Response(
                JSON.stringify({ message: 'Missing slug or content.' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        if (!GITHUB_TOKEN || !GITHUB_REPO) {
            return new Response(
                JSON.stringify({ message: 'Server environment misconfigured.' }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const octokit = new Octokit({ auth: GITHUB_TOKEN });
        const [owner, repo] = GITHUB_REPO.split('/');
        const filePath = `src/content/blog/${slug}.md`;

        // 2. Check if file exists to fetch SHA for updates
        let fileSha: string | undefined;
        try {
            const existingFile = await octokit.rest.repos.getContent({
                owner,
                repo,
                path: filePath,
                ref: GITHUB_BRANCH,
            });

            if (!Array.isArray(existingFile.data) && 'sha' in existingFile.data) {
                fileSha = existingFile.data.sha;
            }
        } catch (error: any) {
            if (error.status !== 404) throw error;
        }

        // 3. Commit to GitHub
        const result = await octokit.rest.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: filePath,
            message: `content: publish ${slug}.md`,
            content: btoa(unescape(encodeURIComponent(content))),
            branch: GITHUB_BRANCH,
            sha: fileSha,
        });

        return new Response(
            JSON.stringify({
                message: 'Successfully committed to GitHub',
                commitUrl: result.data.commit.html_url,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    } catch (error: any) {
        return new Response(
            JSON.stringify({ message: error.message || 'Server error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}; s