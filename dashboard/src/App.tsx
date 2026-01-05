import { useState, useEffect, useCallback } from 'react';
import { useAgent } from 'agents/react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { LoginPage } from './components/LoginPage';
import { Toast } from './components/Toast';
import type { User, DashboardState, Settings } from './types';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [dashboardState, setDashboardState] = useState<DashboardState | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);

  // Check authentication first
  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/me', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setUser(data.data);
          return data.data;
        }
      }
    } catch (e) {
      console.error('Auth check failed:', e);
    } finally {
      setLoading(false);
    }
    return null;
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Connect to DashboardAgent via WebSocket using Agents SDK
  // The agent name is the user's email (kebab-case class name is 'dashboard-agent')
  const agent = useAgent<DashboardState>({
    agent: 'dashboard-agent',
    // Use user email as the agent instance name, or 'anonymous' if not logged in
    name: user?.email || 'anonymous',
    // Called whenever the agent's state is updated (from server or any client)
    onStateUpdate: (state, source) => {
      console.log('[App] State update from:', source);
      setDashboardState(state);
    },
    onOpen: () => {
      console.log('[App] WebSocket connected');
      // Load settings via RPC when connected
      loadSettings();
    },
    onClose: () => {
      console.log('[App] WebSocket disconnected');
    },
    onError: (error) => {
      console.error('[App] WebSocket error:', error);
    },
  });

  // Load settings via RPC
  const loadSettings = useCallback(async () => {
    if (!agent || agent.readyState !== WebSocket.OPEN) return;
    
    try {
      const result = await agent.call<{ success: boolean; data?: Settings; error?: string }>('getSettings');
      if (result.success && result.data) {
        setSettings(result.data);
      }
    } catch (e) {
      console.error('[App] Failed to load settings:', e);
    }
  }, [agent]);

  // Delete conversation via RPC
  const handleDeleteConversation = useCallback(async (id: string) => {
    if (!agent || agent.readyState !== WebSocket.OPEN) return false;
    
    try {
      const result = await agent.call<{ success: boolean; error?: string }>('deleteConversation', [id]);
      if (result.success) {
        showToast('Conversation deleted');
        return true;
      } else {
        showToast(result.error || 'Failed to delete');
        return false;
      }
    } catch (e) {
      console.error('[App] Delete failed:', e);
      showToast('Failed to delete');
      return false;
    }
  }, [agent]);

  // Get conversation details via RPC
  const handleGetConversation = useCallback(async (id: string) => {
    if (!agent || agent.readyState !== WebSocket.OPEN) return null;
    
    try {
      const result = await agent.call<{ success: boolean; data?: any; error?: string }>('getConversation', [id]);
      if (result.success && result.data) {
        return result.data;
      }
    } catch (e) {
      console.error('[App] Get conversation failed:', e);
    }
    return null;
  }, [agent]);

  // Save settings via RPC
  const handleSaveSettings = useCallback(async (newSettings: Settings) => {
    if (!agent || agent.readyState !== WebSocket.OPEN) return false;
    
    try {
      const result = await agent.call<{ success: boolean; error?: string }>('updateSettings', [newSettings]);
      if (result.success) {
        setSettings(newSettings);
        showToast('Settings saved');
        return true;
      } else {
        showToast(result.error || 'Failed to save');
        return false;
      }
    } catch (e) {
      console.error('[App] Save settings failed:', e);
      showToast('Failed to save settings');
      return false;
    }
  }, [agent]);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2000);
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="app">
      <Sidebar />
      <Dashboard
        user={user}
        state={dashboardState}
        settings={settings}
        onDeleteConversation={handleDeleteConversation}
        onGetConversation={handleGetConversation}
        onSaveSettings={handleSaveSettings}
        showToast={showToast}
      />
      {toast && <Toast message={toast} />}
    </div>
  );
}

export default App;
