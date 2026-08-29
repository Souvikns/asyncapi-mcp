import { useState } from 'react';

const MCP_URL = `${window.location.origin}/mcp`;

const CONFIG_SNIPPET = `{
  "mcpServers": {
    "asyncapi": {
      "url": "${MCP_URL}"
    }
  }
}`;

const PLUGIN_SNIPPET = `claude plugin marketplace add Souvikns/asyncapi-mcp
/plugin install asyncapi-mcp@asyncapi-mcp`;

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
        title: 'No signup',
        description: 'No account, no API key. Point your client at the server and go.',
    },
    {
        title: 'Version-aware',
        description: 'Query any released spec version, or default to the latest from master.',
    },
    {
        title: 'Spec resources',
        description: 'Expose the full spec as MCP resources: asyncapi://spec/latest and asyncapi://spec/{version}.',
    },
    {
        title: 'Works everywhere',
        description:
            'Claude Code, Claude Desktop, Cursor, VS Code Copilot, Windsurf, Cline, OpenCode, Zed — any MCP client.',
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

const Landing = () => (
    <>
        <section className="hero">
            <div className="hero-grid">
                <div className="hero-copy">
                    <p className="hero-eyebrow">Model Context Protocol Server</p>
                    <h1>The AsyncAPI specification, inside your AI assistant.</h1>
                    <p className="hero-sub">
                        Search, explore, and validate any version of the AsyncAPI spec directly from your coding
                        tool. No signup, no API key — just point your client at the server.
                    </p>
                    <div className="hero-actions">
                        <a href="#setup" className="btn btn-primary">
                            Get started
                        </a>
                        <a
                            href="https://github.com/Souvikns/asyncapi-mcp"
                            className="btn btn-ghost"
                            target="_blank"
                            rel="noreferrer"
                        >
                            View on GitHub
                        </a>
                    </div>
                </div>
                <div className="hero-aside">
                    <CodeWindow title="mcpServers" snippet={CONFIG_SNIPPET} />
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
                    <p className="section-sub">
                        A small server that does one thing well: the spec, at your fingertips.
                    </p>
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

        <section className="section" id="setup">
            <div className="section-head">
                <h2>Up and running in a minute</h2>
                <p className="section-sub">Install it as a plugin, or paste the config into any MCP client.</p>
            </div>
            <div className="setup-inner">
                <div className="steps">
                    <div className="step">
                        <span className="step-number">1</span>
                        <div>
                            <h3>Using Claude Code</h3>
                            <p className="muted">Add the marketplace once, then install the plugin.</p>
                        </div>
                    </div>
                    <div className="step">
                        <span className="step-number">2</span>
                        <div>
                            <h3>Any other MCP client</h3>
                            <p className="muted">Paste this into your client's server configuration.</p>
                        </div>
                    </div>
                </div>
                <CodeWindow title="Claude Code" snippet={PLUGIN_SNIPPET} />
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
                <a
                    href="https://github.com/Souvikns/asyncapi-mcp"
                    className="btn btn-on-coral"
                    target="_blank"
                    rel="noreferrer"
                >
                    View on GitHub
                </a>
            </div>
        </section>
    </>
);

export default Landing;
