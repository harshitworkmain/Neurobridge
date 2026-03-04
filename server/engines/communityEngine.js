import db from '../db.js';

// ============================================
// COMMUNITY ENGINE
// Handles: Posts, Comments, Likes, Reports, Moderation
// ============================================

const POSTS_PER_PAGE = 20;
const MAX_POSTS_PER_DAY = 5;
const MAX_COMMENTS_PER_DAY = 20;
const AUTO_FLAG_REPORT_THRESHOLD = 3;
const AUTO_HIDE_REPORT_THRESHOLD = 5;

// Keywords that trigger review (medical misinformation risk)
const WATCHLIST_KEYWORDS = [
    'cure for autism', 'autism cure', 'bleach', 'mms', 'chelation',
    'miracle cure', 'vaccine caused', 'dangerous treatment',
    'stop medication', 'no doctor needed'
];

// Crisis keywords that trigger resource banner
const CRISIS_KEYWORDS = [
    'hopeless', "can't cope", 'give up', 'self-harm', 'self harm',
    'hurt myself', 'end it all', 'suicidal', 'want to die', 'kill myself'
];

const MEDICAL_DISCLAIMER = '⚕️ This platform is not a substitute for professional medical advice. Always consult a qualified healthcare provider for medical decisions.';

// ============================================
// CATEGORIES
// ============================================

export function getCategories() {
    const categories = db.prepare('SELECT * FROM community_categories WHERE is_active = 1 ORDER BY sort_order ASC').all();

    // Attach post counts
    return categories.map(cat => {
        const count = db.prepare('SELECT COUNT(*) as count FROM community_posts WHERE category_id = ? AND status = ?').get(cat.id, 'active');
        return { ...cat, post_count: count.count };
    });
}

// ============================================
// POSTS
// ============================================

/**
 * Get paginated post feed with optional category filter
 */
export function getPosts({ category, page = 1, userId }) {
    const offset = (page - 1) * POSTS_PER_PAGE;
    let query = `
    SELECT 
      p.*,
      u.name as author_name,
      u.display_name as author_display_name,
      u.role as author_role,
      cc.name as category_name,
      cc.icon as category_icon
    FROM community_posts p
    JOIN users u ON p.author_id = u.id
    JOIN community_categories cc ON p.category_id = cc.id
    WHERE p.status = 'active'
  `;
    const params = [];

    if (category) {
        query += ' AND p.category_id = ?';
        params.push(category);
    }

    query += ' ORDER BY p.is_pinned DESC, p.created_at DESC LIMIT ? OFFSET ?';
    params.push(POSTS_PER_PAGE, offset);

    const posts = db.prepare(query).all(...params);

    // Get total count for pagination
    let countQuery = "SELECT COUNT(*) as total FROM community_posts WHERE status = 'active'";
    const countParams = [];
    if (category) {
        countQuery += ' AND category_id = ?';
        countParams.push(category);
    }
    const total = db.prepare(countQuery).get(...countParams).total;

    // Check if user has liked each post
    const enrichedPosts = posts.map(post => {
        const userLiked = userId ? db.prepare(
            "SELECT id FROM community_likes WHERE user_id = ? AND target_type = 'post' AND target_id = ?"
        ).get(userId, post.id) : null;

        const userBookmarked = userId ? db.prepare(
            'SELECT id FROM community_bookmarks WHERE user_id = ? AND post_id = ?'
        ).get(userId, post.id) : null;

        return {
            ...post,
            author_display: post.author_display_name || post.author_name,
            user_liked: !!userLiked,
            user_bookmarked: !!userBookmarked,
            has_crisis_content: checkCrisisContent(post.content),
            disclaimer: shouldShowDisclaimer(post.category_id) ? MEDICAL_DISCLAIMER : null
        };
    });

    return {
        posts: enrichedPosts,
        pagination: {
            page,
            per_page: POSTS_PER_PAGE,
            total,
            total_pages: Math.ceil(total / POSTS_PER_PAGE)
        }
    };
}

/**
 * Get single post with comments
 */
