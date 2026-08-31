import { useState, type CSSProperties } from 'react';

const MCP_URL = `${window.location.origin}/mcp`;

const CONFIG_SNIPPET = `{
  "mcpServers": {
    "asyncapi": {
      "url": "${MCP_URL}"
    }
  }
}`;

const PLUGIN_MARKETPLACE_SNIPPET = `claude plugin marketplace add Souvikns/asyncapi-mcp`;
const PLUGIN_INSTALL_SNIPPET = `/plugin install asyncapi-mcp@asyncapi-mcp`;

/** Numbered to match the leader-line callouts in the Fig. 1 diagram above. */
const TOOLS = [
    {
        num: '01',
        short: 'search',
        name: 'search_asyncapi_spec',
        description: 'Search the specification by keyword and get matching snippets back.',
    },
    {
        num: '02',
        short: 'section',
        name: 'get_asyncapi_spec_section',
        description: 'Retrieve any section by heading or slug — "Info Object", "channels", you name it.',
    },
    {
        num: '03',
        short: 'validate',
        name: 'validate_asyncapi_spec',
        description: 'Validate raw AsyncAPI YAML or JSON and get detailed validation errors.',
    },
    {
        num: '04',
        short: 'versions',
        name: 'list_asyncapi_spec_versions',
        description: 'List all stable spec versions available as GitHub tags.',
    },
    {
        num: '05',
        short: 'metadata',
        name: 'get_asyncapi_spec_metadata',
        description: 'Get version, source, cache, and size metadata for any spec version.',
    },
    {
        num: '06',
        short: 'resource',
        name: 'asyncapi://spec/{version}',
        description: 'The full spec served as an MCP resource — latest, or any tagged release.',
    },
];

const FEATURES = [
    {
        term: 'No signup',
        description: 'No account, no API key. Point your client at the server and go.',
    },
    {
        term: 'Version-aware',
        description: 'Query any released spec version, or default to the latest from master.',
    },
    {
        term: 'Spec resources',
        description: 'Expose the full spec as MCP resources: asyncapi://spec/latest and asyncapi://spec/{version}.',
    },
    {
        term: 'Works everywhere',
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
        <button type="button" className="btn btn-on-panel btn-sm copy-btn" onClick={copy}>
            {copied ? 'Copied' : 'Copy'}
        </button>
    );
};

const Listing = ({
    tag,
    title,
    snippet,
}: {
    tag: string;
    title: string;
    snippet: string;
}) => (
    <div className="listing">
        <div className="listing-bar">
            <span className="listing-tag">{tag}</span>
            <span className="listing-title">{title}</span>
            <CopyButton text={snippet} />
        </div>
        <pre>
            <code>{snippet}</code>
        </pre>
    </div>
);

/**
 * Fig. 1 — the MCP server as a rail between the spec source and the assistant,
 * with a query packet in transit and six numbered leader-line callouts, one
 * per tool/resource. Coordinates are hand-placed against a 720×172 viewBox.
 */
const FigureOne = () => {
    const railStart = 46;
    const railEnd = 674;
    const railY = 86;
    const count = TOOLS.length;
    const span = railEnd - railStart;
    const nodeX = (i: number) => railStart + (span / (count - 1)) * i;

    return (
        <svg
            className="fig-diagram"
            viewBox="0 0 720 172"
            role="img"
            aria-label="Diagram of the MCP server sitting between the AsyncAPI specification and an AI assistant, with six numbered tools and resources along the channel."
        >
            <line x1={railStart} y1={railY} x2={railEnd} y2={railY} className="fig-rail" />

            {/* Endpoints */}
            <g>
                <rect x={4} y={railY - 9} width={18} height={18} className="fig-endpoint" />
                <text x={13} y={railY + 34} textAnchor="middle" className="fig-endpoint-label">
                    SPEC
                </text>
            </g>
            <g>
                <rect x={698} y={railY - 9} width={18} height={18} className="fig-endpoint" />
                <text x={707} y={railY + 34} textAnchor="middle" className="fig-endpoint-label">
                    ASSISTANT
                </text>
            </g>

            {/* Travelling query packet */}
            <rect
                x={railStart - 4}
                y={railY - 5}
                width={10}
                height={10}
                className="fig-packet"
                style={{ '--fig-travel-x': `${railEnd - railStart}px` } as CSSProperties}
            />

            {TOOLS.map((tool, i) => {
                const x = nodeX(i);
                const up = i % 2 === 0;
                const leaderY2 = up ? 50 : 122;
                const textY = up ? 38 : 140;
                const numY = up ? 24 : 154;

                return (
                    <g key={tool.name}>
                        <line x1={x} y1={railY} x2={x} y2={leaderY2} className="fig-leader" />
                        <circle cx={x} cy={railY} r={3.5} className="fig-node" />
                        <text x={x} y={numY} textAnchor="middle" className="fig-numeral">
                            {tool.num}
                        </text>
                        <text x={x} y={textY} textAnchor="middle" className="fig-label">
                            {tool.short}
                        </text>
                    </g>
                );
            })}
        </svg>
    );
};

