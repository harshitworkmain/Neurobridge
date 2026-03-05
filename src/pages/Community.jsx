import React, { useState, useEffect } from 'react';
import {
    MessageSquare, Heart, Bookmark, Flag, Plus, X, Send, ChevronLeft,
    Loader, CheckCircle2, Shield, AlertTriangle, Users, Search,
    ThumbsUp, MessageCircle, BookmarkPlus, Phone, Star, Filter, Volume2
} from 'lucide-react';

import API from '../config/api.js';

const CRISIS_BANNER = {
    message: "If you or someone you know is in crisis, please call the National Helpline: 988 (US), 116 123 (UK), or your local emergency services. You're not alone. 💛",
};

const Community = () => {
    const [categories, setCategories] = useState([]);
    const [posts, setPosts] = useState([]);
    const [pagination, setPagination] = useState({});
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [selectedPost, setSelectedPost] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportTarget, setReportTarget] = useState(null);
    const [page, setPage] = useState(1);
    const [commentText, setCommentText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [disclaimer, setDisclaimer] = useState('');

    const [newPost, setNewPost] = useState({ category_id: '', title: '', content: '' });
    const [reportData, setReportData] = useState({ reason: 'misinformation', description: '' });
    const [postError, setPostError] = useState('');

    useEffect(() => {
        loadCategories();
    }, []);

    useEffect(() => {
        loadPosts();
    }, [selectedCategory, page]);

    const loadCategories = async () => {
        try {
            const res = await fetch(`${API}/community/categories`);
            if (res.ok) {
                const data = await res.json();
                setCategories(data.categories || []);
                setDisclaimer(data.disclaimer || '');
            }
        } catch (e) {
            console.error(e);
        }
    };

    const loadPosts = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page });
            if (selectedCategory) params.set('category', selectedCategory);
            const res = await fetch(`${API}/community/posts?${params}`);
            if (res.ok) {
                const data = await res.json();
                setPosts(data.posts || []);
                setPagination(data.pagination || {});
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const loadPost = async (postId) => {
        try {
            const res = await fetch(`${API}/community/posts/${postId}`);
            if (res.ok) {
                const data = await res.json();
                setSelectedPost(data.post);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleCreatePost = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setPostError('');
        try {
            const res = await fetch(`${API}/community/posts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newPost)
            });
            const data = await res.json();
            if (res.ok) {
                setShowCreateModal(false);
                setNewPost({ category_id: '', title: '', content: '' });
                if (data.status === 'under_review') {
                    alert('Your post has been submitted and is pending review. It will appear once approved.');
                }
                await loadPosts();
            } else {
                setPostError(data.error || 'Failed to create post. Please try again.');
            }
        } catch (e) {
            console.error(e);
            setPostError('Network error. Please check your connection and try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleLike = async (targetType, targetId) => {
        try {
            await fetch(`${API}/community/likes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target_type: targetType, target_id: targetId })
            });
            if (selectedPost) {
                await loadPost(selectedPost.id);
            } else {
                await loadPosts();
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleBookmark = async (postId) => {
        try {
            await fetch(`${API}/community/bookmarks/${postId}`, { method: 'POST' });
            if (selectedPost) {
                await loadPost(selectedPost.id);
            } else {
                await loadPosts();
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleComment = async (postId) => {
        if (!commentText.trim()) return;
        setSubmitting(true);
        try {
            await fetch(`${API}/community/posts/${postId}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: commentText })
            });
            setCommentText('');
            await loadPost(postId);
        } catch (e) {
            console.error(e);
        } finally {
            setSubmitting(false);
        }
    };

    const handleReport = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await fetch(`${API}/community/reports`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    target_type: reportTarget.type,
                    target_id: reportTarget.id,
                    reason: reportData.reason,
                    description: reportData.description
                })
            });
            setShowReportModal(false);
            setReportData({ reason: 'misinformation', description: '' });
            alert('Report submitted. Thank you for helping keep our community safe.');
        } catch (e) {
            console.error(e);
        } finally {
            setSubmitting(false);
        }
    };

    const timeAgo = (dateStr) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    };

    const getRoleBadge = (role) => {
        if (role === 'clinician') return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold">Clinician</span>;
        if (role === 'admin') return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 font-bold">Admin</span>;
        if (role === 'therapist') return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold">Therapist</span>;
        return null;
    };

    // ========== POST DETAIL VIEW ==========
    if (selectedPost) {
        return (
            <div className="space-y-6 animate-fade-in">
                <button
                    onClick={() => setSelectedPost(null)}
                    className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors"
                >
                    <ChevronLeft className="w-4 h-4" /> Back to Feed
                </button>

                {/* Crisis banner */}
                {selectedPost.has_crisis_content && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                            <Phone className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                            <p className="text-sm text-amber-800">{CRISIS_BANNER.message}</p>
                        </div>
                    </div>
                )}

                {/* Post */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-6">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-slate-400">{selectedPost.category_icon} {selectedPost.category_name}</span>
                            {selectedPost.is_verified ? (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center gap-0.5">
                                    <CheckCircle2 className="w-3 h-3" /> Verified
                                </span>
                            ) : null}
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900 mb-3">{selectedPost.title}</h1>
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 text-sm font-bold">
                                {(selectedPost.author_display || 'U')[0].toUpperCase()}
                            </div>
                            <div>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-sm font-semibold text-slate-800">{selectedPost.author_display}</span>
                                    {getRoleBadge(selectedPost.author_role)}
                                </div>
                                <span className="text-xs text-slate-400">{timeAgo(selectedPost.created_at)}</span>
                            </div>
                        </div>
                        <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{selectedPost.content}</p>

                        {/* Disclaimer */}
                        {selectedPost.disclaimer && (
                            <div className="mt-4 p-3 bg-blue-50 rounded-lg text-xs text-blue-700 flex items-start gap-2">
                                <Shield className="w-4 h-4 shrink-0 mt-0.5" />
                                {selectedPost.disclaimer}
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-4 mt-5 pt-4 border-t border-slate-100">
                            <button
                                onClick={() => handleLike('post', selectedPost.id)}
                                className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${selectedPost.user_liked ? 'text-rose-500' : 'text-slate-400 hover:text-rose-500'}`}
                            >
                                <Heart className={`w-4 h-4 ${selectedPost.user_liked ? 'fill-current' : ''}`} />
                                {selectedPost.like_count}
                            </button>
                            <span className="flex items-center gap-1.5 text-sm text-slate-400">
                                <MessageCircle className="w-4 h-4" />
                                {selectedPost.comment_count}
                            </span>
                            <button
                                onClick={() => handleBookmark(selectedPost.id)}
                                className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${selectedPost.user_bookmarked ? 'text-amber-500' : 'text-slate-400 hover:text-amber-500'}`}
                            >
                                <Bookmark className={`w-4 h-4 ${selectedPost.user_bookmarked ? 'fill-current' : ''}`} />
                                Save
                            </button>
                            <button
                                onClick={() => {
                                    if (window.speechSynthesis.speaking) {
                                        window.speechSynthesis.cancel();
                                    } else {
                                        const utterance = new SpeechSynthesisUtterance(
                                            `${selectedPost.title}. ${selectedPost.content}`
                                        );
                                        utterance.rate = 0.9;
                                        window.speechSynthesis.speak(utterance);
                                    }
                                }}
                                className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-primary-500 transition-colors"
                                title="Read the post aloud"
                            >
                                <Volume2 className="w-4 h-4" />
                                Read Aloud
                            </button>
                            <button
                                onClick={() => { setReportTarget({ type: 'post', id: selectedPost.id }); setShowReportModal(true); }}
                                className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-red-500 transition-colors ml-auto"
                            >
                                <Flag className="w-4 h-4" />
                                Report
                            </button>
                        </div>
                    </div>

                    {/* Comments */}
                    <div className="border-t border-slate-100">
                        <div className="p-5 pb-3">
                            <h3 className="text-sm font-bold text-slate-700">
                                Comments ({selectedPost.comments?.length || 0})
                            </h3>
                        </div>

                        {selectedPost.comments && selectedPost.comments.map(comment => (
                            <div key={comment.id} className="px-5 py-3 hover:bg-slate-50/50 transition-colors">
                                <div className="flex items-start gap-3">
                                    <div className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 text-xs font-bold shrink-0">
                                        {(comment.author_display || 'U')[0].toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 mb-0.5">
                                            <span className="text-sm font-semibold text-slate-800">{comment.author_display}</span>
                                            {getRoleBadge(comment.author_role)}
                                            <span className="text-xs text-slate-400">{timeAgo(comment.created_at)}</span>
                                        </div>
                                        <p className="text-sm text-slate-700">{comment.content}</p>
                                        <div className="flex items-center gap-3 mt-1">
                                            <button
                                                onClick={() => handleLike('comment', comment.id)}
                                                className={`flex items-center gap-1 text-xs transition-colors ${comment.user_liked ? 'text-rose-500' : 'text-slate-400 hover:text-rose-500'}`}
                                            >
                                                <Heart className={`w-3 h-3 ${comment.user_liked ? 'fill-current' : ''}`} />
                                                {comment.like_count > 0 && comment.like_count}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Comment Input */}
                        <div className="p-4 border-t border-slate-100">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={commentText}
                                    onChange={e => setCommentText(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleComment(selectedPost.id)}
                                    placeholder="Add a comment..."
                                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                />
                                <button
                                    onClick={() => handleComment(selectedPost.id)}
                                    disabled={!commentText.trim() || submitting}
                                    className="bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 text-white p-2.5 rounded-lg transition-colors"
                                >
                                    {submitting ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ========== FEED VIEW ==========
    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Community</h1>
                    <p className="text-slate-500 mt-1">Connect with families, share experiences, and learn together.</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-lg shadow-sm font-medium transition-colors flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    New Post
                </button>
            </div>

            {/* Category Pills */}
            <div className="flex flex-wrap gap-2">
                <button
                    onClick={() => { setSelectedCategory(null); setPage(1); }}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${!selectedCategory ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                        }`}
                >
                    All Topics
                </button>
                {categories.map(cat => (
                    <button
                        key={cat.id}
                        onClick={() => { setSelectedCategory(cat.id); setPage(1); }}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${selectedCategory === cat.id ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                            }`}
                    >
                        {cat.icon} {cat.name}
                        <span className="ml-1 text-xs opacity-60">({cat.post_count})</span>
                    </button>
                ))}
            </div>

            {/* Medical Disclaimer */}
            {disclaimer && (
                <div className="p-3 bg-blue-50 rounded-xl text-xs text-blue-700 flex items-start gap-2">
                    <Shield className="w-4 h-4 shrink-0 mt-0.5" />
                    {disclaimer}
                </div>
            )}

            {/* Posts Feed */}
            {loading ? (
                <div className="flex h-40 items-center justify-center">
                    <Loader className="animate-spin text-primary-600 w-8 h-8" />
                </div>
            ) : posts.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center">
                    <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-slate-700">No posts yet</h3>
                    <p className="text-slate-500 mt-1 mb-4">Be the first to share in this category!</p>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors inline-flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" /> Write a Post
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {posts.map(post => (
                        <div
                            key={post.id}
                            className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 hover:shadow-md transition-shadow cursor-pointer"
                            onClick={() => loadPost(post.id)}
                        >
                            {/* Crisis banner */}
                            {post.has_crisis_content && (
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3" onClick={e => e.stopPropagation()}>
                                    <div className="flex items-start gap-2">
                                        <Phone className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                        <p className="text-xs text-amber-800">{CRISIS_BANNER.message}</p>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs text-slate-400">{post.category_icon} {post.category_name}</span>
                                {post.is_pinned ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold">📌 Pinned</span> : null}
                                {post.is_verified ? (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center gap-0.5">
                                        <CheckCircle2 className="w-3 h-3" /> Verified
                                    </span>
                                ) : null}
                            </div>

                            <h3 className="text-lg font-bold text-slate-900 mb-1">{post.title}</h3>
                            <p className="text-sm text-slate-600 line-clamp-2 mb-3">{post.content}</p>

                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 text-[10px] font-bold">
                                        {(post.author_display || 'U')[0].toUpperCase()}
                                    </div>
                                    <span className="text-xs text-slate-500">
                                        <span className="font-medium text-slate-700">{post.author_display}</span>
                                        {' '}{getRoleBadge(post.author_role)}
                                        {' • '}{timeAgo(post.created_at)}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-slate-400" onClick={e => e.stopPropagation()}>
                                    <button
                                        onClick={() => handleLike('post', post.id)}
                                        className={`flex items-center gap-1 transition-colors ${post.user_liked ? 'text-rose-500' : 'hover:text-rose-500'}`}
                                    >
                                        <Heart className={`w-3.5 h-3.5 ${post.user_liked ? 'fill-current' : ''}`} />
                                        {post.like_count}
                                    </button>
                                    <span className="flex items-center gap-1">
                                        <MessageCircle className="w-3.5 h-3.5" />
                                        {post.comment_count}
                                    </span>
                                    <button
                                        onClick={() => handleBookmark(post.id)}
                                        className={`transition-colors ${post.user_bookmarked ? 'text-amber-500' : 'hover:text-amber-500'}`}
                                    >
                                        <Bookmark className={`w-3.5 h-3.5 ${post.user_bookmarked ? 'fill-current' : ''}`} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Pagination */}
                    {pagination.total_pages > 1 && (
                        <div className="flex items-center justify-center gap-2 pt-4">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page <= 1}
                                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-colors"
                            >
                                Previous
                            </button>
                            <span className="text-sm text-slate-500">
                                Page {pagination.page} of {pagination.total_pages}
                            </span>
                            <button
                                onClick={() => setPage(p => Math.min(pagination.total_pages, p + 1))}
                                disabled={page >= pagination.total_pages}
                                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-colors"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Create Post Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setShowCreateModal(false)}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-slate-900">Create Post</h3>
                            <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleCreatePost} className="p-5 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                                <select
                                    value={newPost.category_id}
                                    onChange={e => setNewPost({ ...newPost, category_id: e.target.value })}
                                    required
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                >
                                    <option value="">Select a category...</option>
                                    {categories.map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                                <input
                                    type="text"
                                    value={newPost.title}
                                    onChange={e => setNewPost({ ...newPost, title: e.target.value })}
                                    required
                                    maxLength={150}
                                    placeholder="What would you like to share?"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Content</label>
                                <textarea
                                    value={newPost.content}
                                    onChange={e => setNewPost({ ...newPost, content: e.target.value })}
                                    required
                                    rows={6}
                                    placeholder="Share your thoughts, questions, or experiences..."
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                                />
                            </div>
                            <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-500 flex items-start gap-2">
                                <Shield className="w-4 h-4 shrink-0 mt-0.5" />
                                Be kind, respectful, and avoid sharing personal medical details. Your first few posts will be reviewed before publishing.
                            </div>
                            {postError && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
                                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                    {postError}
                                </div>
                            )}
                            <button
                                type="submit"
                                disabled={submitting || !newPost.title || !newPost.content || !newPost.category_id}
                                className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 text-white py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                            >
                                {submitting ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                {submitting ? 'Posting...' : 'Publish Post'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Report Modal */}
            {showReportModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setShowReportModal(false)}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-slate-900">Report Content</h3>
                            <button onClick={() => setShowReportModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleReport} className="p-5 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Reason</label>
                                {['misinformation', 'harassment', 'spam', 'inappropriate', 'other'].map(r => (
                                    <label key={r} className="flex items-center gap-2 py-1.5 cursor-pointer">
                                        <input
                                            type="radio" name="reason"
                                            checked={reportData.reason === r}
                                            onChange={() => setReportData({ ...reportData, reason: r })}
                                            className="accent-primary-600"
                                        />
                                        <span className="text-sm text-slate-700 capitalize">{r}</span>
                                    </label>
                                ))}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Details (optional)</label>
                                <textarea
                                    value={reportData.description}
                                    onChange={e => setReportData({ ...reportData, description: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 h-20 resize-none"
                                    placeholder="Provide additional context..."
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                            >
                                {submitting ? <Loader className="w-4 h-4 animate-spin" /> : <Flag className="w-4 h-4" />}
                                {submitting ? 'Submitting...' : 'Submit Report'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Community;
