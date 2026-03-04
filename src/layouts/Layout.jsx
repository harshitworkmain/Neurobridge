import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Brain, Stethoscope, Activity, Users, Settings, Menu, X, FileText, Video, Gamepad2, Bell, Moon, Sun, Shield, Target } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { usePreferences } from '../contexts/PreferencesContext';

import API from '../config/api.js';

const Layout = ({ children }) => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
    const [unreadCount, setUnreadCount] = React.useState(0);
    const [showSettings, setShowSettings] = React.useState(false);
    const location = useLocation();
    const prefs = usePreferences();

    // Poll for notification count
    React.useEffect(() => {
        const loadCount = async () => {
            try {
                const res = await fetch(`${API}/notifications/unread-count`);
                if (res.ok) {
                    const data = await res.json();
                    setUnreadCount(data.unread_count || 0);
                }
            } catch (e) { /* ignore */ }
        };
        loadCount();
        const interval = setInterval(loadCount, 30000); // Poll every 30s
        return () => clearInterval(interval);
    }, []);

    const navItems = [
        { name: 'Dashboard', path: '/', icon: LayoutDashboard },
        { name: 'AI Screening', path: '/screening', icon: Brain },
        { name: 'Therapy', path: '/therapy', icon: Activity },
        { name: 'Games', path: '/games', icon: Gamepad2 },
        { name: 'Goals', path: '/goals', icon: Target },
        { name: 'Progress', path: '/progress', icon: Stethoscope },
        { name: 'Teleconsult', path: '/appointments', icon: Video },
        { name: 'Community', path: '/community', icon: Users },
    ];

    // Helper to merge classes
    function cn(...inputs) {
        return twMerge(clsx(inputs));
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            {/* Navigation */}
            <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex">
                            <Link to="/" className="flex-shrink-0 flex items-center gap-2">
                                <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                                    <Brain className="w-5 h-5 text-white" />
                                </div>
                                <span className="text-xl font-bold text-slate-900 tracking-tight">NeuroBridge AI</span>
                            </Link>
                        </div>

                        {/* Desktop Nav */}
                        <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                            {navItems.map((item) => {
                                const isActive = location.pathname === item.path;
                                return (
                                    <Link
                                        key={item.name}
                                        to={item.path}
                                        className={cn(
                                            "inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors duration-200",
                                            isActive
                                                ? "border-primary-500 text-slate-900"
                                                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
                                        )}
                                    >
                                        <item.icon className="w-4 h-4 mr-2" />
                                        {item.name}
                                    </Link>
                                );
                            })}
                        </div>

                        <div className="hidden sm:ml-6 sm:flex sm:items-center gap-2">
                            <Link to="/clinician" className="text-sm font-medium text-slate-500 hover:text-primary-600">
                                Clinician Mode
                            </Link>
                            <Link to="/reports" className="text-sm font-medium text-slate-500 hover:text-primary-600 ml-2">
                                <FileText className="w-4 h-4" />
                            </Link>
                            <div className="relative">
                                <button
                                    className="bg-primary-50 text-primary-700 p-2 rounded-full hover:bg-primary-100 transition-colors relative"
                                    title="Notifications"
                                >
                                    <Bell className="w-5 h-5" />
                                    {unreadCount > 0 && (
                                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-sm animate-pulse">
                                            {unreadCount > 9 ? '9+' : unreadCount}
                                        </span>
                                    )}
                                </button>
                            </div>
                            <div className="relative">
                                <button
                                    onClick={() => setShowSettings(s => !s)}
                                    className="bg-primary-50 text-primary-700 p-2 rounded-full hover:bg-primary-100 transition-colors"
                                    title="Settings"
                                >
                                    <Settings className="w-5 h-5" />
                                </button>
                                {showSettings && (
                                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-50">
                                        <div className="px-4 py-2 border-b border-slate-100">
                                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Display Settings</p>
                                        </div>
                                        <button
                                            onClick={() => { prefs?.toggleDarkMode(); }}
                                            className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors"
                                        >
                                            <span className="flex items-center gap-2 text-sm text-slate-700">
                                                {prefs?.preferences?.dark_mode ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-slate-400" />}
                                                Dark Mode
                                            </span>
                                            <div className={`w-8 h-5 rounded-full transition-colors ${prefs?.preferences?.dark_mode ? 'bg-primary-600' : 'bg-slate-300'} relative`}>
                                                <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-transform ${prefs?.preferences?.dark_mode ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                                            </div>
                                        </button>
                                        <button
                                            onClick={() => { prefs?.toggleSensoryMode(); }}
                                            className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors"
                                        >
                                            <span className="flex items-center gap-2 text-sm text-slate-700">
                                                <Shield className="w-4 h-4 text-teal-500" />
                                                Calm Mode
                                            </span>
                                            <div className={`w-8 h-5 rounded-full transition-colors ${prefs?.preferences?.sensory_mode ? 'bg-teal-500' : 'bg-slate-300'} relative`}>
                                                <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-transform ${prefs?.preferences?.sensory_mode ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                                            </div>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Mobile menu button */}
                        <div className="-mr-2 flex items-center sm:hidden">
                            <button
                                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                className="inline-flex items-center justify-center p-2 rounded-md text-slate-400 hover:text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500"
                            >
                                <span className="sr-only">Open main menu</span>
                                {isMobileMenuOpen ? (
                                    <X className="block h-6 w-6" aria-hidden="true" />
                                ) : (
                                    <Menu className="block h-6 w-6" aria-hidden="true" />
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile Menu */}
                {isMobileMenuOpen && (
                    <div className="sm:hidden bg-white border-b border-slate-200">
                        <div className="pt-2 pb-3 space-y-1">
                            {navItems.map((item) => {
                                const isActive = location.pathname === item.path;
                                return (
                                    <Link
                                        key={item.name}
                                        to={item.path}
                                        onClick={() => setIsMobileMenuOpen(false)}
                                        className={cn(
                                            "flex items-center pl-3 pr-4 py-2 border-l-4 text-base font-medium",
                                            isActive
                                                ? "bg-primary-50 border-primary-500 text-primary-700"
                                                : "border-transparent text-slate-500 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-700"
                                        )}
                                    >
                                        <item.icon className="w-5 h-5 mr-3" />
                                        {item.name}
                                    </Link>
                                );
                            })}
                            <Link
                                to="/clinician"
                                onClick={() => setIsMobileMenuOpen(false)}
                                className="flex items-center pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-slate-500 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-700"
                            >
                                <Users className="w-5 h-5 mr-3" />
                                Clinician View
                            </Link>
                        </div>
                    </div>
                )}
            </nav>

            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {children}
            </main>

            <footer className="bg-white border-t border-slate-200">
                <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex justify-between items-center text-sm text-slate-500">
                    <p>© 2024 NeuroBridge AI. Demo Platform.</p>
                    <div className="flex space-x-4">
                        <Link to="/consent" className="hover:text-slate-900">Privacy & Consent</Link>
                        <span>|</span>
                        <span>v5.0.0</span>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default Layout;