const Landing = () => (
    <>
        <section className="hero">
            <div className="hero-grid">
                <div className="hero-copy">
                    <p className="eyebrow hero-eyebrow">Model Context Protocol Server</p>
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
                    <Listing tag="Listing 01" title="mcpServers" snippet={CONFIG_SNIPPET} />
                </div>
            </div>
        </section>

        <section className="fig-section" aria-labelledby="fig-heading">
            <div className="sheet-head">
                <p className="eyebrow">What your assistant can do</p>
                <h2 id="fig-heading">Five tools and one resource, on one channel.</h2>
                <p className="sheet-sub">
                    Everything your assistant needs to read and reason about the spec, indexed below.
                </p>
            </div>
            <FigureOne />
            <p className="fig-caption">Fig. 1 — request path from the AsyncAPI spec to your assistant</p>
            <ul className="fig-index">
                {TOOLS.map(tool => (
                    <li key={tool.name}>
                        <span className="num">{tool.num}</span>
                        <div>
                            <code className="name">{tool.name}</code>
                            <p>{tool.description}</p>
                        </div>
                    </li>
                ))}
            </ul>
        </section>

        <section className="datasheet-section" aria-labelledby="datasheet-heading">
            <div className="datasheet-inner">
                <div className="sheet-head">
                    <p className="eyebrow">Built for real workflows</p>
                    <h2 id="datasheet-heading">A small server that does one thing well.</h2>
                    <p className="sheet-sub">The spec, at your fingertips — no particular order to these, just facts.</p>
                </div>
                <dl className="datasheet-table">
                    {FEATURES.map(feature => (
                        <div className="datasheet-row" key={feature.term}>
                            <dt>{feature.term}</dt>
                            <dd>{feature.description}</dd>
                        </div>
                    ))}
                </dl>
            </div>
        </section>

        <section className="setup-section" id="setup" aria-labelledby="setup-heading">
            <div className="sheet-head">
                <p className="eyebrow">Up and running</p>
                <h2 id="setup-heading">Two ways in, one minute either way.</h2>
                <p className="sheet-sub">Pick the path that matches your client.</p>
            </div>
            <div className="setup-inner">
                <div className="procedure-paths">
                    <div className="procedure-path">
                        <div className="procedure-path-head">
                            <span className="procedure-path-letter">A</span>
                            <h3>Using Claude Code</h3>
                        </div>
                        <div className="procedure-step">
                            <span className="procedure-number">1</span>
                            <div className="procedure-step-body">
                                <p>Add the marketplace, once.</p>
                                <Listing tag="Terminal" title="shell" snippet={PLUGIN_MARKETPLACE_SNIPPET} />
                            </div>
                        </div>
                        <div className="procedure-step">
                            <span className="procedure-number">2</span>
                            <div className="procedure-step-body">
                                <p>Then install the plugin.</p>
                                <Listing tag="Inside Claude Code" title="command" snippet={PLUGIN_INSTALL_SNIPPET} />
                            </div>
                        </div>
                    </div>
                    <div className="procedure-path">
                        <div className="procedure-path-head">
                            <span className="procedure-path-letter">B</span>
                            <h3>Any other MCP client</h3>
                        </div>
                        <div className="procedure-step">
                            <div className="procedure-step-body">
                                <p>Paste this into your client's server configuration.</p>
                                <Listing tag="Listing 02" title="mcpServers" snippet={CONFIG_SNIPPET} />
                            </div>
                        </div>
                    </div>
                </div>
                <p className="muted ask-examples">
                    "What does the AsyncAPI spec say about server objects?" · "Search the spec for 'channels'" ·
                    "Validate this AsyncAPI document"
                </p>
            </div>
        </section>

        <section className="cta-section">
            <div className="cta-seal">
                <p className="eyebrow">Ready when you are</p>
                <h2>Start using it today</h2>
                <p>Free, open source, and ready when you are.</p>
                <a
                    href="https://github.com/Souvikns/asyncapi-mcp"
                    className="btn btn-on-ink"
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
