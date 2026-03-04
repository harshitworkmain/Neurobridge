import React, { createContext, useContext, useState, useEffect } from 'react';
import { setMuted as setAudioMuted } from '../utils/audioCues';

import API from '../config/api.js';

const PreferencesContext = createContext(null);

export const usePreferences = () => useContext(PreferencesContext);

// Age-adaptive UI tiers (C1)
function getAgeTier(ageString) {
    if (!ageString) return 'default';
    const match = ageString.match(/(\d+)/);
    if (!match) return 'default';
    const age = parseInt(match[1]);
    if (age <= 6) return 'child';   // Large fonts, big buttons, more spacing
    if (age <= 12) return 'teen';   // Medium sizing
    return 'default';               // Standard sizing
}

export const PreferencesProvider = ({ children }) => {
    const [preferences, setPreferences] = useState({
        sensory_mode: false,
        dark_mode: false,
        onboarding_completed: false
    });
    const [loaded, setLoaded] = useState(false);
    const [ageTier, setAgeTier] = useState('default');

    useEffect(() => {
        loadPreferences();
        loadUserAge();
    }, []);

    // Apply dark mode class to document
    useEffect(() => {
        if (preferences.dark_mode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [preferences.dark_mode]);

    // Apply sensory mode class + mute audio cues
    useEffect(() => {
        if (preferences.sensory_mode) {
            document.documentElement.classList.add('sensory-safe');
            setAudioMuted(true);
        } else {
            document.documentElement.classList.remove('sensory-safe');
            setAudioMuted(false);
        }
    }, [preferences.sensory_mode]);

    // Apply age-adaptive class
    useEffect(() => {
        document.documentElement.classList.remove('age-child', 'age-teen');
        if (ageTier === 'child') document.documentElement.classList.add('age-child');
        else if (ageTier === 'teen') document.documentElement.classList.add('age-teen');
    }, [ageTier]);

    const loadUserAge = async () => {
        try {
            const res = await fetch(`${API}/users/1`);
            if (res.ok) {
                const data = await res.json();
                const tier = getAgeTier(data.user?.age_string || data.age_string || '');
                setAgeTier(tier);
            }
        } catch (e) {
            // ignore; default tier used
        }
    };

    const loadPreferences = async () => {
        try {
            const res = await fetch(`${API}/preferences`);
            if (res.ok) {
                const data = await res.json();
                setPreferences(data.preferences || {});
            }
        } catch (e) {
            // Use localStorage fallback
            const stored = localStorage.getItem('neurobridge_prefs');
            if (stored) setPreferences(JSON.parse(stored));
        } finally {
            setLoaded(true);
        }
    };

    const updatePreference = async (key, value) => {
        const newPrefs = { ...preferences, [key]: value };
        setPreferences(newPrefs);
        localStorage.setItem('neurobridge_prefs', JSON.stringify(newPrefs));

        try {
            await fetch(`${API}/preferences`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [key]: value })
            });
        } catch (e) {
            console.error('Preference update error:', e);
        }
    };

    const toggleDarkMode = () => updatePreference('dark_mode', !preferences.dark_mode);
    const toggleSensoryMode = () => updatePreference('sensory_mode', !preferences.sensory_mode);
    const completeOnboarding = () => updatePreference('onboarding_completed', true);

    return (
        <PreferencesContext.Provider value={{
            preferences,
            loaded,
            ageTier,
            toggleDarkMode,
            toggleSensoryMode,
            completeOnboarding,
            updatePreference
        }}>
            {children}
        </PreferencesContext.Provider>
    );
};

