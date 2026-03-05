import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Brain, Stethoscope, Activity, Users, Settings, Menu, X, FileText, Video, Gamepad2, Bell, Moon, Sun, Shield, Target, ChevronLeft, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { usePreferences } from '../contexts/PreferencesContext';

import API from '../config/api.js';

const Layout = ({ children }) => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
    const [unreadCount, setUnreadCount] = React.useState(0);
    const [showSettings, setShowSettings] = React.useState(false);
    const location = useLocation();
    const prefs = usePreferences();

    React.useEffect(() => {
        const loadCount = async () => {
            try {
                const res = await fetch(`${API}/notifications/unread-count`);
                if (res.ok) {
                    const data = await res.json();
                    setUnreadCount(data.unread_count || 0);
                }
            } catch { /* ignore notification errors */ }
        };
        loadCount();
        const interval = setInterval(loadCount, 30000);
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

    function cn(...inputs) {
        return twMerge(clsx(inputs));
    }

    return (
        <div className="min-h-screen bg-slate-50 flex font-sans">
            {/* Left Sidebar - Desktop */}
            <aside className={cn(
                "hidden lg:flex flex-col bg-white border-r border-slate-200 sticky top-0 h-screen transition-all duration-300 z-40",
                sidebarCollapsed ? "w-20" : "w-64"
            )}>
                {/* Logo */}
                <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100">
                    <Link to="/" className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center shrink-0">
                            <Brain className="w-5 h-5 text-white" />
                        </div>
                        {!sidebarCollapsed && (
                            <span className="text-lg font-bold text-slate-900 tracking-tight">NeuroBridge</span>
                        )}
                    </Link>
                    <button
                        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                        title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                        {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                    </button>
                </div>

                {/* Navigation Links */}
                <nav className="flex-1 py-4 overflow-y-auto">
                    <ul className="space-y-1 px-3">
                        {navItems.map((item) => {
                            const isActive = location.pathname === item.path;
                            return (
                                <li key={item.name}>
                                    <Link
                                        to={item.path}
                                        className={cn(
                                            "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-200",
                                            isActive
                                                ? "bg-primary-50 text-primary-700 font-medium"
                                                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                        )}
                                        title={sidebarCollapsed ? item.name : undefined}
                                    >
                                        <item.icon className={cn("w-5 h-5 shrink-0", isActive ? "text-primary-600" : "text-slate-400")} />
                                        {!sidebarCollapsed && <span>{item.name}</span>}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </nav>

                {/* Secondary Links */}
                <div className="border-t border-slate-100 py-4 px-3">
                    <Link
                        to="/clinician"
                        className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors",
                            sidebarCollapsed && "justify-center"
                        )}
                        title={sidebarCollapsed ? "Clinician Mode" : undefined}
                    >
                        <Stethoscope className="w-5 h-5 text-slate-400 shrink-0" />
                        {!sidebarCollapsed && <span>Clinician Mode</span>}
                    </Link>
                    <Link
                        to="/reports"
                        className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors",
                            sidebarCollapsed && "justify-center"
                        )}
                        title={sidebarCollapsed ? "Reports" : undefined}
                    >
                        <FileText className="w-5 h-5 text-slate-400 shrink-0" />
                        {!sidebarCollapsed && <span>Reports</span>}
                    </Link>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Top Header */}
                <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
                    <div className="h-16 flex items-center justify-between px-4 lg:px-6">
                        {/* Mobile menu button + Logo on mobile */}
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-slate-500 hover:bg-slate-100"
                            >
                                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                            </button>
                            <Link to="/" className="lg:hidden flex items-center gap-2">
                                <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                                    <Brain className="w-5 h-5 text-white" />
                                </div>
                                <span className="text-lg font-bold text-slate-900">NeuroBridge</span>
                            </Link>
                        </div>

                        {/* Right side - Notifications & Settings */}
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <button
                                    className="bg-primary-50 text-primary-700 p-2 rounded-full hover:bg-primary-100 transition-colors relative"
                                    title="Notifications"
                                >
                                    <Bell className="w-5 h-5" />
                                    {unreadCount > 0 && (
                                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-sm">
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
                    </div>
                </header>

                {/* Mobile Menu Overlay */}
                {isMobileMenuOpen && (
                    <div className="lg:hidden fixed inset-0 z-50 bg-slate-900/50" onClick={() => setIsMobileMenuOpen(false)}>
                        <div className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-xl" onClick={e => e.stopPropagation()}>
                            <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                                        <Brain className="w-5 h-5 text-white" />
                                    </div>
                                    <span className="text-lg font-bold text-slate-900">NeuroBridge</span>
                                </div>
                                <button
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="p-2 rounded-lg text-slate-400 hover:text-slate-600"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <nav className="py-4">
                                <ul className="space-y-1 px-3">
                                    {navItems.map((item) => {
                                        const isActive = location.pathname === item.path;
                                        return (
                                            <li key={item.name}>
                                                <Link
                                                    to={item.path}
                                                    onClick={() => setIsMobileMenuOpen(false)}
                                                    className={cn(
                                                        "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                                                        isActive
                                                            ? "bg-primary-50 text-primary-700 font-medium"
                                                            : "text-slate-600 hover:bg-slate-50"
                                                    )}
                                                >
                                                    <item.icon className="w-5 h-5" />
                                                    <span>{item.name}</span>
                                                </Link>
                                            </li>
                                        );
                                    })}
                                </ul>
                                <div className="border-t border-slate-100 mt-4 pt-4 px-3">
                                    <Link
                                        to="/clinician"
                                        onClick={() => setIsMobileMenuOpen(false)}
                                        className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-600 hover:bg-slate-50"
                                    >
                                        <Stethoscope className="w-5 h-5" />
                                        <span>Clinician Mode</span>
                                    </Link>
                                    <Link
                                        to="/reports"
                                        onClick={() => setIsMobileMenuOpen(false)}
                                        className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-600 hover:bg-slate-50"
                                    >
                                        <FileText className="w-5 h-5" />
                                        <span>Reports</span>
                                    </Link>
                                </div>
                            </nav>
                        </div>
                    </div>
                )}

                {/* Main Content */}
                <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-6 py-8">
                    {children}
                </main>

                {/* Footer */}
                <footer className="bg-white border-t border-slate-200">
                    <div className="max-w-7xl mx-auto py-6 px-4 lg:px-6 flex justify-between items-center text-sm text-slate-500">
                        <p>© 2024 NeuroBridge AI. Demo Platform.</p>
                        <div className="flex space-x-4">
                            <Link to="/consent" className="hover:text-slate-900">Privacy & Consent</Link>
                            <span>|</span>
                            <span>v5.0.0</span>
                        </div>
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default Layout;