export function getPost(postId, userId) {
    const post = db.prepare(`
    SELECT 
      p.*,
      u.name as author_name,
      u.display_name as author_display_name,
      u.role as author_role,
      cc.name as category_name,
      cc.icon as category_icon
    FROM community_posts p
    JOIN users u ON p.author_id = u.id
    JOIN community_categories cc ON p.category_id = cc.id
    WHERE p.id = ? AND p.status != 'removed'
  `).get(postId);

    if (!post) return null;

    // Get comments
    const comments = db.prepare(`
    SELECT 
      c.*,
      u.name as author_name,
      u.display_name as author_display_name,
      u.role as author_role
    FROM community_comments c
    JOIN users u ON c.author_id = u.id
    WHERE c.post_id = ? AND c.status = 'active'
    ORDER BY c.created_at ASC
  `).all(postId);

    // Check user interactions
    const userLiked = userId ? db.prepare(
        "SELECT id FROM community_likes WHERE user_id = ? AND target_type = 'post' AND target_id = ?"
    ).get(userId, postId) : null;

    const userBookmarked = userId ? db.prepare(
        'SELECT id FROM community_bookmarks WHERE user_id = ? AND post_id = ?'
    ).get(userId, postId) : null;

    // Enrich comments with like status
    const enrichedComments = comments.map(c => {
        const commentLiked = userId ? db.prepare(
            "SELECT id FROM community_likes WHERE user_id = ? AND target_type = 'comment' AND target_id = ?"
        ).get(userId, c.id) : null;

        return {
            ...c,
            author_display: c.author_display_name || c.author_name,
            user_liked: !!commentLiked
        };
    });

    return {
        ...post,
        author_display: post.author_display_name || post.author_name,
        user_liked: !!userLiked,
        user_bookmarked: !!userBookmarked,
        has_crisis_content: checkCrisisContent(post.content),
        disclaimer: shouldShowDisclaimer(post.category_id) ? MEDICAL_DISCLAIMER : null,
        comments: enrichedComments
    };
}

/**
 * Create a new post
 */
export function createPost({ author_id, category_id, title, content }) {
    if (!author_id || !category_id || !title || !content) {
        throw new Error('author_id, category_id, title, and content are required');
    }

    // Check rate limit
    const today = new Date().toISOString().split('T')[0];
    const todayCount = db.prepare(
        "SELECT COUNT(*) as count FROM community_posts WHERE author_id = ? AND date(created_at) = ?"
    ).get(author_id, today);

    if (todayCount.count >= MAX_POSTS_PER_DAY) {
        throw new Error(`Daily post limit reached (${MAX_POSTS_PER_DAY} posts/day)`);
    }

    // Check user status
    const user = db.prepare('SELECT account_status, role FROM users WHERE id = ?').get(author_id);
    if (user?.account_status === 'banned' || user?.account_status === 'suspended') {
        throw new Error('Your account is currently restricted from posting');
    }

    // Check "Ask a Clinician" category restriction
    if (category_id === 'ask_clinician' && user?.role !== 'clinician' && user?.role !== 'admin') {
        // Allow questions, but note that only clinicians can answer
        // (we allow posting questions here, responses come as comments)
    }

    // Determine initial status (first-post moderation)
    const postCount = db.prepare('SELECT COUNT(*) as count FROM community_posts WHERE author_id = ?').get(author_id);
    const status = postCount.count < 3 ? 'under_review' : 'active';

    // Check for watchlist keywords
    const hasWatchlistContent = checkWatchlistContent(title + ' ' + content);

    const stmt = db.prepare(`
    INSERT INTO community_posts (author_id, category_id, title, content, status)
    VALUES (?, ?, ?, ?, ?)
  `);

    const info = stmt.run(
        author_id, category_id, title, content,
        hasWatchlistContent ? 'under_review' : status
    );

    return {
        id: info.lastInsertRowid,
        status: hasWatchlistContent ? 'under_review' : status,
        flagged: hasWatchlistContent,
        success: true
    };
}

/**
 * Edit own post
 */
