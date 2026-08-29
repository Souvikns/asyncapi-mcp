import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import { ApiError, apiFetch } from '../api';
import { useAuth } from '../auth';

interface ApiKey {
    id: string;
    name: string;
    prefix: string;
    createdAt: string;
    revoked: boolean;
}

interface NewKey {
    id: string;
    name: string;
    token: string;
}

const MCP_URL = `${window.location.origin}/mcp`;

const configSnippet = (token: string | null) => `{
  "mcpServers": {
    "asyncapi": {
      "url": "${MCP_URL}",
      "headers": {
        "Authorization": "Bearer ${token ?? 'YOUR_API_KEY'}"
      }
    }
  }
}`;

const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

const Dashboard = () => {
    const { user } = useAuth();
    const [keys, setKeys] = useState<ApiKey[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [newKeyName, setNewKeyName] = useState('');
    const [creating, setCreating] = useState(false);
    const [newKey, setNewKey] = useState<NewKey | null>(null);
    const [copied, setCopied] = useState(false);

    const loadKeys = useCallback(async () => {
        try {
            const data = await apiFetch<{ keys: ApiKey[] }>('/api/keys');
            setKeys(data.keys);
            setError(null);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Failed to load API keys');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadKeys();
    }, [loadKeys]);

    const createKey = async (event: FormEvent) => {
        event.preventDefault();
        setCreating(true);
        setError(null);
        try {
            const data = await apiFetch<{ key: NewKey }>('/api/keys', {
                method: 'POST',
                body: JSON.stringify({ name: newKeyName }),
            });
            setNewKey(data.key);
            setNewKeyName('');
            await loadKeys();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Failed to create API key');
        } finally {
            setCreating(false);
        }
    };

    const revokeKey = async (id: string) => {
        try {
            await apiFetch(`/api/keys/${id}`, { method: 'DELETE' });
            await loadKeys();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Failed to revoke API key');
        }
    };

    const copyNewKey = async () => {
        if (!newKey) return;
        await navigator.clipboard.writeText(newKey.token);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const activeKeys = keys.filter(key => !key.revoked);
    const revokedKeys = keys.filter(key => key.revoked);

    return (
        <div className="dashboard">
            <div className="dashboard-header">
                <h1>Dashboard</h1>
                <p className="muted">
                    Signed in as <strong>{user?.email}</strong>
                </p>
            </div>

            {newKey && (
                <div className="new-key-banner">
                    <span className="badge-coral">New</span>
                    <h2>Your new API key</h2>
                    <p className="muted">
                        This is the only time the full key will be shown. Copy it now and store it somewhere safe.
                    </p>
                    <div className="new-key-row">
                        <code className="new-key-token">{newKey.token}</code>
                        <button type="button" className="btn btn-primary btn-sm" onClick={copyNewKey}>
                            {copied ? 'Copied!' : 'Copy'}
                        </button>
                    </div>
                </div>
            )}

            <section className="panel">
                <h2>Create a key</h2>
                <form onSubmit={createKey} className="create-key-form">
                    <input
                        type="text"
                        value={newKeyName}
                        onChange={e => setNewKeyName(e.target.value)}
                        placeholder="Key name (e.g. Laptop, Workstation)"
                        maxLength={100}
                    />
                    <button type="submit" className="btn btn-primary" disabled={creating}>
                        {creating ? 'Creating…' : 'Create API key'}
                    </button>
                </form>
                {error && <p className="form-error">{error}</p>}
            </section>

            <section className="panel">
                <h2>Your API keys</h2>
                {loading ? (
                    <p className="muted">Loading…</p>
                ) : activeKeys.length === 0 && revokedKeys.length === 0 ? (
                    <p className="muted">No API keys yet. Create one above to connect your MCP client.</p>
                ) : (
                    <table className="keys-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Key</th>
                                <th>Created</th>
                                <th>Status</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {[...activeKeys, ...revokedKeys].map(key => (
                                <tr key={key.id} className={key.revoked ? 'key-revoked' : ''}>
                                    <td>{key.name}</td>
                                    <td>
                                        <code>{key.prefix}…</code>
                                    </td>
                                    <td>{formatDate(key.createdAt)}</td>
                                    <td>
                                        <span className="key-status">
                                            <span className="status-dot" />
                                            {key.revoked ? 'Revoked' : 'Active'}
                                        </span>
                                    </td>
                                    <td className="keys-actions">
                                        {!key.revoked && (
                                            <button
                                                type="button"
                                                className="btn btn-danger btn-sm"
                                                onClick={() => revokeKey(key.id)}
                                            >
                                                Revoke
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </section>

            <section className="panel">
                <h2>Connect your MCP client</h2>
                <p className="muted">
                    Add this to your MCP client configuration. Use{' '}
                    {newKey ? 'your new key below — it is already filled in.' : 'any active key in place of YOUR_API_KEY.'}
                </p>
                <div className="code-block">
                    <pre>
                        <code>{configSnippet(newKey?.token ?? null)}</code>
                    </pre>
                </div>
                <p className="muted">
                    Using a client that cannot send headers (like Claude Desktop)? Use{' '}
                    <code>mcp-remote</code> instead:
                </p>
                <div className="code-block">
                    <pre>
                        <code>{`{
  "mcpServers": {
    "asyncapi": {
      "command": "npx",
      "args": [
        "-y", "mcp-remote", "${MCP_URL}",
        "--header", "Authorization: Bearer ${newKey?.token ?? 'YOUR_API_KEY'}"
      ]
    }
  }
}`}</code>
                    </pre>
                </div>
            </section>
        </div>
    );
};

export default Dashboard;
