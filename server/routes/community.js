import { Router } from 'express';
import {
    getCategories,
    getPosts,
    getPost,
    createPost,
    updatePost,
    deletePost,
    addComment,
    toggleLike,
    toggleBookmark,
    getBookmarks,
    createReport,
    getModerationQueue,
    resolveReport,
    verifyPost,
    approvePost,
    MEDICAL_DISCLAIMER
} from '../engines/communityEngine.js';

const router = Router();

// ─── Lightweight Profanity Filter (ESM-compatible) ───────────
// Curated word list for community safety — extends over time
const PROFANITY_LIST = [
    'ass', 'asshole', 'bastard', 'bitch', 'bullshit', 'crap', 'cunt', 'damn',
    'dick', 'dumbass', 'fuck', 'fucker', 'fucking', 'goddamn', 'hell', 'idiot',
    'moron', 'nigger', 'piss', 'shit', 'slut', 'whore', 'retard', 'retarded'
];
const profanityRegex = new RegExp(
    `\\b(${PROFANITY_LIST.join('|')})\\b`, 'gi'
);

const profanityFilter = {
    isProfane(text) {
        return profanityRegex.test(text);
    },
    clean(text) {
        return text.replace(profanityRegex, (match) => '*'.repeat(match.length));
    }
};

// Helper to get user ID with fallback
function getUserId(req) {
    return (req.user && req.user.id) ? req.user.id : 1;
}

// ============================================
// CATEGORY ROUTES
// ============================================

// GET /community/categories — List all active categories
router.get('/community/categories', (req, res) => {
    try {
        const categories = getCategories();
        res.json({ success: true, categories, disclaimer: MEDICAL_DISCLAIMER });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// POST ROUTES
// ============================================

// GET /community/posts — Paginated post feed
router.get('/community/posts', (req, res) => {
    try {
        const { category, page } = req.query;
        const userId = getUserId(req);
        const result = getPosts({ category, page: parseInt(page) || 1, userId });
        res.json({ success: true, ...result, disclaimer: MEDICAL_DISCLAIMER });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /community/posts/:id — Single post with comments
router.get('/community/posts/:id', (req, res) => {
    try {
        const postId = parseInt(req.params.id);
        if (isNaN(postId)) return res.status(400).json({ error: 'Invalid post ID' });

        const userId = getUserId(req);
        const post = getPost(postId, userId);
        if (!post) return res.status(404).json({ error: 'Post not found' });

        res.json({ success: true, post, disclaimer: MEDICAL_DISCLAIMER });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /community/posts — Create new post (with profanity filter)
router.post('/community/posts', (req, res) => {
    try {
        const userId = getUserId(req);
        let { category_id, title, content } = req.body;

        // Clean profanity from title and content
        let filtered = false;
        if (title && profanityFilter.isProfane(title)) {
            title = profanityFilter.clean(title);
            filtered = true;
        }
        if (content && profanityFilter.isProfane(content)) {
            content = profanityFilter.clean(content);
            filtered = true;
        }

        const result = createPost({ author_id: userId, category_id, title, content });
        res.json({ ...result, filtered });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// PATCH /community/posts/:id — Edit own post
router.patch('/community/posts/:id', (req, res) => {
    try {
        const postId = parseInt(req.params.id);
        if (isNaN(postId)) return res.status(400).json({ error: 'Invalid post ID' });

        const userId = getUserId(req);
        const result = updatePost(postId, userId, req.body);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// DELETE /community/posts/:id — Soft-delete own post
router.delete('/community/posts/:id', (req, res) => {
    try {
        const postId = parseInt(req.params.id);
        if (isNaN(postId)) return res.status(400).json({ error: 'Invalid post ID' });

        const userId = getUserId(req);
        const result = deletePost(postId, userId);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// ============================================
// COMMENT ROUTES
// ============================================

// POST /community/posts/:id/comments — Add comment to post (with profanity filter)
router.post('/community/posts/:id/comments', (req, res) => {
    try {
        const postId = parseInt(req.params.id);
        if (isNaN(postId)) return res.status(400).json({ error: 'Invalid post ID' });

        const userId = getUserId(req);
        let { content, parent_comment_id } = req.body;

        // Clean profanity from comment
        let filtered = false;
        if (content && profanityFilter.isProfane(content)) {
            content = profanityFilter.clean(content);
            filtered = true;
        }

        const result = addComment({ post_id: postId, author_id: userId, content, parent_comment_id });
        res.json({ ...result, filtered });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// ============================================
// LIKE ROUTES
// ============================================

// POST /community/likes — Toggle like
router.post('/community/likes', (req, res) => {
    try {
        const userId = getUserId(req);
        const { target_type, target_id } = req.body;
        const result = toggleLike({ user_id: userId, target_type, target_id });
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// ============================================
// BOOKMARK ROUTES
// ============================================

// POST /community/bookmarks/:postId — Toggle bookmark
router.post('/community/bookmarks/:postId', (req, res) => {
    try {
        const postId = parseInt(req.params.postId);
        if (isNaN(postId)) return res.status(400).json({ error: 'Invalid post ID' });

        const userId = getUserId(req);
        const result = toggleBookmark(userId, postId);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// GET /community/bookmarks — Get user's bookmarks  
router.get('/community/bookmarks', (req, res) => {
    try {
        const userId = getUserId(req);
        const bookmarks = getBookmarks(userId);
        res.json({ success: true, bookmarks });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// REPORT ROUTES
// ============================================

// POST /community/reports — Report content
router.post('/community/reports', (req, res) => {
    try {
        const userId = getUserId(req);
        const { target_type, target_id, reason, description } = req.body;
        const result = createReport({ reporter_id: userId, target_type, target_id, reason, description });
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// ============================================
// MODERATION ROUTES (Admin/Clinician only)
// ============================================

// GET /community/moderation/queue — Moderation queue
router.get('/community/moderation/queue', (req, res) => {
    try {
        const queue = getModerationQueue();
        res.json({ success: true, ...queue });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /community/moderation/:reportId/resolve — Resolve report
router.post('/community/moderation/:reportId/resolve', (req, res) => {
    try {
        const reportId = parseInt(req.params.reportId);
        if (isNaN(reportId)) return res.status(400).json({ error: 'Invalid report ID' });

        const userId = getUserId(req);
        const { action } = req.body;
        const result = resolveReport(reportId, userId, action);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /community/posts/:id/verify — Clinician verify post
router.post('/community/posts/:id/verify', (req, res) => {
    try {
        const postId = parseInt(req.params.id);
        if (isNaN(postId)) return res.status(400).json({ error: 'Invalid post ID' });

        const userId = getUserId(req);
        const result = verifyPost(postId, userId);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /community/moderation/posts/:id/approve — Approve under-review post
router.post('/community/moderation/posts/:id/approve', (req, res) => {
    try {
        const postId = parseInt(req.params.id);
        if (isNaN(postId)) return res.status(400).json({ error: 'Invalid post ID' });

        const userId = getUserId(req);
        const result = approvePost(postId, userId);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

export default router;