export function updatePost(postId, userId, { title, content }) {
    const post = db.prepare('SELECT * FROM community_posts WHERE id = ?').get(postId);
    if (!post) throw new Error('Post not found');
    if (post.author_id !== userId) throw new Error('You can only edit your own posts');

    db.prepare(`
    UPDATE community_posts SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(title || post.title, content || post.content, postId);

    return { success: true, id: postId };
}

/**
 * Soft-delete own post
 */
export function deletePost(postId, userId) {
    const post = db.prepare('SELECT * FROM community_posts WHERE id = ?').get(postId);
    if (!post) throw new Error('Post not found');

    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userId);
    if (post.author_id !== userId && user?.role !== 'admin') {
        throw new Error('You can only delete your own posts');
    }

    db.prepare("UPDATE community_posts SET status = 'removed' WHERE id = ?").run(postId);
    return { success: true };
}

// ============================================
// COMMENTS
// ============================================

/**
 * Add comment or reply to a post
 */
export function addComment({ post_id, author_id, content, parent_comment_id }) {
    if (!post_id || !author_id || !content) {
        throw new Error('post_id, author_id, and content are required');
    }

    // Post must exist and be active
    const post = db.prepare("SELECT * FROM community_posts WHERE id = ? AND status = 'active'").get(post_id);
    if (!post) throw new Error('Post not found or not active');

    // Rate limit
    const today = new Date().toISOString().split('T')[0];
    const todayCount = db.prepare(
        "SELECT COUNT(*) as count FROM community_comments WHERE author_id = ? AND date(created_at) = ?"
    ).get(author_id, today);

    if (todayCount.count >= MAX_COMMENTS_PER_DAY) {
        throw new Error(`Daily comment limit reached (${MAX_COMMENTS_PER_DAY} comments/day)`);
    }

    const stmt = db.prepare(`
    INSERT INTO community_comments (post_id, author_id, parent_comment_id, content)
    VALUES (?, ?, ?, ?)
  `);

    const info = stmt.run(post_id, author_id, parent_comment_id || null, content);

    // Update comment count
    db.prepare('UPDATE community_posts SET comment_count = comment_count + 1 WHERE id = ?').run(post_id);

    // Notify post author (if different from commenter)
    if (post.author_id !== author_id) {
        const commenter = db.prepare('SELECT name, display_name FROM users WHERE id = ?').get(author_id);
        createNotification(post.author_id, 'comment_added', 'community',
            'New Comment',
            `${commenter?.display_name || commenter?.name} commented on your post "${post.title.substring(0, 50)}"`,
            `/community/post/${post_id}`
        );
    }

    // Notify parent comment author if this is a reply
    if (parent_comment_id) {
        const parentComment = db.prepare('SELECT author_id FROM community_comments WHERE id = ?').get(parent_comment_id);
        if (parentComment && parentComment.author_id !== author_id) {
            const commenter = db.prepare('SELECT name, display_name FROM users WHERE id = ?').get(author_id);
            createNotification(parentComment.author_id, 'reply_added', 'community',
                'New Reply',
                `${commenter?.display_name || commenter?.name} replied to your comment`,
                `/community/post/${post_id}`
            );
        }
    }

    return { id: info.lastInsertRowid, success: true };
}

// ============================================
// LIKES
// ============================================

/**
 * Toggle like on a post or comment
 */
export function toggleLike({ user_id, target_type, target_id }) {
    if (!user_id || !target_type || !target_id) {
        throw new Error('user_id, target_type, and target_id are required');
    }

    if (!['post', 'comment'].includes(target_type)) {
        throw new Error('target_type must be "post" or "comment"');
    }

    const existing = db.prepare(
        'SELECT id FROM community_likes WHERE user_id = ? AND target_type = ? AND target_id = ?'
    ).get(user_id, target_type, target_id);

    if (existing) {
        // Unlike
        db.prepare('DELETE FROM community_likes WHERE id = ?').run(existing.id);

        if (target_type === 'post') {
            db.prepare('UPDATE community_posts SET like_count = MAX(0, like_count - 1) WHERE id = ?').run(target_id);
        } else {
            db.prepare('UPDATE community_comments SET like_count = MAX(0, like_count - 1) WHERE id = ?').run(target_id);
        }

        return { liked: false, success: true };
    } else {
        // Like
        db.prepare(
            'INSERT INTO community_likes (user_id, target_type, target_id) VALUES (?, ?, ?)'
        ).run(user_id, target_type, target_id);

        if (target_type === 'post') {
            db.prepare('UPDATE community_posts SET like_count = like_count + 1 WHERE id = ?').run(target_id);
        } else {
            db.prepare('UPDATE community_comments SET like_count = like_count + 1 WHERE id = ?').run(target_id);
        }

        return { liked: true, success: true };
    }
}

// ============================================
// BOOKMARKS
// ============================================

export function toggleBookmark(userId, postId) {
    const existing = db.prepare(
        'SELECT id FROM community_bookmarks WHERE user_id = ? AND post_id = ?'
    ).get(userId, postId);

    if (existing) {
        db.prepare('DELETE FROM community_bookmarks WHERE id = ?').run(existing.id);
        return { bookmarked: false, success: true };
    } else {
        db.prepare('INSERT INTO community_bookmarks (user_id, post_id) VALUES (?, ?)').run(userId, postId);
        return { bookmarked: true, success: true };
    }
}

export function getBookmarks(userId) {
    return db.prepare(`
    SELECT 
      p.*,
      u.name as author_name,
      u.display_name as author_display_name,
      u.role as author_role,
      cc.name as category_name,
      cc.icon as category_icon
    FROM community_bookmarks cb
    JOIN community_posts p ON cb.post_id = p.id
    JOIN users u ON p.author_id = u.id
    JOIN community_categories cc ON p.category_id = cc.id
    WHERE cb.user_id = ? AND p.status = 'active'
    ORDER BY cb.created_at DESC
  `).all(userId);
}

// ============================================
// REPORTS
// ============================================

/**
 * Report a post or comment
 */
export function createReport({ reporter_id, target_type, target_id, reason, description }) {
    if (!reporter_id || !target_type || !target_id || !reason) {
        throw new Error('reporter_id, target_type, target_id, and reason are required');
    }

    const validReasons = ['misinformation', 'harassment', 'spam', 'inappropriate', 'other'];
    if (!validReasons.includes(reason)) {
        throw new Error(`Invalid reason. Must be one of: ${validReasons.join(', ')}`);
    }

    // Check if user already reported this
    const existing = db.prepare(
        'SELECT id FROM community_reports WHERE reporter_id = ? AND target_type = ? AND target_id = ?'
    ).get(reporter_id, target_type, target_id);

    if (existing) throw new Error('You have already reported this content');

    const stmt = db.prepare(`
    INSERT INTO community_reports (reporter_id, target_type, target_id, reason, description)
    VALUES (?, ?, ?, ?, ?)
  `);

    stmt.run(reporter_id, target_type, target_id, reason, description || null);

    // Check auto-flag threshold
    const reportCount = db.prepare(
        'SELECT COUNT(*) as count FROM community_reports WHERE target_type = ? AND target_id = ?'
    ).get(target_type, target_id).count;

    if (reportCount >= AUTO_HIDE_REPORT_THRESHOLD) {
        // Auto-hide content
        if (target_type === 'post') {
            db.prepare("UPDATE community_posts SET status = 'hidden' WHERE id = ?").run(target_id);
        } else {
            db.prepare("UPDATE community_comments SET status = 'hidden' WHERE id = ?").run(target_id);
        }
    } else if (reportCount >= AUTO_FLAG_REPORT_THRESHOLD) {
        // Auto-flag for review
        if (target_type === 'post') {
            db.prepare("UPDATE community_posts SET status = 'under_review' WHERE id = ? AND status = 'active'").run(target_id);
        }
    }

    return { success: true, report_count: reportCount };
}

// ============================================
// MODERATION
// ============================================

/**
 * Get moderation queue (admin/clinician only)
 */
export function getModerationQueue() {
    // Reported content
    const reports = db.prepare(`
    SELECT 
      r.*,
      reporter.name as reporter_name,
      CASE 
        WHEN r.target_type = 'post' THEN p.title
        WHEN r.target_type = 'comment' THEN c.content
      END as content_preview,
      CASE 
        WHEN r.target_type = 'post' THEN p.author_id
        WHEN r.target_type = 'comment' THEN c.author_id
      END as content_author_id,
      CASE 
        WHEN r.target_type = 'post' THEN pu.name
        WHEN r.target_type = 'comment' THEN cu.name
      END as content_author_name
    FROM community_reports r
    JOIN users reporter ON r.reporter_id = reporter.id
    LEFT JOIN community_posts p ON r.target_type = 'post' AND r.target_id = p.id
    LEFT JOIN users pu ON p.author_id = pu.id
    LEFT JOIN community_comments c ON r.target_type = 'comment' AND r.target_id = c.id
    LEFT JOIN users cu ON c.author_id = cu.id
    WHERE r.status = 'pending'
    ORDER BY r.created_at DESC
  `).all();

    // Posts under review (first-time posters + flagged)
    const underReview = db.prepare(`
    SELECT 
      p.*,
      u.name as author_name,
      u.role as author_role
    FROM community_posts p
    JOIN users u ON p.author_id = u.id
    WHERE p.status = 'under_review'
    ORDER BY p.created_at DESC
  `).all();

    return { reports, under_review: underReview };
}

/**
 * Resolve a report with an action
 */
export function resolveReport(reportId, reviewerId, action) {
    const validActions = ['none', 'content_hidden', 'user_warned', 'user_banned'];
    if (!validActions.includes(action)) {
        throw new Error(`Invalid action. Must be one of: ${validActions.join(', ')}`);
    }

    const report = db.prepare('SELECT * FROM community_reports WHERE id = ?').get(reportId);
    if (!report) throw new Error('Report not found');

    // Update report
    db.prepare(`
    UPDATE community_reports SET status = 'action_taken', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, action_taken = ?
    WHERE id = ?
  `).run(reviewerId, action, reportId);

    // Apply action
    if (action === 'content_hidden') {
        if (report.target_type === 'post') {
            db.prepare("UPDATE community_posts SET status = 'hidden' WHERE id = ?").run(report.target_id);
        } else {
            db.prepare("UPDATE community_comments SET status = 'hidden' WHERE id = ?").run(report.target_id);
        }
    } else if (action === 'user_banned' || action === 'user_warned') {
        // Get content author
        let authorId;
        if (report.target_type === 'post') {
            authorId = db.prepare('SELECT author_id FROM community_posts WHERE id = ?').get(report.target_id)?.author_id;
        } else {
            authorId = db.prepare('SELECT author_id FROM community_comments WHERE id = ?').get(report.target_id)?.author_id;
        }

        if (authorId) {
            if (action === 'user_banned') {
                db.prepare("UPDATE users SET account_status = 'banned' WHERE id = ?").run(authorId);
            } else {
                createNotification(authorId, 'warning', 'community',
                    '⚠️ Community Warning',
                    'Your recent post/comment was flagged for review. Please follow community guidelines.',
                    '/community'
                );
            }
        }
    }

    return { success: true, action };
}

/**
 * Verify a post as clinician-approved
 */
export function verifyPost(postId, clinicianId) {
    const clinician = db.prepare('SELECT role FROM users WHERE id = ?').get(clinicianId);
    if (!clinician || (clinician.role !== 'clinician' && clinician.role !== 'admin')) {
        throw new Error('Only clinicians can verify posts');
    }

    db.prepare('UPDATE community_posts SET is_verified = 1, verified_by = ? WHERE id = ?').run(clinicianId, postId);

    // Notify author
    const post = db.prepare('SELECT author_id, title FROM community_posts WHERE id = ?').get(postId);
    if (post) {
        createNotification(post.author_id, 'post_verified', 'community',
            '✅ Post Verified',
            `Your post "${post.title.substring(0, 50)}" has been verified by a clinician.`,
            `/community/post/${postId}`
        );
    }

    return { success: true };
}

/**
 * Approve an under-review post
 */
export function approvePost(postId, reviewerId) {
    db.prepare("UPDATE community_posts SET status = 'active' WHERE id = ? AND status = 'under_review'").run(postId);
    return { success: true };
}

// ============================================
// HELPERS
// ============================================

function checkWatchlistContent(text) {
    const lower = text.toLowerCase();
    return WATCHLIST_KEYWORDS.some(kw => lower.includes(kw));
}

function checkCrisisContent(text) {
    if (!text) return false;
    const lower = text.toLowerCase();
    return CRISIS_KEYWORDS.some(kw => lower.includes(kw));
}

function shouldShowDisclaimer(categoryId) {
    const medicalCategories = ['ask_clinician', 'sensory_tools', 'research_corner'];
    return medicalCategories.includes(categoryId);
}

function createNotification(userId, type, sourceModule, title, message, link) {
    try {
        db.prepare(`
      INSERT INTO notifications (user_id, type, source_module, title, message, link)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, type, sourceModule, title, message, link);
    } catch (e) {
        console.warn('Notification creation failed:', e.message);
    }
}

// Export constants for routes
export { MEDICAL_DISCLAIMER };
