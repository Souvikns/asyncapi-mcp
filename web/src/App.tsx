import { Route, Routes } from 'react-router-dom';

import Landing from './pages/Landing';

/** A message packet mid-transit between two channel rails — the page's recurring motif at icon scale. */
const ChannelMark = () => (
    <span className="nav-mark" aria-hidden="true">
        <svg width="20" height="16" viewBox="0 0 24 18" fill="none">
            <path d="M1 3h22M1 15h22" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <rect className="mark-packet" x="9" y="6" width="6" height="6" rx="0.5" fill="currentColor" />
        </svg>
    </span>
);

const Nav = () => (
    <header className="nav">
        <a href="/" className="nav-brand">
            <ChannelMark /> AsyncAPI MCP
        </a>
        <nav className="nav-links">
            <a
                href="https://github.com/Souvikns/asyncapi-mcp"
                className="nav-link"
                target="_blank"
                rel="noreferrer"
            >
                GitHub&nbsp;↗
            </a>
        </nav>
    </header>
);

const App = () => (
    <div className="app">
        <Nav />
        <main>
            <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="*" element={<Landing />} />
            </Routes>
        </main>
        <footer className="footer">
            <div className="footer-inner">
                <div>
                    <span className="footer-brand">
                        <span className="footer-mark">
                            <ChannelMark />
                        </span>
                        AsyncAPI MCP
                    </span>
                    <p>Open source, MIT licensed.</p>
                </div>
                <nav className="footer-links">
                    <a href="https://github.com/asyncapi/spec" target="_blank" rel="noreferrer">
                        AsyncAPI Specification
                    </a>
                    <a href="https://modelcontextprotocol.io" target="_blank" rel="noreferrer">
                        Model Context Protocol
                    </a>
                    <span className="footer-doc-no">DOC — ASYNC-MCP</span>
                </nav>
            </div>
        </footer>
    </div>
);

export default App;
