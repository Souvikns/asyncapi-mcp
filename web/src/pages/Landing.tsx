import { useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../auth';

const MCP_URL = `${window.location.origin}/mcp`;

const CONFIG_SNIPPET = `{
  "mcpServers": {
    "asyncapi": {
      "url": "${MCP_URL}",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}`;

const TOOLS = [
    {
        name: 'search_asyncapi_spec',
        description: 'Search the specification by keyword and get matching snippets back.',
    },
    {
        name: 'get_asyncapi_spec_section',
        description: 'Retrieve any section by heading or slug — "Info Object", "channels", you name it.',
    },
    {
        name: 'validate_asyncapi_spec',
        description: 'Validate raw AsyncAPI YAML or JSON and get detailed validation errors.',
    },
    {
        name: 'list_asyncapi_spec_versions',
        description: 'List all stable spec versions available as GitHub tags.',
    },
    {
        name: 'get_asyncapi_spec_metadata',
        description: 'Get version, source, cache, and size metadata for any spec version.',
    },
];

const FEATURES = [
    {
        title: 'Version-aware',
        description: 'Query any released spec version, or default to the latest from master.',
    },
    {
        title: 'Spec resources',
        description: 'Expose the full spec as MCP resources: asyncapi://spec/latest and asyncapi://spec/{version}.',
    },
    {
        title: 'Fast by default',
        description: 'ETag/Last-Modified HTTP caching with a 10-minute TTL on tag lookups.',
    },
    {
        title: 'Works everywhere',
        description: 'Claude Desktop, Cursor, VS Code Copilot, Windsurf, Cline, OpenCode, Zed — any MCP client.',
    },
];

const CopyButton = ({ text }: { text: string }) => {
    const [copied, setCopied] = useState(false);

    const copy = async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <button type="button" className="btn btn-on-dark btn-sm copy-btn" onClick={copy}>
            {copied ? 'Copied!' : 'Copy'}
        </button>
    );
};

const CodeWindow = ({ title, snippet }: { title: string; snippet: string }) => (
    <div className="code-block">
        <div className="code-window-bar">
            <span className="code-window-dot" />
            <span className="code-window-dot" />
            <span className="code-window-dot" />
            <span className="code-window-title">{title}</span>
        </div>
        <CopyButton text={snippet} />
        <pre>
            <code>{snippet}</code>
        </pre>
    </div>
);

const Landing = () => {
    const { user } = useAuth();

    return (
        <>
            <section className="hero">
                <div className="hero-grid">
                    <div className="hero-copy">
                        <p className="hero-eyebrow">Model Context Protocol Server</p>
                        <h1>The AsyncAPI specification, inside your AI assistant.</h1>
                        <p className="hero-sub">
                            Search, explore, and validate any version of the AsyncAPI spec directly from your coding
                            tool. No more tab-switching to read docs.
                        </p>
                        <div className="hero-actions">
                            {user ? (
                                <Link to="/dashboard" className="btn btn-primary">
                                    Go to your dashboard
                                </Link>
                            ) : (
                                <>
                                    <Link to="/signup" className="btn btn-primary">
                                        Get your API key
                                    </Link>
                                    <Link to="/login" className="btn btn-ghost">
                                        Log in
                                    </Link>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="hero-aside">
                        <CodeWindow title="claude_desktop_config.json" snippet={CONFIG_SNIPPET} />
                    </div>
                </div>
            </section>

            <section className="section">
                <div className="section-head">
                    <h2>What your assistant can do</h2>
                    <p className="section-sub">
                        Five tools and two resources give your AI full access to the AsyncAPI specification.
                    </p>
                </div>
                <div className="card-grid">
                    {TOOLS.map(tool => (
                        <div key={tool.name} className="card">
                            <code className="card-code">{tool.name}</code>
                            <p>{tool.description}</p>
                        </div>
                    ))}
                    <div className="card">
                        <code className="card-code">asyncapi://spec/&#123;version&#125;</code>
                        <p>The full spec served as MCP resources — latest or any tagged release.</p>
                    </div>
                </div>
            </section>

            <section className="band-soft">
                <div className="section">
                    <div className="section-head">
                        <h2>Built for real workflows</h2>
                        <p className="section-sub">A small server that does one thing well: the spec, at your fingertips.</p>
                    </div>
                    <div className="card-grid">
                        {FEATURES.map(feature => (
                            <div key={feature.title} className="card-outline">
                                <h3>{feature.title}</h3>
                                <p>{feature.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="section">
                <div className="section-head">
                    <h2>Up and running in a minute</h2>
                    <p className="section-sub">Create an API key, then add this to your MCP client configuration.</p>
                </div>
                <div className="setup-inner">
                    <div className="steps">
                        <div className="step">
                            <span className="step-number">1</span>
                            <div>
                                <h3>Create an account</h3>
                                <p className="muted">
                                    Sign up with your email and generate an API key in the dashboard.
                                </p>
                            </div>
                        </div>
                        <div className="step">
                            <span className="step-number">2</span>
                            <div>
                                <h3>Add the config</h3>
                                <p className="muted">Paste this into your MCP client settings and replace the key.</p>
                            </div>
                        </div>
                    </div>
                    <CodeWindow title="mcpServers" snippet={CONFIG_SNIPPET} />
                </div>
                <p className="muted ask-examples">
                    Then ask things like: "What does the AsyncAPI spec say about server objects?" · "Search the spec for
                    'channels'" · "Validate this AsyncAPI document"
                </p>
            </section>

            <section className="section">
                <div className="cta-band-coral">
                    <h2>Start using it today</h2>
                    <p>Free, open source, and ready when you are.</p>
                    {user ? (
                        <Link to="/dashboard" className="btn btn-on-coral">
                            Go to your dashboard
                        </Link>
                    ) : (
                        <Link to="/signup" className="btn btn-on-coral">
                            Create your API key
                        </Link>
                    )}
                </div>
            </section>
        </>
    );
};

export default Landing;
